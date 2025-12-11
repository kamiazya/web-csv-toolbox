/**
 * Reset GPU initialization state
 *
 * @internal This function is for internal use only.
 */

import { resetInit } from "@/webgpu/helpers/internal/gpuState.ts";

/**
 * Reset GPU initialization state
 *
 * Similar to disposeGPU but doesn't destroy the device.
 * Useful for testing.
 *
 * @internal
 */
export function resetGPUInit(): void {
  resetInit();
}
