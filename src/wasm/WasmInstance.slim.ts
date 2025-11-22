/**
 * WASM instance management for slim version (Browser/Web optimized).
 *
 * **Key Differences from `WasmInstance.slim.node.ts`:**
 * - `loadWASM(input)`: `input` parameter is **required** (Web needs explicit WASM URL)
 * - Build-time resolution: Vite plugin resolves `#/wasm/loaders/loadWASM.js` to `loadWASM.web.ts`
 * - WASM loader: Uses `loadWASM.web.ts` (streaming fetch)
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
} from "#/wasm/loaders/loadWASM.js";

export * from "web-csv-toolbox-wasm";

export { isInitialized, resetInit } from "#/wasm/loaders/loadWASM.js";

/**
 * Load and initialize the WebAssembly module using streaming (slim entry).
 *
 * You MUST call this function with a WASM URL before using WASM-based synchronous APIs
 * like `parseStringToArraySyncWASM`.
 *
 * @param input - WASM module URL (required for slim entry)
 */
export async function loadWASM(input: InitInput): Promise<void> {
  if (isInitialized()) return;
  await internalLoadWASM(input);
}

export function isWASMReady(): boolean {
  return isInitialized();
}

export async function ensureWASMInitialized(input: InitInput): Promise<void> {
  if (!isInitialized()) {
    await loadWASM(input);
  }
}
