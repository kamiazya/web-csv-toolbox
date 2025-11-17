/**
 * WASM instance management for lite version (Browser/Web optimized).
 *
 * **Note:** This file has an identical implementation to `WasmInstance.lite.node.ts`, but they must be
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

/**
 * Re-export all WASM functions from this module to ensure they share the same WASM instance.
 *
 * Why this is necessary:
 * 1. The loaders call init() which initializes the WASM module's internal global state
 * 2. If WASM functions are imported directly from "web-csv-toolbox-wasm" elsewhere,
 *    they may reference a different module context in some environments (e.g., test runners)
 * 3. This can lead to errors like "Cannot read properties of undefined (reading '__wbindgen_malloc')"
 *    because the WASM instance accessed by those functions hasn't been initialized
 * 4. By re-exporting all functions from the same module that handles initialization,
 *    we ensure they always reference the same initialized WASM instance
 *
 * Using `export *` instead of individual named exports:
 * - Automatically includes all current and future WASM functions
 * - No maintenance needed when new functions are added to web-csv-toolbox-wasm
 * - Maintains type safety through TypeScript's type inference
 */
export * from "web-csv-toolbox-wasm";

/**
 * Re-export state management functions.
 * This provides a unified API for all WASM-related functionality.
 */
export { isInitialized, resetInit } from "#/wasm/loaders/loadWASM.js";

/**
 * Load and initialize the WebAssembly module using streaming.
 *
 * **REQUIRED for `/lite` version:**
 * You MUST call this function with a WASM URL before using WASM-based synchronous APIs
 * like `parseStringToArraySyncWASM`.
 *
 * **How it works:**
 * - Browser: Fetches WASM from network using streaming initialization
 * - Node.js: Reads WASM from file system
 * - Bundle size: Does NOT include base64-inlined WASM (~110KB saved)
 *
 * @param input - WASM module URL (required for lite version)
 *
 * @example From npm package (recommended)
 * ```ts
 * import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox/lite';
 * import wasmUrl from 'web-csv-toolbox/csv.wasm?url';
 *
 * // REQUIRED: Initialize WASM with URL
 * await loadWASM(wasmUrl);
 *
 * // Now you can use sync WASM APIs
 * const result = parseStringToArraySyncWASM(csv);
 * ```
 *
 * @example Custom WASM URL
 * ```ts
 * import { loadWASM } from 'web-csv-toolbox/lite';
 *
 * // Load from custom URL (e.g., CDN)
 * await loadWASM('https://cdn.example.com/csv.wasm');
 * ```
 */
export async function loadWASM(input: InitInput): Promise<void> {
  if (isInitialized()) {
    return;
  }

  await internalLoadWASM(input);
}

/**
 * Check if WASM module is ready.
 *
 * @returns True if WASM is initialized
 *
 * @example
 * ```ts
 * import { isWASMReady, loadWASM } from 'web-csv-toolbox/lite';
 *
 * if (!isWASMReady()) {
 *   await loadWASM();
 * }
 * ```
 */
export function isWASMReady(): boolean {
  return isInitialized();
}

/**
 * Ensure WASM module is initialized.
 * Auto-initializes if not already initialized.
 *
 * @param input - WASM module URL (required for lite version)
 * @internal
 */
export async function ensureWASMInitialized(input: InitInput): Promise<void> {
  if (!isInitialized()) {
    await loadWASM(input);
  }
}
