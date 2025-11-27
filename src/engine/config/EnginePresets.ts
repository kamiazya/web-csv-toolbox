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

  /**
   * Override the optimization hint for the preset.
   * If not specified, uses the preset's default optimization hint.
   */
  optimizationHint?: OptimizationHint;

  /**
   * Callback for fallback notifications.
   * Called when the engine falls back to a less optimal strategy.
   *
   * @example
   * ```ts
   * engine: EnginePresets.turbo({
   *   onFallback: (info) => {
   *     console.warn(`Fallback: ${info.reason}`);
   *   }
   * })
   * ```
   */
  onFallback?: (info: EngineFallbackInfo) => void;
}

/**
 * Options for worker-based engine presets.
 */
export interface WorkerPresetOptions extends PresetOptions {
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
}

/**
 * Predefined engine configuration presets.
 *
 * Three simple presets optimized for different priorities:
 * - `stable()`: Maximum compatibility
 * - `recommended()`: UI responsiveness + good performance (default choice)
 * - `turbo()`: Maximum speed
 *
 * @example Basic usage
 * ```ts
 * import { parseString, EnginePresets } from 'web-csv-toolbox';
 *
 * // Recommended for most use cases
 * for await (const record of parseString(csv, {
 *   engine: EnginePresets.recommended()
 * })) {
 *   console.log(record);
 * }
 * ```
 *
 * @example With fallback tracking
 * ```ts
 * for await (const record of parseString(csv, {
 *   engine: EnginePresets.turbo({
 *     onFallback: (info) => console.warn(info.reason)
 *   })
 * })) {
 *   console.log(record);
 * }
 * ```
 */
export const EnginePresets = Object.freeze({
  /**
   * Maximum compatibility configuration.
   *
   * Uses only standard JavaScript APIs for maximum compatibility.
   * Runs on main thread (blocking).
   *
   * **Backend:** 🥇 JS
   * **Context:** 🖥️ Main thread
   *
   * **Use when:**
   * - Server-side parsing (Node.js, Deno)
   * - Maximum compatibility required
   * - UI blocking is acceptable
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  stable: (options?: PresetOptions): EngineConfig => ({
    worker: false,
    wasm: false,
    gpu: false,
    optimizationHint: options?.optimizationHint ?? "responsive",
    ...options,
  }),

  /**
   * Recommended default configuration.
   *
   * Balances UI responsiveness and performance.
   * Uses WASM for speed, Worker for non-blocking UI.
   * Automatically falls back when features are unavailable.
   *
   * **Backend:** 🥇 WASM → 🥈 JS
   * **Context:** 👷 Worker → 🖥️ Main (fallback)
   *
   * **Use when:**
   * - Browser applications (recommended default)
   * - UI responsiveness is important
   * - Good performance without blocking
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  recommended: (options?: WorkerPresetOptions): EngineConfig => ({
    worker: true,
    wasm: true,
    gpu: false,
    workerStrategy: "stream-transfer",
    optimizationHint: options?.optimizationHint ?? "balanced",
    ...options,
  }),

  /**
   * Maximum speed configuration.
   *
   * Uses GPU acceleration when available, with WASM and JS fallbacks.
   * Runs on main thread for maximum throughput.
   *
   * **Backend:** 🥇 GPU → 🥈 WASM → 🥉 JS
   * **Context:** 🖥️ Main thread
   *
   * **Use when:**
   * - Processing large CSV files (>10MB)
   * - Maximum throughput is critical
   * - UI blocking is acceptable
   *
   * @param options - Configuration options
   * @returns Engine configuration
   */
  turbo: (options?: PresetOptions): EngineConfig => ({
    worker: false,
    wasm: true,
    gpu: true,
    optimizationHint: options?.optimizationHint ?? "speed",
    ...options,
  }),

  // ============================================
  // Deprecated aliases (for backward compatibility)
  // ============================================

  /**
   * @deprecated Use `recommended()` instead.
   */
  balanced: (options?: WorkerPresetOptions): EngineConfig =>
    EnginePresets.recommended(options),

  /**
   * @deprecated Use `recommended()` instead.
   */
  responsive: (options?: WorkerPresetOptions): EngineConfig =>
    EnginePresets.recommended(options),

  /**
   * @deprecated Use `recommended()` instead.
   */
  memoryEfficient: (options?: WorkerPresetOptions): EngineConfig =>
    EnginePresets.recommended(options),

  /**
   * @deprecated Use `turbo()` instead.
   */
  fast: (options?: PresetOptions): EngineConfig => EnginePresets.turbo(options),

  /**
   * @deprecated Use `turbo()` instead.
   */
  responsiveFast: (options?: WorkerPresetOptions): EngineConfig =>
    EnginePresets.turbo(options),

  /**
   * @deprecated Use `turbo()` instead.
   */
  gpuAccelerated: (options?: PresetOptions): EngineConfig =>
    EnginePresets.turbo(options),

  /**
   * @deprecated Use `turbo()` instead.
   */
  ultraFast: (options?: PresetOptions): EngineConfig =>
    EnginePresets.turbo(options),
} as const);

/**
 * Type for engine preset names.
 */
export type EnginePresetName = keyof typeof EnginePresets;

/**
 * Type for main preset names (excluding deprecated aliases).
 */
export type MainPresetName = "stable" | "recommended" | "turbo";

// Re-export option types for backward compatibility
/** @deprecated Use PresetOptions instead */
export type MainThreadPresetOptions = PresetOptions;
