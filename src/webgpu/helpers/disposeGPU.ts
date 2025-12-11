/**
 * Dispose GPU resources
 */

import { disposeGPUInternal } from "@/webgpu/helpers/internal/gpuState.ts";

/**
 * Dispose GPU resources
 *
 * Destroys the GPU device and releases resources.
 * After calling this, you must call loadGPU() again to use GPU.
 *
 * @remarks
 * Useful for:
 * - Manual cleanup when GPU is no longer needed
 * - Testing scenarios
 * - Memory management in long-running applications
 *
 * @example
 * ```ts
 * import { disposeGPU, loadGPU } from 'web-csv-toolbox';
 *
 * // Use GPU
 * await loadGPU();
 * // ... parse CSV files ...
 *
 * // Cleanup when done
 * disposeGPU();
 *
 * // Later, reinitialize if needed
 * await loadGPU();
 * ```
 */
export function disposeGPU(): void {
  disposeGPUInternal();
}
