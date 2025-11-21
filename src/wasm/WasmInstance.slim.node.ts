/**
 * WASM instance management for slim version (Node.js optimized).
 *
 * **Key Differences from `WasmInstance.slim.ts`:**
 * - `loadWASM(input?)`: `input` parameter is **optional** (Node.js can auto-resolve via package exports)
 * - Build-time resolution: Vite plugin resolves `#/wasm/loaders/loadWASM.js` to `loadWASM.node.ts`
 * - WASM loader: Uses `loadWASM.node.ts` (fs.readFile with package export resolution)
 *
 * **Why separate files are needed:**
 * - Different function signatures (required vs optional parameter)
 * - Environment-specific WASM loading strategies
 * - Build-time import path resolution based on file name
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
