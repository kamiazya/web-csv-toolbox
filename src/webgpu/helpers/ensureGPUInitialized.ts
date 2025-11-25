/**
 * Ensure GPU is initialized
 *
 * Auto-initializes if not already initialized.
 * Used internally by parser functions.
 */

import { isInitialized } from "@/webgpu/helpers/internal/gpuState.ts";
import { loadGPU } from "@/webgpu/helpers/loadGPU.ts";

/**
 * Ensure GPU is initialized
 *
 * Auto-initializes if not already initialized.
 * Used internally by parser functions.
 *
 * @internal
 */
export async function ensureGPUInitialized(): Promise<void> {
  if (!isInitialized()) {
    await loadGPU();
  }
}
