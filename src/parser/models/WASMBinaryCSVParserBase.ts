import {
  type FlatParseResult,
  CSVParser as WASMCSVParserInternal,
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
 * Base class for WASM-based CSV parsers using Truly Flat optimization.
 *
 * This base class handles the WASM interaction and returns intermediate flat data
 * that derived classes can convert to Object or Array format.
 *
 * **Performance**: Uses Truly Flat optimization for 16-31% faster parsing
 * with 99.8%+ reduction in WASM↔JS boundary crossings.
 *
 * @template Header - Array of header field names
 * @internal
 */
export abstract class WASMBinaryCSVParserBase<
  Header extends ReadonlyArray<string> = readonly string[],
> {
  protected parser: WASMCSVParserInternal;
  protected cachedHeaders: string[] | null = null;

  /**
   * Create a new WASM Binary CSV Parser.
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

    this.parser = new WASMCSVParserInternal(wasmOptions as any);
  }

  /**
   * Parse chunk using Truly Flat optimization and return intermediate data.
   * Derived classes use this to build their specific output format.
   *
   * @param chunk - Binary CSV data
   * @returns Flat parse data for conversion
   */
  protected parseFlatChunk(chunk: Uint8Array): FlatParseData {
    const result: FlatParseResult =
      this.parser.processChunkBytesTrulyFlat(chunk);

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
   * Flush remaining data using Truly Flat format (consistent with parseFlatChunk output)
   */
  protected flushFlat(): FlatParseData {
    const result: FlatParseResult = this.parser.flushTrulyFlat();

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
   * Flush remaining data using legacy method (object format)
   * @deprecated Use flushFlat() for consistent output format
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
    chunk?: BufferSource,
    options?: CSVParserParseOptions,
  ): IterableIterator<unknown>;
}
