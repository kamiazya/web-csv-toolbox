import type { CSVSeparatorIndexResult } from "../types/SeparatorIndexResult.ts";
import {
  CSVSeparatorIndexingBackend,
  type CSVSeparatorIndexingBackendConfig,
} from "../webgpu/indexing/CSVSeparatorIndexingBackend.ts";
import type { CSVIndexerBackendAsync } from "./CSVSeparatorIndexer.ts";

/**
 * GPU Indexer Backend (Adapter)
 *
 * Wraps the WebGPU CSV Separator Indexing Backend to implement the
 * CSVIndexerBackendAsync interface for seamless integration with
 * the async indexer and parser architecture.
 *
 * **Features:**
 * - GPU-accelerated separator detection (1.44-1.50× faster than CPU streaming)
 * - Optimal for files >100MB
 * - Automatic resource cleanup via destroy() method
 * - Transparent fallback support through interface abstraction
 *
 * **Performance:**
 * - Throughput: ~12.1 MB/s (consistent across file sizes)
 * - Speedup: 1.44-1.50× over CPU streaming
 * - Setup overhead: ~8ms (significant for small files <1MB)
 *
 * @example Basic usage
 * ```typescript
 * const backend = new GPUIndexerBackend({
 *   chunkSize: 1024 * 1024, // 1MB
 * });
 *
 * try {
 *   await backend.initialize();
 *   const result = await backend.scan(csvBytes, false);
 *   console.log(`Found ${result.sepCount} separators`);
 * } finally {
 *   await backend.destroy();
 * }
 * ```
 *
 * @example With custom GPU device
 * ```typescript
 * const adapter = await navigator.gpu.requestAdapter();
 * const device = await adapter.requestDevice();
 *
 * const backend = new GPUIndexerBackend({
 *   device, // Share GPU device across operations
 * });
 * ```
 */
export class GPUIndexerBackend implements CSVIndexerBackendAsync {
  /** Wrapped WebGPU backend */
  private readonly gpuBackend: CSVSeparatorIndexingBackend;

  /**
   * Create a new GPU Indexer Backend
   *
   * @param config - Configuration for the WebGPU backend
   */
  constructor(config: CSVSeparatorIndexingBackendConfig = {}) {
    this.gpuBackend = new CSVSeparatorIndexingBackend(config);
  }

  /**
   * Whether the backend is initialized and ready to use
   */
  get isInitialized(): boolean {
    return this.gpuBackend.isInitialized;
  }

  /**
   * Initialize the GPU backend
   *
   * Sets up GPU device, compiles shaders, creates pipelines.
   * Must be called before scan().
   *
   * @throws {Error} If WebGPU is not supported or GPU device acquisition fails
   *
   * @example
   * ```typescript
   * const backend = new GPUIndexerBackend();
   * await backend.initialize();
   * ```
   */
  async initialize(): Promise<void> {
    await this.gpuBackend.initialize();
  }

  /**
   * Get the maximum recommended chunk size for this backend
   *
   * Calculated from GPU device limits:
   * - maxComputeWorkgroupsPerDimension (default: 65535)
   * - workgroupSize (resolved value, default: 256)
   *
   * @returns Maximum chunk size in bytes
   *
   * @example
   * ```typescript
   * const backend = new GPUIndexerBackend();
   * await backend.initialize();
   * const maxSize = backend.getMaxChunkSize();
   * console.log(`Max chunk size: ${maxSize / 1024 / 1024} MB`);
   * ```
   */
  getMaxChunkSize(): number {
    return this.gpuBackend.getMaxChunkSize();
  }

  /**
   * Scan a chunk of CSV data and return separator positions (async)
   *
   * Uses GPU acceleration for separator detection with two-pass algorithm:
   * - Pass 1: Collect quote parity per workgroup
   * - CPU: Compute prefix XOR across workgroups
   * - Pass 2: Detect separators using CPU-computed quote state
   *
   * @param chunk - CSV data as bytes
   * @param prevInQuote - Quote state from previous chunk (false for first chunk)
   * @returns Promise resolving to CSVSeparatorIndexResult with separator positions
   *
   * @throws {Error} If backend is not initialized
   *
   * @example
   * ```typescript
   * const backend = new GPUIndexerBackend();
   * await backend.initialize();
   *
   * const result = await backend.scan(csvBytes, false);
   * console.log(`Found ${result.sepCount} separators`);
   * console.log(`Processed ${result.processedBytes} bytes`);
   * console.log(`End in quote: ${result.endInQuote}`);
   * ```
   */
  async scan(
    chunk: Uint8Array,
    prevInQuote: boolean,
  ): Promise<CSVSeparatorIndexResult> {
    if (!this.isInitialized) {
      throw new Error("GPUIndexerBackend: initialize() must be called first");
    }

    // Call the GPU backend's run() method
    const result = await this.gpuBackend.run(chunk, prevInQuote);

    // Return the result (already in correct format)
    // Note: WebGPU backend doesn't provide unescapeFlags (optional field)
    return {
      separators: result.separators,
      sepCount: result.sepCount,
      processedBytes: result.processedBytes,
      endInQuote: result.endInQuote,
    };
  }

  /**
   * Destroy the backend and release GPU resources
   *
   * Cleans up GPU buffers, pipelines, and device (if owned).
   * Should be called when done to prevent resource leaks.
   *
   * @example
   * ```typescript
   * const backend = new GPUIndexerBackend();
   * try {
   *   await backend.initialize();
   *   await backend.scan(csvBytes, false);
   * } finally {
   *   await backend.destroy(); // Always cleanup
   * }
   * ```
   *
   * @example With await using (automatic cleanup)
   * ```typescript
   * await using backend = await CSVSeparatorIndexingBackend.create();
   * const result = await backend.run(csvBytes, false);
   * // backend is automatically destroyed when scope exits
   * ```
   */
  async destroy(): Promise<void> {
    await this.gpuBackend.destroy();
  }

  /**
   * Get the underlying WebGPU backend
   *
   * Useful for advanced use cases that need direct access to the GPU backend,
   * such as timing instrumentation or custom buffer management.
   *
   * @returns The wrapped CSVSeparatorIndexingBackend instance
   * @internal
   */
  getGPUBackend(): CSVSeparatorIndexingBackend {
    return this.gpuBackend;
  }
}
