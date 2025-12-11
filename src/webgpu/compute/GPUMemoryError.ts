/**
 * GPU Memory Allocation Error
 *
 * Thrown when GPU buffer allocation fails due to memory pressure or device limits.
 * This error should trigger fallback to WASM or JavaScript execution.
 */
export class GPUMemoryError extends Error {
  /**
   * Requested buffer size that failed to allocate
   */
  readonly requestedSize: number;

  /**
   * Buffer name that failed to allocate
   */
  readonly bufferName?: string;

  /**
   * Original error from WebGPU
   */
  readonly cause?: Error;

  constructor(message: string, options?: {
    requestedSize: number;
    bufferName?: string;
    cause?: Error;
  }) {
    super(message);
    this.name = "GPUMemoryError";
    this.requestedSize = options?.requestedSize ?? 0;
    this.bufferName = options?.bufferName;
    this.cause = options?.cause;

    // Maintain proper stack trace for debugging (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GPUMemoryError);
    }
  }
}
