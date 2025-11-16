import {
  type InitOutput,
  initSync,
  type SyncInitInput,
} from "web-csv-toolbox-wasm";
// @ts-expect-error - WASM file imported as ArrayBuffer via vite-plugin-wasm-arraybuffer
import wasmBuffer from "web-csv-toolbox-wasm/web_csv_toolbox_wasm_bg.wasm?arraybuffer";

import {
  isWasmInitialized,
  markWasmInitialized,
  resetWasmState,
} from "./wasmState.js";

/**
 * Re-export all WASM functions from this module to ensure they share the same WASM instance.
 *
 * Why this is necessary:
 * 1. loadWASMSync() calls initSync() which initializes the WASM module's internal global state
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

let wasmModule: InitOutput | undefined;

/**
 * Synchronously load WASM module for Node.js environment.
 *
 * This function uses the inlined WASM module (base64-encoded at build time)
 * to enable synchronous initialization. This is useful for:
 * - Synchronous APIs like parseStringToArraySyncWASM
 * - Contexts where async initialization is not possible
 *
 * **Trade-offs:**
 * - ✅ Synchronous initialization - no await needed
 * - ✅ Works in synchronous contexts
 * - ❌ Larger bundle size (WASM inlined as base64)
 * - ❌ Slower initial load time
 *
 * **Note:** This is the Node.js-specific version that uses Buffer.from for decoding.
 *
 * @param input - Optional custom initialization input. If not provided, uses inlined WASM.
 * @returns void
 *
 * @example
 * ```ts
 * import { loadWASMSync, parseStringToArraySyncWASM } from 'web-csv-toolbox';
 *
 * // Synchronous initialization
 * loadWASMSync();
 *
 * // Now you can use sync APIs without await
 * const result = parseStringToArraySyncWASM(csv);
 * ```
 *
 * @example
 * Automatic initialization (recommended to call loadWASM beforehand)
 * ```ts
 * import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox';
 *
 * // Recommended: Load WASM beforehand for better performance
 * await loadWASM();
 *
 * // WASM is automatically initialized on first use if not preloaded
 * const result = parseStringToArraySyncWASM(csv);
 * ```
 *
 * @internal
 */
export function loadWASMSync(input?: SyncInitInput): void {
  if (isWasmInitialized()) {
    return;
  }

  // Use provided input or inlined WASM buffer
  const module = input ?? (wasmBuffer as ArrayBuffer);
  wasmModule = initSync({ module });
  markWasmInitialized();
}

/**
 * Re-export shared state management functions.
 */
export { isInitialized as isSyncInitialized } from "./wasmState.js";

/**
 * Get the initialized WASM module instance.
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
