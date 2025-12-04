import type { CSVSeparatorIndexResult } from "../types/SeparatorIndexResult.ts";
import { getProcessedBytesCount } from "../utils/separatorUtils.ts";
import type { CSVIndexerBackendSync } from "./CSVSeparatorIndexer.ts";

// Type for the raw result from Wasm scanCsvBytesExtendedStreaming
interface WasmScanStreamingResult {
  separators: Uint32Array;
  unescapeFlags: Uint32Array;
  sepCount: number;
  processedBytes: number;
  endInQuote: boolean;
  /** Error message if offset overflow occurred */
  error?: string;
}

/**
 * Wasm-based implementation of CSVIndexerBackendSync
 *
 * This backend uses Wasm SIMD128 for high-performance CSV scanning.
 * It implements the CSVIndexerBackendSync interface for use with CSVSeparatorIndexer.
 *
 * @example
 * ```typescript
 * import { loadWasmSync } from 'web-csv-toolbox';
 *
 * // Initialize Wasm first
 * loadWasmSync();
 *
 * // Create backend with comma delimiter
 * const backend = new WasmIndexerBackend(44);
 *
 * // Use with CSVSeparatorIndexer
 * const indexer = new CSVSeparatorIndexer(backend);
 * const result = indexer.index(csvBytes);
 * ```
 */
export class WasmIndexerBackend implements CSVIndexerBackendSync {
  /** Delimiter character code */
  private readonly delimiter: number;

  /** Default maximum chunk size (1MB) */
  private readonly maxChunkSize: number;

  /** Cached Wasm scan function */
  private scanFn:
    | ((
        input: Uint8Array,
        delimiter: number,
        prevInQuote: boolean,
      ) => WasmScanStreamingResult)
    | null = null;

  /** Cached fallback scan function (non-streaming) */
  private fallbackScanFn:
    | ((input: Uint8Array, delimiter: number) => Uint32Array)
    | null = null;

  /**
   * Create a new WasmIndexerBackend
   *
   * @param delimiter - Delimiter character code (default: 44 for comma)
   * @param maxChunkSize - Maximum chunk size in bytes (default: 1MB)
   */
  constructor(delimiter: number = 44, maxChunkSize: number = 1024 * 1024) {
    this.delimiter = delimiter;
    this.maxChunkSize = maxChunkSize;
  }

  /**
   * Check if the backend is initialized
   *
   * The backend is considered initialized if Wasm SIMD is supported
   * and the Wasm module has been loaded.
   */
  get isInitialized(): boolean {
    return this.scanFn !== null || this.fallbackScanFn !== null;
  }

  /**
   * Get the maximum recommended chunk size
   */
  getMaxChunkSize(): number {
    return this.maxChunkSize;
  }

  /**
   * Initialize the backend by loading the Wasm scan functions
   *
   * This method dynamically imports the Wasm module to get the scan functions.
   * Call this before using scan().
   *
   * @throws Error if Wasm module cannot be loaded
   */
  async initialize(): Promise<void> {
    if (this.scanFn !== null) {
      return;
    }

    try {
      // Dynamic import to get the Wasm functions
      // This uses the appropriate entry point based on the environment
      const wasm = await import("@/wasm/WasmInstance.main.web.ts");

      // Ensure Wasm is initialized
      if (!wasm.isInitialized()) {
        await wasm.loadWasm();
      }

      // Try to get the extended streaming function first (with quote metadata)
      if (typeof (wasm as any).scanCsvBytesExtendedStreaming === "function") {
        this.scanFn = (wasm as any).scanCsvBytesExtendedStreaming;
      } else if (typeof (wasm as any).scanCsvBytesStreaming === "function") {
        // Fallback to non-extended streaming
        this.scanFn = (wasm as any).scanCsvBytesStreaming;
      }

      // Get fallback function
      if (typeof (wasm as any).scanCsvBytesZeroCopy === "function") {
        this.fallbackScanFn = (wasm as any).scanCsvBytesZeroCopy;
      }

      if (this.scanFn === null && this.fallbackScanFn === null) {
        throw new Error("No scan function available in Wasm module");
      }
    } catch (error) {
      throw new Error(`Failed to initialize Wasm backend: ${error}`);
    }
  }

  /**
   * Initialize the backend with pre-loaded Wasm module
   *
   * This method accepts a pre-loaded Wasm module object.
   * Use this when you've already loaded Wasm and want to avoid async import.
   *
   * @param wasmModule - Pre-loaded Wasm module (from WasmInstance.main.web.ts)
   * @throws Error if required functions are not available
   */
  initializeWithModule(wasmModule: {
    scanCsvBytesExtendedStreaming?: (
      input: Uint8Array,
      delimiter: number,
      prevInQuote: boolean,
    ) => WasmScanStreamingResult;
    scanCsvBytesStreaming?: (
      input: Uint8Array,
      delimiter: number,
      prevInQuote: boolean,
    ) => WasmScanStreamingResult;
    scanCsvBytesZeroCopy?: (
      input: Uint8Array,
      delimiter: number,
    ) => Uint32Array;
    isInitialized: () => boolean;
    loadWasmSync: () => void;
  }): void {
    if (this.scanFn !== null) {
      return;
    }

    // Ensure Wasm is initialized
    if (!wasmModule.isInitialized()) {
      wasmModule.loadWasmSync();
    }

    // Try to get the extended streaming function first (with quote metadata)
    if (typeof wasmModule.scanCsvBytesExtendedStreaming === "function") {
      this.scanFn = wasmModule.scanCsvBytesExtendedStreaming;
    } else if (typeof wasmModule.scanCsvBytesStreaming === "function") {
      // Fallback to non-extended streaming
      this.scanFn = wasmModule.scanCsvBytesStreaming;
    }

    // Get fallback function
    if (typeof wasmModule.scanCsvBytesZeroCopy === "function") {
      this.fallbackScanFn = wasmModule.scanCsvBytesZeroCopy;
    }

    if (this.scanFn === null && this.fallbackScanFn === null) {
      throw new Error("No scan function available in Wasm module");
    }
  }

  /**
   * Scan a chunk of CSV data and return separator positions
   *
   * @param chunk - CSV data as bytes
   * @param prevInQuote - Quote state from previous chunk
   * @returns CSVSeparatorIndexResult with separator positions and metadata
   * @throws Error if backend is not initialized
   */
  scan(chunk: Uint8Array, prevInQuote: boolean): CSVSeparatorIndexResult {
    // Use streaming function if available
    if (this.scanFn !== null) {
      const result = this.scanFn(chunk, this.delimiter, prevInQuote);

      // Check for errors from Wasm (e.g., offset overflow)
      if (result.error) {
        throw new RangeError(result.error);
      }

      // Copy the Uint32Arrays to ensure they're not views into Wasm memory
      // that could be invalidated by future calls
      const separatorsCopy = new Uint32Array(result.separators.length);
      separatorsCopy.set(result.separators);

      // Copy unescapeFlags if available (extended format)
      let unescapeFlagsCopy: Uint32Array | undefined;
      if (result.unescapeFlags && result.unescapeFlags.length > 0) {
        unescapeFlagsCopy = new Uint32Array(result.unescapeFlags.length);
        unescapeFlagsCopy.set(result.unescapeFlags);
      }

      return {
        separators: separatorsCopy,
        sepCount: result.sepCount,
        processedBytes: result.processedBytes,
        endInQuote: result.endInQuote,
        unescapeFlags: unescapeFlagsCopy,
      };
    }

    // Fallback to non-streaming function
    if (this.fallbackScanFn !== null) {
      const separators = this.fallbackScanFn(chunk, this.delimiter);
      const sepCount = separators.length;
      const processedBytes = getProcessedBytesCount(separators, sepCount);

      // Copy the Uint32Array
      const separatorsCopy = new Uint32Array(sepCount);
      separatorsCopy.set(separators);

      return {
        separators: separatorsCopy,
        sepCount,
        processedBytes,
        // Non-streaming function doesn't return quote state
        // This is a limitation - prevInQuote is ignored
        endInQuote: false,
      };
    }

    throw new Error(
      "WasmIndexerBackend is not initialized. Call initialize() or initializeSync() first.",
    );
  }
}
