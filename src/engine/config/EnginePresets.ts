import type {
  BackpressureCheckInterval,
  EngineConfig,
  EngineFallbackInfo,
  QueuingStrategyConfig,
  WorkerPool,
} from "@/core/types.ts";

/**
 * Base options shared by all engine presets.
 */
interface BasePresetOptions {
  /**
   * Blob reading strategy threshold (in bytes).
   * See {@link EngineConfig.arrayBufferThreshold} for details.
   *
   * @default 1048576 (1MB)
   */
  arrayBufferThreshold?: number;

  /**
   * Backpressure monitoring intervals.
   * See {@link EngineConfig.backpressureCheckInterval} for details.
   *
   * @default { lexer: 100, assembler: 10 }
   * @experimental
   */
  backpressureCheckInterval?: BackpressureCheckInterval;

  /**
   * Internal streaming queuing strategies.
   * See {@link EngineConfig.queuingStrategy} for details.
   *
   * @experimental
   */
  queuingStrategy?: QueuingStrategyConfig;
}

/**
 * Options for main thread engine presets.
 * Used by presets that do not use web workers.
 */
export interface MainThreadPresetOptions extends BasePresetOptions {
  /**
   * Callback for fallback notifications.
   * Called when the engine falls back to a less optimal strategy.
   *
   * @remarks
   * Applicable when GPU is enabled but unavailable.
   * Called when GPU initialization fails and parser falls back to WASM or JavaScript.
   */
  onFallback?: (info: EngineFallbackInfo) => void;
}

/**
 * Options for worker-based engine presets.
 * Used by presets that utilize web workers.
 */
export interface WorkerPresetOptions extends BasePresetOptions {
  /**
   * Worker pool for managing worker lifecycle.
   * Reuse workers across multiple parse operations.
   */
  workerPool?: WorkerPool;

  /**
   * Custom worker URL.
   * Use a custom worker script instead of the bundled worker.
   */
  workerURL?: string | URL;

  /**
   * Callback for fallback notifications.
   * Called when the engine falls back to a less optimal strategy.
   */
  onFallback?: (info: EngineFallbackInfo) => void;
}

/**
 * Options for customizing engine presets.
 * @deprecated Use {@link MainThreadPresetOptions} or {@link WorkerPresetOptions} instead.
 */
export type EnginePresetOptions = MainThreadPresetOptions | WorkerPresetOptions;

/**
 * Predefined engine configuration presets optimized for specific performance characteristics.
 *
 * All presets are functions that optionally accept configuration options.
 * Each preset is optimized for specific performance aspects:
 * - Parse speed (execution time)
 * - UI responsiveness (non-blocking)
 * - Memory efficiency
 * - Stability
 *
 * @example Basic usage
 * ```ts
 * import { parseString, EnginePresets } from 'web-csv-toolbox';
 *
 * // Use balanced preset for general-purpose CSV processing
 * for await (const record of parseString(csv, {
 *   engine: EnginePresets.balanced()
 * })) {
 *   console.log(record);
 * }
 * ```
 *
 * @example With WorkerPool
 * ```ts
 * import { parseString, EnginePresets, WorkerPool } from 'web-csv-toolbox';
 *
 * const pool = new WorkerPool({ maxWorkers: 4 });
 *
 * for await (const record of parseString(csv, {
 *   engine: EnginePresets.balanced({ workerPool: pool })
 * })) {
 *   console.log(record);
 * }
 * ```
 */
export const EnginePresets = Object.freeze({
  /**
   * Most stable configuration.
   *
   * **Optimization target:** Stability
   *
   * **Performance characteristics:**
   * - Parse speed: Standard (JavaScript execution)
   * - UI responsiveness: ❌ Blocks main thread
   * - Memory efficiency: Standard
   * - Stability: ⭐ Most stable (standard JavaScript APIs only)
   *
   * **Trade-offs:**
   * - ✅ Most stable: Uses only standard JavaScript APIs
   * - ✅ No worker initialization overhead
   * - ✅ No worker communication overhead
   * - ✅ Supports WHATWG Encoding Standard encodings (via TextDecoder)
   * - ✅ Supports all quotation characters
   * - ✅ Works everywhere without configuration
   * - ❌ Blocks main thread during parsing
   *
   * **Use when:**
   * - Stability is the highest priority
   * - UI blocking is acceptable
   * - Server-side parsing
   * - Maximum compatibility required
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  stable: (options?: MainThreadPresetOptions): EngineConfig => ({
    worker: false,
    wasm: false,
    ...options,
  }),

  /**
   * UI responsiveness optimized configuration.
   *
   * **Optimization target:** UI responsiveness (non-blocking)
   *
   * **Performance characteristics:**
   * - Parse speed: Slower (worker communication overhead)
   * - UI responsiveness: ✅ Non-blocking (worker execution)
   * - Memory efficiency: Standard
   * - Stability: ✅ Stable (Web Workers API)
   *
   * **Trade-offs:**
   * - ✅ Non-blocking UI: Parsing runs in worker thread
   * - ✅ Supports WHATWG Encoding Standard encodings (via TextDecoder)
   * - ✅ Supports all quotation characters
   * - ✅ Works on all browsers including Safari
   * - ⚠️ Worker communication overhead: Data transfer between threads
   * - ⚠️ Requires bundler configuration for worker URL
   *
   * **Use when:**
   * - UI responsiveness is critical
   * - Browser applications with interactive UI
   * - Broad encoding support required
   * - Safari compatibility needed
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  responsive: (options?: WorkerPresetOptions): EngineConfig => ({
    worker: true,
    wasm: false,
    workerStrategy: "message-streaming",
    ...options,
  }),

  /**
   * Memory efficiency optimized configuration.
   *
   * **Optimization target:** Memory efficiency
   *
   * **Performance characteristics:**
   * - Parse speed: Slower (worker communication overhead)
   * - UI responsiveness: ✅ Non-blocking (worker execution)
   * - Memory efficiency: ✅ Optimized (zero-copy stream transfer)
   * - Stability: ⚠️ Experimental (Transferable Streams API)
   *
   * **Trade-offs:**
   * - ✅ Memory efficient: Zero-copy stream transfer when supported
   * - ✅ Non-blocking UI: Parsing runs in worker thread
   * - ✅ Constant memory usage for streaming workloads
   * - ✅ Supports WHATWG Encoding Standard encodings (via TextDecoder)
   * - ✅ Supports all quotation characters
   * - ✅ Automatic fallback to message-streaming on Safari
   * - ⚠️ Experimental API: Transferable Streams may change
   * - ⚠️ Worker communication overhead: Data transfer between threads
   *
   * **Use when:**
   * - Memory efficiency is important
   * - Streaming large CSV files
   * - Chrome/Firefox/Edge browsers (auto-fallback on Safari)
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  memoryEfficient: (options?: WorkerPresetOptions): EngineConfig => ({
    worker: true,
    wasm: false,
    workerStrategy: "stream-transfer",
    ...options,
  }),

  /**
   * Parse speed optimized configuration.
   *
   * **Optimization target:** Parse speed (execution time)
   *
   * **Performance characteristics:**
   * - Parse speed: ✅ Fast (compiled WASM code, no worker overhead)
   * - UI responsiveness: ❌ Blocks main thread
   * - Memory efficiency: Standard
   * - Stability: ✅ Stable (WebAssembly standard)
   *
   * **Trade-offs:**
   * - ✅ Fast parse speed: Compiled WASM code
   * - ✅ No worker initialization overhead
   * - ✅ No worker communication overhead
   * - ⚠️ WASM implementation may change in future versions
   * - ❌ Blocks main thread during parsing
   * - ❌ UTF-8 encoding only
   * - ❌ Double-quote (") only
   * - ❌ Requires loadWASM() initialization
   *
   * **Use when:**
   * - Parse speed is the highest priority
   * - UI blocking is acceptable
   * - UTF-8 CSV files with double-quote
   * - Server-side parsing
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  fast: (options?: MainThreadPresetOptions): EngineConfig => ({
    worker: false,
    wasm: true,
    ...options,
  }),

  /**
   * UI responsiveness + parse speed optimized configuration.
   *
   * **Optimization target:** UI responsiveness + parse speed
   *
   * **Performance characteristics:**
   * - Parse speed: Fast (compiled WASM code) but slower than fast() due to worker overhead
   * - UI responsiveness: ✅ Non-blocking (worker execution)
   * - Memory efficiency: Standard
   * - Stability: ✅ Stable (Web Workers + WebAssembly)
   *
   * **Trade-offs:**
   * - ✅ Non-blocking UI: Parsing runs in worker thread
   * - ✅ Fast parse speed: Compiled WASM code
   * - ⚠️ Worker communication overhead: Slower than fast() on main thread
   * - ⚠️ Requires bundler configuration for worker URL
   * - ⚠️ WASM implementation may change in future versions
   * - ❌ UTF-8 encoding only
   * - ❌ Double-quote (") only
   * - ❌ Requires loadWASM() initialization
   *
   * **Use when:**
   * - Both UI responsiveness and parse speed are important
   * - UTF-8 CSV files with double-quote
   * - Browser applications requiring non-blocking parsing
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  responsiveFast: (options?: WorkerPresetOptions): EngineConfig => ({
    worker: true,
    wasm: true,
    workerStrategy: "message-streaming",
    ...options,
  }),

  /**
   * Balanced configuration.
   *
   * **Optimization target:** Balanced (UI responsiveness + memory efficiency + broad compatibility)
   *
   * **Performance characteristics:**
   * - Parse speed: Slower (worker communication overhead)
   * - UI responsiveness: ✅ Non-blocking (worker execution)
   * - Memory efficiency: ✅ Optimized (zero-copy stream transfer when supported)
   * - Stability: ⚠️ Experimental (Transferable Streams) with stable fallback
   *
   * **Trade-offs:**
   * - ✅ Non-blocking UI: Parsing runs in worker thread
   * - ✅ Memory efficient: Zero-copy stream transfer when supported
   * - ✅ Supports WHATWG Encoding Standard encodings (via TextDecoder)
   * - ✅ Supports all quotation characters
   * - ✅ Automatic fallback to message-streaming on Safari
   * - ✅ Broad compatibility: Handles user uploads with various encodings
   * - ⚠️ Experimental API: Transferable Streams may change
   * - ⚠️ Worker communication overhead: Data transfer between threads
   *
   * **Use when:**
   * - General-purpose CSV processing
   * - Broad encoding support required
   * - Safari compatibility needed (auto-fallback)
   * - User-uploaded files with various encodings
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  balanced: (options?: WorkerPresetOptions): EngineConfig => ({
    worker: true,
    wasm: false,
    workerStrategy: "stream-transfer",
    ...options,
  }),

  /**
   * GPU-accelerated configuration.
   *
   * **Optimization target:** Maximum throughput for large files
   *
   * **Performance characteristics:**
   * - Parse speed: ✅ Extremely fast for large files (GPU parallel processing)
   * - UI responsiveness: ✅ Non-blocking (GPU execution)
   * - Memory efficiency: ✅ Optimized (index-only output)
   * - Stability: ⚠️ Experimental (WebGPU API)
   *
   * **Trade-offs:**
   * - ✅ Extremely fast: GPU parallel index construction (GB/s throughput)
   * - ✅ Low CPU usage: ~10x reduction vs traditional parsers
   * - ✅ Memory efficient: 1/10th memory usage (index-only)
   * - ✅ Non-blocking: Runs on GPU, doesn't block main thread
   * - ✅ Automatic fallback: Falls back to JavaScript if WebGPU unavailable
   * - ✅ Automatic chunk splitting: Large chunks are split to fit GPU limits
   * - ⚠️ GPU initialization overhead: ~50-100ms startup cost
   * - ⚠️ Limited browser support: Chrome 113+, Firefox 121+ (flag), Safari TP
   * - ❌ May be slower than WASM for small files (<1MB)
   *
   * **Use when:**
   * - Processing large CSV files (>10MB)
   * - Maximum throughput is critical
   * - Chrome/Edge browsers (auto-fallback on others)
   * - UI responsiveness and low CPU usage are important
   *
   * @param options - Configuration options
   * @returns Engine configuration
   *
   * @example Basic GPU parsing
   * ```ts
   * import { parseString, EnginePresets } from 'web-csv-toolbox';
   *
   * for await (const record of parseString(csv, {
   *   engine: EnginePresets.gpuAccelerated()
   * })) {
   *   console.log(record);
   * }
   * ```
   *
   * @example With fallback tracking
   * ```ts
   * for await (const record of parseString(csv, {
   *   engine: EnginePresets.gpuAccelerated({
   *     onFallback: (info) => {
   *       console.warn(`GPU unavailable: ${info.reason}`);
   *     }
   *   })
   * })) {
   *   console.log(record);
   * }
   * ```
   */
  gpuAccelerated: (options?: MainThreadPresetOptions): EngineConfig => ({
    worker: false,
    wasm: false,
    gpu: true,
    ...options,
  }),

  /**
   * GPU + WASM hybrid configuration.
   *
   * **Optimization target:** Maximum performance with graceful fallback
   *
   * **Performance characteristics:**
   * - Parse speed: ✅ GPU-fast when available, WASM-fast otherwise
   * - UI responsiveness: ✅ Non-blocking (GPU) or ❌ Blocking (WASM fallback)
   * - Memory efficiency: ✅ Optimized (GPU) or Standard (WASM fallback)
   * - Stability: ⚠️ Experimental (WebGPU) with stable fallback (WASM)
   *
   * **Trade-offs:**
   * - ✅ Best performance: GPU first, then WASM, then JavaScript
   * - ✅ Graceful degradation: Optimal performance on each browser
   * - ✅ Automatic fallback: No manual browser detection needed
   * - ⚠️ Requires loadWASM() initialization for full performance
   * - ⚠️ GPU initialization overhead when available
   * - ❌ Blocks main thread when using WASM fallback
   * - ❌ UTF-8 only when using WASM fallback
   *
   * **Use when:**
   * - Maximum performance is critical across all browsers
   * - Large files on modern browsers, acceptable performance elsewhere
   * - Willing to accept WASM limitations as fallback
   *
   * @param options - Configuration options
   * @returns Engine configuration
   *
   * @example GPU with WASM fallback
   * ```ts
   * import { loadWASM, parseString, EnginePresets } from 'web-csv-toolbox';
   *
   * // Initialize WASM for fallback
   * await loadWASM();
   *
   * for await (const record of parseString(csv, {
   *   engine: EnginePresets.ultraFast()
   * })) {
   *   console.log(record);
   * }
   * ```
   */
  ultraFast: (options?: MainThreadPresetOptions): EngineConfig => ({
    worker: false,
    wasm: true,
    gpu: true,
    ...options,
  }),
} as const);

/**
 * Type for engine preset names.
 */
export type EnginePresetName = keyof typeof EnginePresets;
