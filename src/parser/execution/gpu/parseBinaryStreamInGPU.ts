/**
 * WebGPU execution for parseBinaryStream (New Implementation)
 *
 * This module provides GPU-accelerated binary stream CSV parsing using WebGPU.
 * It uses the standard Lexer/Assembler pipeline with GPUBinaryCSVLexer.
 *
 * Large chunks are automatically split to stay within GPU dispatch limits.
 */

import { TokenType } from "@/core/constants.ts";
import type {
  CSVRecord,
  ParseBinaryOptions,
  ParseOptions,
} from "@/core/types.ts";
import {
  GPUBinaryCSVLexer,
  type GPUBinaryCSVLexerConfig,
} from "@/parser/models/GPUBinaryCSVLexer.ts";
import type { GPUToken } from "@/parser/webgpu/assembly/separatorsToTokens.ts";
import { CSVSeparatorIndexingBackend } from "@/parser/webgpu/indexing/CSVSeparatorIndexingBackend.ts";

/**
 * Simple GPU token assembler for CSV records.
 * Processes type-based tokens from GPU lexer directly without conversion.
 * Supports both object and array output formats.
 */
class GPUTokenAssembler<Header extends ReadonlyArray<string>> {
  #fieldIndex = 0;
  #row: string[] = [];
  #header: Header | undefined;
  #skipEmptyLines: boolean;
  #dirty = false;
  #outputFormat: "object" | "array";
  #hasNonEmptyField = false; // Track if current row has any non-empty fields

  constructor(
    header: Header | undefined,
    skipEmptyLines: boolean = false,
    outputFormat: "object" | "array" = "object",
  ) {
    // Set header even if it's an empty array (headerless mode)
    // Only undefined means "read header from first row"
    if (header !== undefined) {
      this.#header = header;
    }
    this.#skipEmptyLines = skipEmptyLines;
    this.#outputFormat = outputFormat;
  }

  *processToken(token: GPUToken): IterableIterator<CSVRecord<Header>> {
    if (token.type === TokenType.FieldDelimiter) {
      // Field delimiter: move to next field
      if (this.#row[this.#fieldIndex] === undefined) {
        this.#row[this.#fieldIndex] = "";
      }
      this.#fieldIndex++;
      this.#dirty = true;
    } else if (token.type === TokenType.RecordDelimiter) {
      // Record delimiter: complete the record
      // Only add empty field if we've seen any content (dirty === true)
      if (this.#dirty && this.#row[this.#fieldIndex] === undefined) {
        this.#row[this.#fieldIndex] = "";
      }

      // Optimized empty row detection using offset-based tracking
      // Check if row has all empty fields - treat as empty row to match CPU/WASM behavior
      // This handles cases like:
      // - "\n" → [] (no fields)
      // - ",,\n" → [] (all fields empty)
      // But keeps: ",e,\n" → ['', 'e', ''] (some non-empty fields)
      // Uses #hasNonEmptyField flag set during Field token processing (zero overhead)
      const isEmptyRow = this.#row.length === 0 || !this.#hasNonEmptyField;
      if (isEmptyRow) {
        this.#row = [];
        this.#dirty = false;
      }

      if (this.#header === undefined) {
        // First row is header
        this.#header = this.#row as unknown as Header;
      } else {
        // Yield record
        if (this.#dirty || !this.#skipEmptyLines) {
          yield this.#assembleRecord();
        }
      }

      // Reset for next record
      this.#fieldIndex = 0;
      this.#row = [];
      this.#dirty = false;
      this.#hasNonEmptyField = false; // Reset empty field tracker
    } else {
      // Field token (TokenType.Field)
      // Track non-empty fields by checking decoded value
      // This is more efficient than Array.every() as it's done incrementally
      // Note: Cannot use offset-based check because quoted empty strings (e.g., "")
      // have non-zero byte length but decode to empty string
      if (token.value !== "") {
        this.#hasNonEmptyField = true;
      }

      this.#row[this.#fieldIndex] = token.value;
      this.#dirty = true;
    }
  }

  *flush(): IterableIterator<CSVRecord<Header>> {
    // Handle trailing record without final delimiter
    if (this.#dirty && this.#header) {
      if (this.#row[this.#fieldIndex] === undefined) {
        this.#row[this.#fieldIndex] = "";
      }

      // Optimized empty row detection using offset-based tracking
      const isEmptyRow = this.#row.length === 0 || !this.#hasNonEmptyField;
      if (isEmptyRow) {
        this.#row = [];
      }

      // Only yield if row is not empty (after empty check) or skipEmptyLines is false
      if (this.#row.length > 0 || !this.#skipEmptyLines) {
        yield this.#assembleRecord();
      }
    }
  }

  #assembleRecord(): CSVRecord<Header> {
    if (!this.#header) {
      throw new Error("Cannot assemble record without header");
    }

    if (this.#outputFormat === "array") {
      // Array format: return row as-is
      // For headerless mode (empty header array), return the row directly
      if (this.#header.length === 0) {
        return this.#row as unknown as CSVRecord<Header>;
      }
      const arrayRecord = this.#header.map(
        (_, index) => this.#row[index] ?? "",
      ) as unknown as CSVRecord<Header>;
      return arrayRecord;
    }

    // Object format: map to header keys
    // For headerless mode (empty header array), use numeric indices as keys
    if (this.#header.length === 0) {
      const record = Object.fromEntries(
        this.#row.map((value, index) => [String(index), value ?? ""]),
      ) as CSVRecord<Header>;
      return record;
    }

    const record = Object.fromEntries(
      this.#header.map((key, index) => [key, this.#row[index] ?? ""]),
    ) as CSVRecord<Header>;

    return record;
  }
}

/**
 * Parse CSV binary stream using WebGPU
 *
 * @param stream - ReadableStream of CSV bytes (Uint8Array)
 * @param options - Parse options
 * @yields Parsed CSV records as they are parsed (true streaming)
 *
 * @remarks
 * Large chunks are automatically split within the backend to stay within
 * GPU dispatch limits (maxComputeWorkgroupsPerDimension * 256 bytes).
 */
export async function* parseBinaryStreamInGPU<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = ",",
  Quotation extends string = '"',
>(
  stream: ReadableStream<Uint8Array>,
  options?:
    | ParseOptions<Header, Delimiter, Quotation>
    | ParseBinaryOptions<Header, Delimiter, Quotation>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Determine header settings
  const header: Header | undefined = options?.header as Header | undefined;
  const isHeaderlessMode =
    options?.header !== undefined &&
    Array.isArray(options.header) &&
    options.header.length === 0;

  // Initialize backend
  let backend: CSVSeparatorIndexingBackend | undefined;

  try {
    // Create backend (device will be acquired automatically by backend)
    backend = new CSVSeparatorIndexingBackend();
    await backend.initialize();

    // Create lexer
    const lexerConfig: GPUBinaryCSVLexerConfig = {
      backend,
      delimiter: options?.delimiter ?? ",",
    };
    const lexer = new GPUBinaryCSVLexer(lexerConfig);

    // Create GPU token assembler
    const assembler = new GPUTokenAssembler<Header>(
      isHeaderlessMode ? ([] as unknown as Header) : header,
      options?.skipEmptyLines ?? false,
      options?.outputFormat,
    );

    // Process stream
    const reader = stream.getReader();

    try {
      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;

        // Lex chunk to GPU tokens
        for await (const token of lexer.lex(chunk, { stream: true })) {
          // Process GPU token and yield records
          for (const record of assembler.processToken(
            token as unknown as GPUToken,
          )) {
            yield record;
          }
        }
      }

      // Flush lexer
      for await (const token of lexer.lex()) {
        for (const record of assembler.processToken(
          token as unknown as GPUToken,
        )) {
          yield record;
        }
      }

      // Flush assembler
      for (const record of assembler.flush()) {
        yield record;
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    // Cleanup backend resources
    if (backend) {
      await backend.destroy();
    }
  }
}
