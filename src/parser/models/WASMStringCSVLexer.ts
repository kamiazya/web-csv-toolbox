import {
  type FlatTokensResult,
  BinaryCSVLexerLegacy as WASMBinaryCSVLexerInternal,
} from "web-csv-toolbox-wasm";
import {
  DEFAULT_DELIMITER,
  DEFAULT_LEXER_MAX_BUFFER_SIZE,
  DEFAULT_QUOTATION,
  TokenType,
} from "@/core/constants.ts";
import type {
  AbortSignalOptions,
  CommonOptions,
  CSVLexerLexOptions,
  StringCSVLexer,
  Token,
  TokenLocation,
} from "@/core/types.ts";
import { assertCommonOptions } from "@/utils/validation/assertCommonOptions.ts";
import type { FlatTokenData, WASMLexerOptions } from "./wasm-internal-types.ts";

/**
 * WASM-based String CSV Lexer for tokenizing string input.
 *
 * This lexer uses WebAssembly for high-performance CSV tokenization.
 * It implements the {@link StringCSVLexer} interface and can process CSV data
 * incrementally (streaming) or in a single pass.
 *
 * Unlike {@link WASMBinaryCSVLexer}, this lexer accepts string input directly
 * and handles the conversion to binary internally using TextEncoder.
 *
 * **Performance**: Approximately 2-4x faster than JavaScript-based lexing.
 *
 * @example Basic usage
 * ```typescript
 * import { loadWASM, WASMStringCSVLexer } from "web-csv-toolbox";
 *
 * await loadWASM();
 *
 * const lexer = new WASMStringCSVLexer({ delimiter: ',' });
 * const csv = "id,name\n1,Alice";
 *
 * for (const token of lexer.lex(csv)) {
 *   console.log(token);
 * }
 * ```
 *
 * @example Streaming usage
 * ```typescript
 * const lexer = new WASMStringCSVLexer();
 *
 * // Process chunks as they arrive
 * for (const token of lexer.lex("id,na", { stream: true })) {
 *   console.log(token);
 * }
 *
 * for (const token of lexer.lex("me\n1,Alice", { stream: true })) {
 *   console.log(token);
 * }
 *
 * // Flush remaining data
 * for (const token of lexer.lex()) {
 *   console.log(token);
 * }
 * ```
 */
export class WASMStringCSVLexer implements StringCSVLexer {
  #lexer: WASMBinaryCSVLexerInternal;
  #maxBufferSize: number;
  #currentBufferSize = 0;
  #signal?: AbortSignal;
  #source?: string;
  readonly #encoder = new TextEncoder();

  /**
   * Create a new WASM String CSV Lexer.
   *
   * @param options - Lexer options
   */
  constructor(options: CommonOptions<string, string> & AbortSignalOptions = {}) {
    const {
      delimiter = DEFAULT_DELIMITER,
      quotation = DEFAULT_QUOTATION,
      maxBufferSize = DEFAULT_LEXER_MAX_BUFFER_SIZE,
      signal,
      source,
    } = options;

    // Validate common options
    assertCommonOptions({ delimiter, quotation, maxBufferSize });

    this.#maxBufferSize = maxBufferSize;
    this.#signal = signal;
    this.#source = source;

    // Create lexer with options object
    const wasmOptions: WASMLexerOptions = {};

    if (delimiter !== DEFAULT_DELIMITER) {
      wasmOptions.delimiter = delimiter;
    }
    if (quotation !== DEFAULT_QUOTATION) {
      wasmOptions.quotation = quotation;
    }

    // Pass options object to WASM constructor
    // Note: Type cast needed until WASM is rebuilt with new constructor signature
    this.#lexer = new WASMBinaryCSVLexerInternal(wasmOptions as any);
  }

  /**
   * Lexes the given chunk of CSV string data.
   *
   * When called with a chunk and `{ stream: true }`, the lexer processes the chunk
   * and returns completed tokens, keeping incomplete data in an internal buffer.
   *
   * When called with a chunk and `{ stream: false }` (or omitted), the lexer
   * processes the chunk as the final one and flushes all remaining data.
   *
   * When called without a chunk, flushes any remaining buffered data.
   *
   * @param chunk - The chunk of CSV string data to be lexed. Omit to flush remaining data.
   * @param options - Lexer options.
   * @returns An iterable iterator of tokens.
   *
   * @example Streaming mode
   * ```typescript
   * const lexer = new WASMStringCSVLexer();
   *
   * for (const token of lexer.lex("id,name\n1,", { stream: true })) {
   *   console.log(token); // Tokens for "id", ",", "name", "\n", "1", ","
   * }
   * // "1," is buffered
   *
   * for (const token of lexer.lex("Alice", { stream: false })) {
   *   console.log(token); // Token for "Alice"
   * }
   * ```
   *
   * @example Flush mode
   * ```typescript
   * const lexer = new WASMStringCSVLexer();
   *
   * lexer.lex("id,na", { stream: true }); // "na" buffered
   *
   * for (const token of lexer.lex()) { // Flush
   *   console.log(token); // Token for "na"
   * }
   * ```
   */
  *lex(
    chunk?: string,
    options?: CSVLexerLexOptions,
  ): IterableIterator<Token> {
    // Check for abort signal
    this.#signal?.throwIfAborted();

    const { stream = false } = options ?? {};

    // Convert string to bytes
    const bytes = chunk !== undefined ? this.#encoder.encode(chunk) : undefined;

    if (bytes === undefined || !stream) {
      // Flush mode or final chunk - use Truly Flat optimization
      const allFlatData: FlatTokenData = {
        types: [],
        values: [],
        lines: [],
        columns: [],
        offsets: [],
        tokenCount: 0,
      };

      if (bytes !== undefined) {
        // Check buffer size limit
        this.#checkBufferSize(bytes.length);

        // Process the final chunk using flat method
        const flatResult = this.#lexer.lexFlat(bytes);
        this.#mergeFlatData(allFlatData, flatResult);
      }

      // Always flush remaining data when not in streaming mode
      const flushResult = this.#lexer.lexFlat();
      this.#mergeFlatData(allFlatData, flushResult);

      // Reset buffer size after flush
      this.#currentBufferSize = 0;

      // Apply JS-compatible filtering and assemble tokens
      const filtered = this.#filterFlatTokensForJSCompatibility(
        allFlatData,
        true,
      );
      yield* this.#assembleTokensFromFlat(filtered);
    } else {
      // Check buffer size limit in streaming mode
      if (bytes !== undefined) {
        this.#checkBufferSize(bytes.length);
      }

      // Streaming mode - use Truly Flat optimization
      const flatResult = this.#lexer.lexFlat(bytes);
      const flatData = this.#extractFlatData(flatResult);

      // Apply JS-compatible filtering and assemble tokens
      const filtered = this.#filterFlatTokensForJSCompatibility(
        flatData,
        false,
      );
      yield* this.#assembleTokensFromFlat(filtered);
    }
  }

  /**
   * Check if adding the given size would exceed the buffer limit.
   */
  #checkBufferSize(additionalSize: number): void {
    this.#currentBufferSize += additionalSize;
    if (this.#currentBufferSize > this.#maxBufferSize) {
      throw new RangeError(
        `Buffer size exceeded: ${this.#currentBufferSize} bytes exceeds maximum of ${this.#maxBufferSize} bytes${
          this.#source ? ` in ${JSON.stringify(this.#source)}` : ""
        }`,
      );
    }
  }

  /**
   * Extract flat data from WASM result.
   */
  #extractFlatData(result: FlatTokensResult): FlatTokenData {
    return {
      // WASM now returns numeric token types
      types: result.types as number[],
      values: result.values as string[],
      lines: result.lines as number[],
      columns: result.columns as number[],
      offsets: result.offsets as number[],
      tokenCount: result.tokenCount,
    };
  }

  /**
   * Merge flat data from WASM result into accumulator.
   */
  #mergeFlatData(acc: FlatTokenData, result: FlatTokensResult): void {
    // WASM now returns numeric token types (0=Field, 1=FieldDelimiter, 2=RecordDelimiter)
    const types = result.types as number[];
    const values = result.values as string[];
    const lines = result.lines as number[];
    const columns = result.columns as number[];
    const offsets = result.offsets as number[];

    for (let i = 0; i < result.tokenCount; i++) {
      acc.types.push(types[i] ?? TokenType.Field);
      acc.values.push(values[i] ?? "");
      acc.lines.push(lines[i] ?? 1);
      acc.columns.push(columns[i] ?? 1);
      acc.offsets.push(offsets[i] ?? 0);
    }
    acc.tokenCount += result.tokenCount;
  }

  /**
   * Filter flat tokens to match JS lexer behavior.
   */
  #filterFlatTokensForJSCompatibility(
    data: FlatTokenData,
    isFlush: boolean,
  ): FlatTokenData {
    const filtered: FlatTokenData = {
      types: [],
      values: [],
      lines: [],
      columns: [],
      offsets: [],
      tokenCount: 0,
    };

    for (let i = 0; i < data.tokenCount; i++) {
      const tokenType = data.types[i];
      const tokenValue = data.values[i];
      const nextType = data.types[i + 1];

      // Skip empty field tokens that appear before delimiters
      // TokenType: 0=Field, 1=FieldDelimiter, 2=RecordDelimiter
      if (
        tokenType === TokenType.Field &&
        tokenValue === "" &&
        nextType !== undefined &&
        (nextType === TokenType.FieldDelimiter || nextType === TokenType.RecordDelimiter)
      ) {
        continue;
      }

      // In flush mode, strip trailing record delimiter
      if (
        isFlush &&
        i === data.tokenCount - 1 &&
        tokenType === TokenType.RecordDelimiter
      ) {
        continue;
      }

      filtered.types.push(tokenType ?? TokenType.Field);
      filtered.values.push(tokenValue ?? "");
      filtered.lines.push(data.lines[i] ?? 1);
      filtered.columns.push(data.columns[i] ?? 1);
      filtered.offsets.push(data.offsets[i] ?? 0);
      filtered.tokenCount++;
    }

    return filtered;
  }

  /**
   * Assemble Token objects from flat data.
   * This is where JS-side assembly happens for Truly Flat optimization.
   */
  *#assembleTokensFromFlat(data: FlatTokenData): IterableIterator<Token> {
    for (let i = 0; i < data.tokenCount; i++) {
      // WASM now returns numeric token types directly (0=Field, 1=FieldDelimiter, 2=RecordDelimiter)
      const type = (data.types[i] ?? TokenType.Field) as TokenType;
      const value = data.values[i] ?? "";
      const line = data.lines[i] ?? 1;
      const column = data.columns[i] ?? 1;
      const offset = data.offsets[i] ?? 0;

      // Create location object
      const location: TokenLocation = {
        start: {
          line,
          column,
          offset,
        },
        end: {
          line,
          column: column + value.length,
          offset: offset + value.length,
        },
        rowNumber: 1, // TODO: track row number properly
      };

      yield {
        type,
        value,
        location,
      } as Token;
    }
  }
}
