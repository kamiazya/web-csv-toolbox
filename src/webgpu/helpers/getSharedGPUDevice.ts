/**
 * Get the shared GPU device
 */

import { getGPUDevice } from "@/webgpu/helpers/internal/gpuState.ts";

/**
 * Get the shared GPU device
 *
 * Returns null if GPU is not initialized.
 * Use loadGPU() to initialize first.
 *
 * @returns GPU device or null
 *
 * @example
 * ```ts
 * import { getSharedGPUDevice, loadGPU } from 'web-csv-toolbox';
 *
 * await loadGPU();
 * const device = getSharedGPUDevice();
 *
 * if (device) {
 *   // Use device for custom GPU operations
 * }
 * ```
 */
export function getSharedGPUDevice(): GPUDevice | null {
  return getGPUDevice();
}
