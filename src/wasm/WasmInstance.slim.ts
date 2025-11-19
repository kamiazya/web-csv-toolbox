/**
 * WASM instance management for slim version (Browser/Web optimized).
 *
 * **Note:** This file has an identical implementation to `WasmInstance.slim.node.ts`, but they must be
 * kept separate because:
 * - Build-time resolution: Vite plugin resolves `#/wasm/loaders/*` imports differently based on entry file name
 * - WASM loader selection: `.ts` (web) → uses `loadWASM.web.ts` (streaming fetch)
 *                          `.node.ts` → uses `loadWASM.node.ts` (fs.readFile)
 * - The import paths are embedded during build, so runtime conditional exports alone cannot fix this
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
