/**
 * Generic GPU Compute Backend Interface
 *
 * Defines the contract for GPU compute operations.
 * Implementations can provide specific algorithms (e.g., CSV indexing, matrix operations).
 */

/**
 * Configuration for GPU compute backend
 */
export interface GPUComputeBackendConfig {
  /**
   * GPU device to use
   * If not provided, backend will request its own device
   */
  device?: GPUDevice;

  /**
   * Whether to enable debug timing
   * @default false
   */
  enableTiming?: boolean;

  /**
   * Label for debugging
   */
  label?: string;
}

/**
 * Result of a compute dispatch operation
 */
export interface ComputeDispatchResult<T = unknown> {
  /**
   * The computed result data
   */
  data: T;

  /**
   * Timing information (if enabled)
   */
  timing?: ComputeTiming;
}

/**
 * Timing information for compute operations
 */
export interface ComputeTiming {
  /**
   * Total dispatch time in milliseconds
   */
  totalMs: number;

  /**
   * Breakdown of individual phases (implementation-specific)
   */
  phases?: Record<string, number>;
}

/**
 * Generic GPU Compute Backend Interface
 *
 * Provides a common contract for GPU compute operations.
 * Each implementation handles specific algorithms and data formats.
 *
 * Implements `AsyncDisposable` for automatic resource cleanup with `await using`.
 *
 * @typeParam TInput - Input data type for dispatch
 * @typeParam TUniforms - Uniforms/parameters type
 * @typeParam TResult - Result data type
 *
 * @example
 * ```ts
 * // Automatic resource management with await using
 * await using backend = new CSVIndexingBackend();
 * await backend.initialize();
 * const result = await backend.dispatch(data, uniforms);
 * // backend.destroy() is automatically called when scope exits
 * ```
 *
 * @example
 * ```ts
 * // Manual lifecycle management
 * const backend = new CSVIndexingBackend();
 * try {
 *   await backend.initialize();
 *   const result = await backend.dispatch(data, uniforms);
 * } finally {
 *   await backend.destroy();
 * }
 * ```
 */
export interface GPUComputeBackend<
  TInput = Uint8Array,
  TUniforms = unknown,
  TResult = unknown,
> extends AsyncDisposable {
  /**
   * Initialize the backend
   *
   * Sets up GPU device, compiles shaders, creates pipelines.
   * Must be called before dispatch().
   *
   * @throws Error if GPU initialization fails
   */
  initialize(): Promise<void>;

  /**
   * Check if backend is initialized and ready
   */
  readonly isInitialized: boolean;

  /**
   * Dispatch a compute operation
   *
   * @param input - Input data to process
   * @param uniforms - Uniforms/parameters for the compute shader
   * @returns Promise resolving to compute result
   * @throws Error if not initialized or dispatch fails
   */
  dispatch(
    input: TInput,
    uniforms: TUniforms,
  ): Promise<ComputeDispatchResult<TResult>>;

  /**
   * Destroy the backend and release GPU resources
   *
   * After calling destroy(), the backend cannot be used.
   * Call initialize() again to reuse.
   */
  destroy(): Promise<void>;
}

/**
 * Base configuration for multi-pass compute backends
 */
export interface MultiPassComputeConfig extends GPUComputeBackendConfig {
  /**
   * Number of compute passes
   */
  passCount: number;
}

/**
 * Interface for backends that use multiple compute passes
 *
 * Some algorithms require multiple GPU passes with CPU interleaving.
 * This interface provides hooks for each phase.
 *
 * @typeParam TInput - Input data type
 * @typeParam TIntermediate - Intermediate result between passes
 * @typeParam TResult - Final result type
 */
export interface MultiPassGPUComputeBackend<
  TInput = Uint8Array,
  TIntermediate = unknown,
  TResult = unknown,
> extends GPUComputeBackend<TInput, unknown, TResult> {
  /**
   * Execute first pass of computation
   *
   * @param input - Input data
   * @returns Intermediate result for CPU processing
   */
  executePass1(input: TInput): Promise<TIntermediate>;

  /**
   * CPU-side computation between passes
   *
   * @param intermediateResult - Result from pass 1
   * @returns Data to feed into pass 2
   */
  cpuInterleave(intermediateResult: TIntermediate): Promise<unknown>;

  /**
   * Execute second pass of computation
   *
   * @param cpuResult - Result from CPU interleaving
   * @returns Final computation result
   */
  executePass2(cpuResult: unknown): Promise<TResult>;
}
