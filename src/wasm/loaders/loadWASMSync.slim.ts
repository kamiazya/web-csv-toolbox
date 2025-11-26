/**
 * Slim-specific WASM synchronous loader.
 *
 * **IMPORTANT**: This file is used by slim entry points (slim.node.ts, slim.web.ts)
 * instead of loadWASMSync.node.ts/loadWASMSync.web.ts.
 *
 * **Key Differences from main entry loaders:**
 * - Does NOT include base64-inlined WASM (smaller bundle size)
 * - Does NOT auto-initialize WASM
 * - Requires manual `await loadWASM(wasmUrl)` before using WASM features
 * - Throws a clear error if WASM is not initialized
 *
 * **Why this file exists:**
 * - Slim entry is designed for smaller bundle sizes by NOT embedding WASM as base64
 * - WASM parser models use `loadWASMSync()` for auto-initialization
 * - Without this slim-specific version, slim would bundle the base64 WASM anyway
 * - This loader checks if async `loadWASM()` was called and throws if not
 */

import { isWasmInitialized, isInitialized, resetInit } from "./wasmState.js";

/**
 * Re-export all WASM functions from the WASM package.
 *
 * These functions require WASM to be initialized first via `loadWASM()`.
 */
export * from "web-csv-toolbox-wasm";

/**
 * Re-export shared state management functions.
 */
export { isInitialized, resetInit };

/**
 * Re-export state check function with expected name.
 */
export { isInitialized as isSyncInitialized };

/**
 * Slim version of loadWASMSync that requires manual initialization.
 *
 * This function does NOT auto-initialize WASM. It only checks if WASM
 * has been initialized via `loadWASM()` and throws an error if not.
 *
 * **Usage in slim entry:**
 * ```ts
 * import { loadWASM, parseString } from 'web-csv-toolbox/slim';
 * import wasmUrl from 'web-csv-toolbox/csv.wasm?url';
 *
 * // REQUIRED: Manual initialization
 * await loadWASM(wasmUrl);
 *
 * // Now WASM features work
 * const records = parseString.toArraySync(csv, { engine: { wasm: true } });
 * ```
 *
 * @throws {RangeError} Always throws if WASM is not initialized
 * @internal
 */
export function loadWASMSync(): void {
  if (isWasmInitialized()) {
    // Already initialized via async loadWASM() - nothing to do
    return;
  }

  // Not initialized - throw helpful error
  throw new RangeError(
    "WASM is not initialized. In slim entry, you must call 'await loadWASM(wasmUrl)' " +
      "before using WASM features.\n\n" +
      "Example:\n" +
      "  import { loadWASM, parseString } from 'web-csv-toolbox/slim';\n" +
      "  import wasmUrl from 'web-csv-toolbox/csv.wasm?url';\n\n" +
      "  await loadWASM(wasmUrl);\n" +
      "  const records = parseString.toArraySync(csv, { engine: { wasm: true } });\n\n" +
      "If you want automatic WASM initialization, use the main entry instead:\n" +
      "  import { parseString } from 'web-csv-toolbox';",
  );
}

/**
 * Get the initialized WASM module instance.
 *
 * In slim entry, this always returns undefined because we don't
 * manage the WASM instance directly - it's managed by the async loader.
 *
 * @internal
 */
export function getWasmModule(): undefined {
  return undefined;
}

/**
 * Reset synchronous initialization state.
 *
 * @internal
 */
export function resetSyncInit(): void {
  // In slim, we delegate to shared state
  resetInit();
}
