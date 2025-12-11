/**
 * Node.js-specific Wasm synchronous loader.
 *
 * **IMPORTANT**: This file exists alongside loadWasmSync.web.ts (not a unified loadWasmSync.ts).
 *
 * **Why separate .node.ts and .web.ts versions are required:**
 * - The `#/csv.wasm` import requires Vite plugin resolution at build time
 * - This plugin-based resolution doesn't work reliably in all test environments
 * - Separate files allow proper mocking and testing in environment-specific test suites
 * - During build, package.json "imports" field maps `#/wasm/loaders/loadWasmSync.js`
 *   to the appropriate `.node.js` or `.web.js` based on the runtime environment
 *
 * **Do not consolidate** into a single unified file unless Vite plugin resolution
 * for `#/csv.wasm` works reliably across all development and test environments.
 */

import {
  type InitOutput,
  initSync,
  type SyncInitInput,
} from "web-csv-toolbox-wasm";
import wasmBuffer from "#/csv.wasm";

import {
  isWasmInitialized,
  markWasmInitialized,
  hasWasmSimd,
  resetWasmState,
} from "./wasmState.js";

/**
 * Re-export all Wasm functions from this module to ensure they share the same Wasm instance.
 *
 * Why this is necessary:
 * 1. loadWasmSync() calls initSync() which initializes the Wasm module's internal global state
 * 2. If Wasm functions are imported directly from "web-csv-toolbox-wasm" elsewhere,
 *    they may reference a different module context in some environments (e.g., test runners)
 * 3. This can lead to errors like "Cannot read properties of undefined (reading '__wbindgen_malloc')"
 *    because the Wasm instance accessed by those functions hasn't been initialized
 * 4. By re-exporting all functions from the same module that handles initialization,
 *    we ensure they always reference the same initialized Wasm instance
 *
 * Using `export *` instead of individual named exports:
 * - Automatically includes all current and future Wasm functions
 * - No maintenance needed when new functions are added to web-csv-toolbox-wasm
 * - Maintains type safety through TypeScript's type inference
 */
export * from "web-csv-toolbox-wasm";

let wasmModule: InitOutput | undefined;

/**
 * Synchronously load Wasm module for Node.js environment.
 *
 * This function uses the inlined Wasm module (base64-encoded at build time)
 * to enable synchronous initialization. This is useful for:
 * - Synchronous APIs with `{ engine: { wasm: true } }` option
 * - Contexts where async initialization is not possible
 *
 * **Trade-offs:**
 * - ✅ Synchronous initialization - no await needed
 * - ✅ Works in synchronous contexts
 * - ❌ Larger bundle size (Wasm inlined as base64)
 * - ❌ Slower initial load time
 *
 * **Note:** This is the Node.js-specific version that uses Buffer.from for decoding.
 *
 * @param input - Optional custom initialization input. If not provided, uses inlined Wasm.
 * @returns void
 *
 * @example
 * ```ts
 * import { loadWasmSync, parseString } from 'web-csv-toolbox';
 *
 * // Synchronous initialization
 * loadWasmSync();
 *
 * // Now you can use sync APIs with Wasm without await
 * const result = parseString.toArraySync(csv, { engine: { wasm: true } });
 * ```
 *
 * @example
 * Automatic initialization (recommended to call loadWasm beforehand)
 * ```ts
 * import { loadWasm, parseString } from 'web-csv-toolbox';
 *
 * // Recommended: Load Wasm beforehand for better performance
 * await loadWasm();
 *
 * // Wasm is automatically initialized on first use if not preloaded
 * const result = parseString.toArraySync(csv, { engine: { wasm: true } });
 * ```
 *
 * @internal
 */
export function loadWasmSync(input?: SyncInitInput): void {
  if (isWasmInitialized()) {
    return;
  }

  if (!hasWasmSimd()) {
    console.warn(
      "[web-csv-toolbox] WebAssembly SIMD is not supported; skipping Wasm init and falling back to JavaScript.",
    );
    return;
  }

  // Use provided input or inlined Wasm buffer
  const module = input ?? (wasmBuffer as ArrayBuffer);
  wasmModule = initSync({ module });
  markWasmInitialized();
}

/**
 * Re-export shared state management functions.
 */
export { isInitialized as isSyncInitialized } from "./wasmState.js";

/**
 * Get the initialized Wasm module instance.
 * @internal
 */
export function getWasmModule(): InitOutput | undefined {
  return wasmModule;
}

/**
 * Reset synchronous initialization state.
 * @internal
 */
export function resetSyncInit(): void {
  resetWasmState();
  wasmModule = undefined;
}
