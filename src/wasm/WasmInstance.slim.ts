/**
 * Wasm instance management for slim version (Browser/Web optimized).
 *
 * **Key Differences from `WasmInstance.slim.node.ts`:**
 * - `loadWasm(input)`: `input` parameter is **required** (Web needs explicit Wasm URL)
 * - Build-time resolution: Vite plugin resolves `#/wasm/loaders/loadWasm.js` to `loadWasm.web.ts`
 * - Wasm loader: Uses `loadWasm.web.ts` (streaming fetch)
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
} from "#/wasm/loaders/loadWasm.js";

export * from "web-csv-toolbox-wasm";

export { isInitialized, resetInit } from "#/wasm/loaders/loadWasm.js";

/**
 * Load and initialize the WebAssembly module using streaming (slim entry).
 *
 * You MUST call this function with a Wasm URL before using Wasm-based APIs
 * with `{ engine: { wasm: true } }` option.
 *
 * @param input - Wasm module URL (required for slim entry)
 */
export async function loadWasm(input: InitInput): Promise<void> {
  if (isInitialized()) return;
  await internalLoadWasm(input);
}

export function isWasmReady(): boolean {
  return isInitialized();
}

export async function ensureWasmInitialized(input: InitInput): Promise<void> {
  if (!isInitialized()) {
    await loadWasm(input);
  }
}
