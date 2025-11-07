import type {
  BackpressureCheckInterval,
  EngineConfig,
  EngineFallbackInfo,
  QueuingStrategyConfig,
} from "../common/types.ts";
import type { WorkerPool } from "./worker/helpers/WorkerPool.ts";

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
  // No worker-related options
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
 * Predefined engine configuration presets for common use cases.
 *
 * All presets are functions that optionally accept configuration options.
 *
 * @example Basic usage
 * ```ts
 * import { parseString, EnginePresets } from 'web-csv-toolbox';
 *
 * // Use fastest available execution method
 * for await (const record of parseString(csv, {
 *   engine: EnginePresets.fastest()
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
 *   engine: EnginePresets.fastest({ workerPool: pool })
 * })) {
 *   console.log(record);
 * }
 * ```
 */
export const EnginePresets = Object.freeze({
  /**
   * Main thread execution (default).
   * - No worker overhead
   * - Synchronous execution on main thread
   * - Best for small files (< 1MB)
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  mainThread: (options?: MainThreadPresetOptions): EngineConfig => ({
    worker: false,
    wasm: false,
    ...options,
  }),

  /**
   * Worker execution with message streaming.
   * - Offloads parsing to worker thread
   * - Records sent via postMessage
   * - Works on all browsers including Safari
   * - Best for medium files (1-10MB)
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  worker: (options?: WorkerPresetOptions): EngineConfig => ({
    worker: true,
    wasm: false,
    workerStrategy: "message-streaming",
    ...options,
  }),

  /**
   * Worker execution with stream transfer (zero-copy).
   * - Offloads parsing to worker thread
   * - Streams transferred directly (zero-copy)
   * - Only works on Chrome, Firefox, Edge (not Safari)
   * - Best for large streaming files (> 10MB)
   * - Automatically falls back to message-streaming if not supported
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  workerStreamTransfer: (options?: WorkerPresetOptions): EngineConfig => ({
    worker: true,
    wasm: false,
    workerStrategy: "stream-transfer",
    ...options,
  }),

  /**
   * WebAssembly execution on main thread.
   * - Fast parsing with WASM
   * - Runs on main thread
   * - Limited to UTF-8 encoding and double-quote (")
   * - Best for medium-sized UTF-8 files (1-10MB)
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  wasm: (options?: MainThreadPresetOptions): EngineConfig => ({
    worker: false,
    wasm: true,
    ...options,
  }),

  /**
   * Worker + WASM execution.
   * - Combines worker offloading with WASM speed
   * - Best for large UTF-8 files (> 10MB)
   * - Limited to UTF-8 encoding and double-quote (")
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  workerWasm: (options?: WorkerPresetOptions): EngineConfig => ({
    worker: true,
    wasm: true,
    workerStrategy: "message-streaming",
    ...options,
  }),

  /**
   * Fastest available method.
   * Automatically selects the best execution strategy:
   * - For streams: Worker with stream-transfer (falls back to message-streaming)
   * - For strings/binary: Worker + WASM
   * - For all inputs: Offloads to worker for better performance
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  fastest: (options?: WorkerPresetOptions): EngineConfig => ({
    worker: true,
    wasm: true,
    workerStrategy: "stream-transfer",
    ...options,
  }),

  /**
   * Balanced configuration for production use.
   * - Worker execution for offloading
   * - No WASM (broader encoding support)
   * - Stream-transfer with automatic fallback
   * - Works with all encodings
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
   * Strict mode: no automatic fallbacks.
   * - Throws errors instead of falling back to main thread
   * - Useful for testing or when you need guaranteed execution mode
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  strict: (options?: WorkerPresetOptions): EngineConfig => ({
    worker: true,
    wasm: false,
    workerStrategy: "stream-transfer",
    strict: true,
    ...options,
  }),
} as const);

/**
 * Type for engine preset names.
 */
export type EnginePresetName = keyof typeof EnginePresets;
