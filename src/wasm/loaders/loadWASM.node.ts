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
 * Load WASM module for Node.js environment.
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

  if (input) {
    await init({ module_or_path: input });
    markWasmInitialized();
    return;
  }

  // Node.js-specific WASM loading
  // Use import.meta.resolve to find the WASM file from the installed package
  // This works correctly both in development and when distributed as a package
  // @ts-expect-error - node: protocol imports are valid but may cause type errors
  const { readFile } = await import("node:fs/promises");
  // @ts-expect-error - node: protocol imports are valid but may cause type errors
  const { fileURLToPath } = await import("node:url");

  // Resolve WASM file path from the web-csv-toolbox-wasm package
  const wasmUrl = import.meta.resolve(
    "web-csv-toolbox-wasm/web_csv_toolbox_wasm_bg.wasm",
  );
  const wasmPath = fileURLToPath(wasmUrl);
  const wasmBuffer = await readFile(wasmPath);
  await init({ module_or_path: wasmBuffer });
  markWasmInitialized();
}
