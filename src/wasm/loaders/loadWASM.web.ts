import init, { type InitInput } from "web-csv-toolbox-wasm";
import { isWasmInitialized, markWasmInitialized } from "./wasmState.js";

/**
 * Re-export all WASM functions from this module to ensure they share the same WASM instance.
 *
 * Why this is necessary:
 * 1. loadWASM() calls init() which initializes the WASM module's internal global state
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
 * Re-export shared state management functions.
 */
export { isInitialized, resetInit } from "./wasmState.js";

/**
 * Load WASM module for browser environment.
 *
 * @param input - Optional custom initialization input
 * @returns Promise that resolves when initialization is complete
 *
 * @internal
 */
export async function loadWASM(input?: InitInput): Promise<void> {
  if (isWasmInitialized()) {
    return;
  }

  // Browser environment: use default fetch-based initialization
  if (input) {
    await init({ module_or_path: input });
  } else {
    await init();
  }
  markWasmInitialized();
}
