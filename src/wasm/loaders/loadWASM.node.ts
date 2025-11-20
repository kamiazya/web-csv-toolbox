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
    try {
      await init({ module_or_path: input });
      markWasmInitialized();
      return;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to initialize WASM module with provided input: ${errorMessage}\n\n` +
          `Please ensure the provided WASM file or buffer is valid.\n\n` +
          `See: https://github.com/kamiazya/web-csv-toolbox#readme`,
      );
    }
  }

  try {
    // Node.js-specific WASM loading
    // Use import.meta.resolve to find the WASM file from the package exports
    // This works correctly both in development and when distributed as a package
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");

    // Resolve WASM file path using package exports (./csv.wasm -> ./dist/csv.wasm)
    // This avoids dependency on the external web-csv-toolbox-wasm package
    const wasmUrl = import.meta.resolve("web-csv-toolbox/csv.wasm");
    const wasmPath = fileURLToPath(wasmUrl);
    const wasmBuffer = await readFile(wasmPath);
    await init({ module_or_path: wasmBuffer });
    markWasmInitialized();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to initialize WASM module: ${errorMessage}\n\n` +
        `This error typically occurs when:\n` +
        `  - WASM file cannot be found or read from the filesystem\n` +
        `  - Package exports are not configured correctly\n` +
        `  - File permissions prevent reading the WASM file\n\n` +
        `For Deno users with npm: prefix:\n` +
        `  This should work automatically with the "deno" export condition.\n` +
        `  If you encounter this error, please ensure you're using the latest version.\n\n` +
        `For manual WASM loading:\n` +
        `  import { loadWASM } from 'web-csv-toolbox/slim';\n` +
        `  await loadWASM(wasmFilePathOrBuffer);\n\n` +
        `See: https://github.com/kamiazya/web-csv-toolbox#readme`,
    );
  }
}
