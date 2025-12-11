/**
 * Slim-specific Wasm synchronous loader.
 *
 * **IMPORTANT**: This file is used by slim entry points (slim.node.ts, slim.web.ts)
 * instead of loadWasmSync.node.ts/loadWasmSync.web.ts.
 *
 * **Key Differences from main entry loaders:**
 * - Does NOT include base64-inlined Wasm (smaller bundle size)
 * - Does NOT auto-initialize Wasm
 * - Requires manual `await loadWasm(wasmUrl)` before using Wasm features
 * - Throws a clear error if Wasm is not initialized
 *
 * **Why this file exists:**
 * - Slim entry is designed for smaller bundle sizes by NOT embedding Wasm as base64
 * - Wasm parser models use `loadWasmSync()` for auto-initialization
 * - Without this slim-specific version, slim would bundle the base64 Wasm anyway
 * - This loader checks if async `loadWasm()` was called and throws if not
 */

import { isInitialized, isWasmInitialized, resetInit } from "./wasmState.js";

/**
 * Re-export all Wasm functions from the Wasm package.
 *
 * These functions require Wasm to be initialized first via `loadWasm()`.
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
 * Slim version of loadWasmSync that requires manual initialization.
 *
 * This function does NOT auto-initialize Wasm. It only checks if Wasm
 * has been initialized via `loadWasm()` and throws an error if not.
 *
 * **Usage in slim entry:**
 * ```ts
 * import { loadWasm, parseString } from 'web-csv-toolbox/slim';
 * import wasmUrl from 'web-csv-toolbox/csv.wasm?url';
 *
 * // REQUIRED: Manual initialization
 * await loadWasm(wasmUrl);
 *
 * // Now Wasm features work
 * const records = parseString.toArraySync(csv, { engine: { wasm: true } });
 * ```
 *
 * @throws {RangeError} Always throws if Wasm is not initialized
 * @internal
 */
export function loadWasmSync(): void {
  if (isWasmInitialized()) {
    // Already initialized via async loadWasm() - nothing to do
    return;
  }

  // Not initialized - throw helpful error
  throw new RangeError(
    "Wasm is not initialized. In slim entry, you must call 'await loadWasm(wasmUrl)' " +
      "before using Wasm features.\n\n" +
      "Example:\n" +
      "  import { loadWasm, parseString } from 'web-csv-toolbox/slim';\n" +
      "  import wasmUrl from 'web-csv-toolbox/csv.wasm?url';\n\n" +
      "  await loadWasm(wasmUrl);\n" +
      "  const records = parseString.toArraySync(csv, { engine: { wasm: true } });\n\n" +
      "If you want automatic Wasm initialization, use the main entry instead:\n" +
      "  import { parseString } from 'web-csv-toolbox';",
  );
}

/**
 * Get the initialized Wasm module instance.
 *
 * In slim entry, this always returns undefined because we don't
 * manage the Wasm instance directly - it's managed by the async loader.
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
