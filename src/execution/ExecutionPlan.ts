/**
 * Execution plan types for priority-based path selection.
 *
 * @module
 */

/**
 * Backend types for CSV parsing.
 *
 * - `gpu`: WebGPU-accelerated parsing (fastest for large files)
 * - `wasm`: WebAssembly parsing (fast, UTF-8 only)
 * - `js`: Pure JavaScript parsing (always available)
 */
export type BackendType = "gpu" | "wasm" | "js";

/**
 * Execution context types.
 *
 * - `main`: Main thread execution
 * - `worker-stream-transfer`: Worker with TransferableStream (zero-copy)
 * - `worker-message`: Worker with message-based communication
 */
export type ContextType = "main" | "worker-stream-transfer" | "worker-message";

/**
 * Input types for execution path resolution.
 */
export type InputType = "string" | "binary" | "string-stream" | "binary-stream";

/**
 * GPU backend configuration.
 */
export interface GPUBackendConfig {
  /**
   * Workgroup size for GPU compute shaders.
   *
   * Larger values increase throughput but use more memory.
   */
  workgroupSize: 32 | 64 | 128 | 256 | 512;

  /**
   * Device selection preference.
   *
   * - `high-performance`: Prefer discrete GPU
   * - `low-power`: Prefer integrated GPU
   * - `balanced`: Let browser decide
   */
  devicePreference: "high-performance" | "low-power" | "balanced";
}

/**
 * Execution plan with prioritized backend and context lists.
 *
 * @remarks
 * The caller should try `backends[0]` first, then fall back to subsequent
 * entries on failure. Similarly for `contexts`.
 *
 * @example
 * ```typescript
 * const plan = resolver.resolve(ctx);
 * // plan.backends = ["gpu", "wasm", "js"]
 * // plan.contexts = ["worker-stream-transfer", "worker-message", "main"]
 *
 * for (const backend of plan.backends) {
 *   try {
 *     await execute(backend);
 *     break;
 *   } catch {
 *     continue; // Try next backend
 *   }
 * }
 * ```
 */
export interface ExecutionPlan {
  /**
   * Prioritized list of backends to try (first is highest priority).
   *
   * Contains only available backends based on environment and options.
   */
  backends: BackendType[];

  /**
   * Prioritized list of contexts to try (first is highest priority).
   *
   * Contains only available contexts based on environment and options.
   */
  contexts: ContextType[];

  /**
   * GPU configuration (only if `backends` includes "gpu").
   */
  gpuConfig?: GPUBackendConfig;
}

/**
 * Target of execution (for fallback reporting).
 */
export interface ExecutionTarget {
  /** Backend type */
  backend: BackendType;

  /** Context type (optional, for more detailed reporting) */
  context?: ContextType;
}
