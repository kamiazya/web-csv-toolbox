/**
 * Check if GPU parsing is available
 */

import { isWebGPUAvailable } from "@/webgpu/helpers/isWebGPUAvailable.ts";

/**
 * Check if GPU parsing is available in the current environment
 *
 * @returns true if WebGPU is available
 */
export function isGPUAvailable(): boolean {
  return isWebGPUAvailable();
}

// Re-export for convenience
export { isWebGPUAvailable };
