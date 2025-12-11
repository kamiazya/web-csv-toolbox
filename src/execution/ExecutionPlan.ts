/**
 * Execution Plan Types
 *
 * Defines the execution strategy selected by ExecutionPathResolver
 * based on environment capabilities and optimization hints.
 */

/**
 * Backend type - determines which parsing engine to use
 *
 * - `js`: Pure JavaScript parser (slowest, most compatible)
 * - `wasm`: WebAssembly parser (fast, good compatibility)
 * - `gpu`: WebGPU parser (fastest, requires GPU support)
 */
export type BackendType = "js" | "wasm" | "gpu";

/**
 * Context type - determines where parsing happens
 *
 * - `main`: Main thread execution (blocks UI)
 * - `worker-stream-transfer`: Worker with transferable streams (efficient)
 * - `worker-message`: Worker with message passing (compatible)
 */
export type ContextType = "main" | "worker-stream-transfer" | "worker-message";

/**
 * Input type - determines the input format
 *
 * - `string`: String input (in-memory)
 * - `binary`: Uint8Array/ArrayBuffer input (in-memory)
 * - `string-stream`: ReadableStream<string> input (streaming)
 * - `binary-stream`: ReadableStream<Uint8Array> input (streaming)
 */
export type InputType =
  | "string"
  | "binary"
  | "string-stream"
  | "binary-stream";

/**
 * GPU backend configuration
 */
export interface GPUBackendConfig {
  /**
   * Workgroup size for GPU compute shaders
   * Larger values may improve throughput but increase memory usage
   */
  workgroupSize: number;

  /**
   * GPU device preference
   * - `high-performance`: Prefer discrete GPU
   * - `low-power`: Prefer integrated GPU
   * - `balanced`: Balanced power/performance (custom, maps to default)
   */
  devicePreference: "high-performance" | "low-power" | "balanced";
}

/**
 * Execution plan - ordered list of backends and contexts to try
 *
 * The resolver will attempt each combination in priority order
 * until one succeeds or all fail.
 */
export interface ExecutionPlan {
  /**
   * Ordered list of backends to try (most preferred first)
   */
  backends: BackendType[];

  /**
   * Ordered list of contexts to try (most preferred first)
   */
  contexts: ContextType[];

  /**
   * GPU-specific configuration (only used if GPU backend is attempted)
   */
  gpuConfig?: GPUBackendConfig;
}
