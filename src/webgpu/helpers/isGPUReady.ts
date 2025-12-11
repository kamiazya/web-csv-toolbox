/**
 * Check if GPU is ready
 */

import { isInitialized } from "@/webgpu/helpers/internal/gpuState.ts";

/**
 * Check if GPU is ready
 *
 * @returns True if GPU device is initialized and ready
 *
 * @example
 * ```ts
 * import { isGPUReady } from 'web-csv-toolbox';
 *
 * if (isGPUReady()) {
 *   console.log('GPU is ready');
 * }
 * ```
 */
export function isGPUReady(): boolean {
  return isInitialized();
}
