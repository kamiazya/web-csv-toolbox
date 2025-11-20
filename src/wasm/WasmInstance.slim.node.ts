/**
 * WASM instance management for slim version (Node.js optimized).
 *
 * **Note:** This file has an identical implementation to `WasmInstance.slim.ts`, but they must be
 * kept separate due to build-time loader resolution.
 */
import type { InitInput } from "web-csv-toolbox-wasm";
import {
  loadWASM as internalLoadWASM,
  isInitialized,
  resetInit,
} from "#/wasm/loaders/loadWASM.js";

export * from "web-csv-toolbox-wasm";
export { isInitialized, resetInit };

export async function loadWASM(input?: InitInput): Promise<void> {
  if (isInitialized()) return;
  await internalLoadWASM(input);
}

/**
 * Ensure WASM module is initialized. Auto-initializes if not already initialized.
 *
 * @param input - Optional `InitInput` or module path for WASM initialization. Auto-detects if not provided.
 * @internal
 */
export async function ensureWASMInitialized(input?: InitInput): Promise<void> {
  if (!isInitialized()) {
    await loadWASM(input);
  }
}

export function isWASMReady(): boolean {
  return isInitialized();
}
