/**
 * Wasm instance management for slim version (Node.js optimized).
 *
 * **Key Differences from `WasmInstance.slim.ts`:**
 * - `loadWasm(input?)`: `input` parameter is **optional** (Node.js can auto-resolve via package exports)
 * - Build-time resolution: Vite plugin resolves `#/wasm/loaders/loadWasm.js` to `loadWasm.node.ts`
 * - Wasm loader: Uses `loadWasm.node.ts` (fs.readFile with package export resolution)
 *
 * **Why separate files are needed:**
 * - Different function signatures (required vs optional parameter)
 * - Environment-specific Wasm loading strategies
 * - Build-time import path resolution based on file name
 */
import type { InitInput } from "web-csv-toolbox-wasm";
import {
  loadWasm as internalLoadWasm,
  isInitialized,
  resetInit,
} from "#/wasm/loaders/loadWasm.js";

export * from "web-csv-toolbox-wasm";
export { isInitialized, resetInit };

export async function loadWasm(input?: InitInput): Promise<void> {
  if (isInitialized()) return;
  await internalLoadWasm(input);
}

/**
 * Ensure Wasm module is initialized. Auto-initializes if not already initialized.
 *
 * @param input - Optional `InitInput` or module path for Wasm initialization. Auto-detects if not provided.
 * @internal
 */
export async function ensureWasmInitialized(input?: InitInput): Promise<void> {
  if (!isInitialized()) {
    await loadWasm(input);
  }
}

export function isWasmReady(): boolean {
  return isInitialized();
}
