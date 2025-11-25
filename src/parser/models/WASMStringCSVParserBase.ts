import {
  type FlatParseResult,
  CSVParserOptimized as WASMCSVParserOptimizedInternal,
} from "web-csv-toolbox-wasm";
import {
  isSyncInitialized,
  loadWASMSync,
} from "#/wasm/loaders/loadWASMSync.js";
import {
  DEFAULT_ASSEMBLER_MAX_FIELD_COUNT,
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
} from "@/core/constants.ts";
import type { CSVParserOptions, CSVParserParseOptions } from "@/core/types.ts";
import type {
  FlatParseData,
  WASMParserOptions,
} from "./wasm-internal-types.ts";

// Re-export for derived classes
export type { FlatParseData } from "./wasm-internal-types.ts";

/**
 * Base class for WASM-based String CSV parsers using Truly Flat optimization.
 *
 * This base class handles the WASM interaction and returns intermediate flat data
 * that derived classes can convert to Object or Array format.
 *
 * Unlike {@link WASMBinaryCSVParserBase}, this class accepts string input directly
 * and handles the conversion to binary internally using TextEncoder.
 *
 * **Performance**: Uses Truly Flat optimization for 16-31% faster parsing
 * with 99.8%+ reduction in WASM↔JS boundary crossings.
 *
 * @template Header - Array of header field names
 * @internal
 */
export abstract class WASMStringCSVParserBase<
  Header extends ReadonlyArray<string> = readonly string[],
> {
  protected parser: WASMCSVParserOptimizedInternal;
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

    // Auto-initialize WASM if not already initialized
    if (!isSyncInitialized()) {
      try {
        loadWASMSync();
      } catch (error) {
        throw new RangeError(
          "WASM initialization failed. " +
            `Original error: ${error instanceof Error ? error.message : String(error)}. ` +
            "Possible causes: " +
            "(1) Unsupported runtime (WASM not available), " +
            "(2) WASM binary inaccessible or corrupted, " +
            "(3) Bundler configuration issues (ensure WASM file is included in bundle). " +
            "Try: Check browser/runtime supports WebAssembly, verify bundler settings, or use async loadWASM() for better error details.",
        );
      }
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

    this.parser = new WASMCSVParserOptimizedInternal(wasmOptions as any);
  }

  /**
   * Parse chunk using Truly Flat optimization and return intermediate data.
   * Derived classes use this to build their specific output format.
   *
   * @param chunk - String CSV data
   * @returns Flat parse data for conversion
   */
  protected parseFlatChunk(chunk: string): FlatParseData {
    // Convert string to Uint8Array for WASM
    const bytes = this.#encoder.encode(chunk);
    const result: FlatParseResult =
      this.parser.processChunkBytesTrulyFlat(bytes);

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
   * Flush remaining data using legacy method (Truly Flat doesn't have flush yet)
   * TODO: Add flushTrulyFlat() to WASM
   */
  protected flushLegacy(): any[] {
    const result = this.parser.flush();
    return Array.isArray(result) ? result : [];
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
