import type {
  BackpressureCheckInterval,
  EngineConfig,
  EngineFallbackInfo,
  QueuingStrategyConfig,
  WorkerPool,
} from "@/core/types.ts";
import type { OptimizationHint } from "@/execution/OptimizationHint.ts";

/**
 * Common options shared by all engine presets.
 */
export interface PresetOptions {
  arrayBufferThreshold?: number;
  backpressureCheckInterval?: BackpressureCheckInterval;
  queuingStrategy?: QueuingStrategyConfig;
  optimizationHint?: OptimizationHint;
  onFallback?: (info: EngineFallbackInfo) => void;
}

/**
 * Options for worker-based engine presets.
 */
export interface WorkerPresetOptions extends PresetOptions {
  workerPool?: WorkerPool;
  workerURL?: string | URL;
}

/**
 * Predefined engine configuration presets.
 *
 * Three simple presets optimized for different priorities:
 * - `stable()`: Maximum compatibility (main thread, JS only)
 * - `recommended()`: UI responsiveness (worker + JS, non-blocking)
 * - `turbo()`: Maximum speed (GPU + JS, with automatic backend selection)
 */
export const EnginePresets = Object.freeze({
  /**
   * Maximum compatibility configuration.
   *
   * Uses only standard JavaScript APIs for maximum compatibility.
   * Runs on main thread (blocking).
   *
   * **Backend:** JS only
   * **Context:** Main thread
   * **Optimization:** Responsive (minimal overhead)
   *
   * **Use when:**
   * - Server-side parsing (Node.js, Deno, Bun)
   * - Maximum compatibility required
   * - Small to medium files (<100MB)
   * - UI blocking is acceptable
   *
   * @example
   * ```ts
   * import { parseString, EnginePresets } from 'web-csv-toolbox';
   *
   * const records = await parseString.toArray(csv, {
   *   engine: EnginePresets.stable()
   * });
   * ```
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  stable: (options?: PresetOptions): EngineConfig => ({
    worker: false,
    wasm: false,
    optimizationHint: options?.optimizationHint ?? "responsive",
    ...options,
  }),

  /**
   * Recommended default configuration.
   *
   * Balances UI responsiveness and performance.
   * Uses Worker to prevent UI blocking, JS backend for speed.
   * Automatically falls back when Worker is unavailable.
   *
   * **Backend:** JS
   * **Context:** Worker (non-blocking) → Main (fallback)
   * **Optimization:** Balanced
   *
   * **Use when:**
   * - Browser applications (recommended default)
   * - UI responsiveness is critical
   * - Good performance without blocking
   * - Medium to large files
   *
   * @example
   * ```ts
   * import { parseString, EnginePresets } from 'web-csv-toolbox';
   *
   * for await (const record of parseString(csv, {
   *   engine: EnginePresets.recommended()
   * })) {
   *   // Process without blocking UI
   *   console.log(record);
   * }
   * ```
   *
   * @param options - Configuration options including worker pool and URL
   * @returns Engine configuration
   */
  recommended: (options?: WorkerPresetOptions): EngineConfig => ({
    worker: true,
    wasm: false, // JS is faster than WASM for most use cases
    workerStrategy: "stream-transfer",
    optimizationHint: options?.optimizationHint ?? "balanced",
    ...options,
  }),

  /**
   * Maximum speed configuration.
   *
   * Enables GPU acceleration with automatic fallback to JS.
   * Runs on main thread for maximum throughput.
   *
   * **Backend:** GPU → JS (automatic selection based on file size and capabilities)
   * **Context:** Main thread (maximum throughput)
   * **Optimization:** Speed
   *
   * **Use when:**
   * - Maximum throughput is critical
   * - UI blocking is acceptable
   * - Processing large files where GPU can provide benefits
   * - Chrome/Edge browser (GPU support, auto-fallback on other browsers)
   *
   * @example
   * ```ts
   * import { parseString, EnginePresets } from 'web-csv-toolbox';
   *
   * // Automatic backend selection (GPU when beneficial, JS fallback)
   * const records = await parseString.toArray(csv, {
   *   engine: EnginePresets.turbo({
   *     onFallback: (info) => {
   *       console.log('Fallback reason:', info.reason);
   *     }
   *   })
   * });
   * ```
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  turbo: (options?: PresetOptions): EngineConfig => ({
    worker: false,
    wasm: false, // JS is faster than WASM for most use cases
    gpu: true,
    optimizationHint: options?.optimizationHint ?? "speed",
    ...options,
  }),
} as const);

/**
 * Type for engine preset names.
 */
export type EnginePresetName = keyof typeof EnginePresets;
