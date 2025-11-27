import {
  type FlatParseResult,
  CSVParser as WASMCSVParserInternal,
} from "web-csv-toolbox-wasm";
import {
  DEFAULT_ASSEMBLER_MAX_FIELD_COUNT,
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
} from "@/core/constants.ts";
import type { CSVParserOptions, CSVParserParseOptions } from "@/core/types.ts";
import { isWasmInitialized } from "@/wasm/loaders/wasmState.ts";
import type {
  FlatParseData,
  WASMParserOptions,
} from "./wasm-internal-types.ts";

// Re-export for derived classes
export type { FlatParseData } from "./wasm-internal-types.ts";

/**
 * Base class for WASM-based String CSV parsers using Flat data transfer optimization.
 *
 * This base class handles the WASM interaction and returns intermediate flat data
 * that derived classes can convert to Object or Array format.
 *
 * Unlike {@link WASMBinaryCSVParserBase}, this class accepts string input directly
 * and handles the conversion to binary internally using TextEncoder.
 *
 * ## Design Philosophy: Flat Data Transfer Format
 *
 * This parser uses a "Flat" data transfer format optimized for WASM↔JS boundary
 * crossing efficiency. The key insight is that **WASM↔JS boundary crossings are
 * expensive** - each call to create a JavaScript object, set a property, or push
 * to an array requires crossing this boundary.
 *
 * ### Traditional Object Approach (SLOW)
 * For N records with M fields each:
 * - N × Object.new() calls
 * - N × M × Reflect.set() calls
 * - Total: N × (M + 2) boundary crossings
 *
 * ### Flat Array Approach (FAST)
 * - 1 × headers array (cached, created once)
 * - 1 × fieldData array (all field values in a single flat array)
 * - Total: ~3 boundary crossings
 *
 * For a 1000-row × 20-column CSV, this reduces boundary crossings from
 * ~21,000 to just 3 - a **99.98% reduction**.
 *
 * Object assembly is then performed on the JavaScript side, which is much
 * faster than crossing the WASM↔JS boundary for each property.
 *
 * @template Header - Array of header field names
 * @internal
 */
export abstract class WASMStringCSVParserBase<
  Header extends ReadonlyArray<string> = readonly string[],
> {
  protected parser: WASMCSVParserInternal;
  protected cachedHeaders: string[] | null = null;
  readonly #encoder = new TextEncoder();

  /**
   * Create a new WASM String CSV Parser.
   *
   * @param options - Parser options
   */
  constructor(options: CSVParserOptions<Header> = {}) {
    const {
      delimiter = DEFAULT_DELIMITER,
      quotation = DEFAULT_QUOTATION,
      maxFieldCount = DEFAULT_ASSEMBLER_MAX_FIELD_COUNT,
      header,
    } = options;

    // Check if WASM is initialized - throw clear error if not
    if (!isWasmInitialized()) {
      throw new RangeError(
        "WASM is not initialized. " +
          "For the main entry, call 'loadWASMSync()' before using WASM parsers, " +
          "or use 'await loadWASM()' for async initialization. " +
          "For the slim entry, call 'await loadWASM(wasmUrl)' before using WASM features. " +
          "Example:\n" +
          "  import { loadWASMSync, parseString } from 'web-csv-toolbox';\n" +
          "  loadWASMSync();\n" +
          "  const result = parseString.toArraySync(csv, { engine: { wasm: true } });",
      );
    }

    // Create parser with options object
    const wasmOptions: WASMParserOptions = {};

    if (delimiter !== DEFAULT_DELIMITER) {
      wasmOptions.delimiter = delimiter;
    }
    if (quotation !== DEFAULT_QUOTATION) {
      wasmOptions.quotation = quotation;
    }
    if (maxFieldCount !== DEFAULT_ASSEMBLER_MAX_FIELD_COUNT) {
      wasmOptions.maxFieldCount = maxFieldCount;
    }
    if (header) {
      wasmOptions.header = header;
    }

    this.parser = new WASMCSVParserInternal(wasmOptions as any);
  }

  /**
   * Parse chunk using Flat data transfer optimization and return intermediate data.
   * Derived classes use this to build their specific output format.
   *
   * @param chunk - String CSV data
   * @returns Flat parse data for conversion
   */
  protected parseFlatChunk(chunk: string): FlatParseData {
    // Convert string to Uint8Array for WASM
    const bytes = this.#encoder.encode(chunk);
    // Process chunk in streaming mode (call finish() to finalize)
    const result: FlatParseResult = this.parser.processChunkBytes(bytes);

    // Cache headers if available
    const headers = result.headers as string[] | null;
    if (headers && !this.cachedHeaders) {
      this.cachedHeaders = headers;
    }

    return {
      headers: this.cachedHeaders,
      fieldData: result.fieldData as string[],
      actualFieldCounts: result.actualFieldCounts as number[],
      recordCount: result.recordCount,
      fieldCount: result.fieldCount,
    };
  }

  /**
   * Finish parsing and get remaining data (consistent with parseFlatChunk output)
   */
  protected flushFlat(): FlatParseData {
    const result: FlatParseResult = this.parser.finish();

    // Update cached headers if flush returned new headers
    // (handles case where header row spans multiple chunks)
    const headers = result.headers as string[] | null;
    if (headers && !this.cachedHeaders) {
      this.cachedHeaders = headers;
    }

    return {
      headers: this.cachedHeaders,
      fieldData: result.fieldData as string[],
      actualFieldCounts: result.actualFieldCounts as number[],
      recordCount: result.recordCount,
      fieldCount: result.fieldCount,
    };
  }

  /**
   * Get cached headers (available after first parse)
   */
  protected getHeaders(): string[] | null {
    return this.cachedHeaders;
  }

  /**
   * Abstract method for parsing - derived classes implement specific output format
   */
  abstract parse(
    chunk?: string,
    options?: CSVParserParseOptions,
  ): IterableIterator<unknown>;
}
