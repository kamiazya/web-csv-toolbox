import init, { type InitInput } from "web-csv-toolbox-wasm";

/**
 * Load WASM module.
 *
 * This must be called before calling WebAssembly functions.
 *
 * @example
 *
 * ```ts
 * import { loadWASM, parseStringWASM } from "web-csv-toolbox";
 *
 * await loadWASM();
 *
 * const csv = "a,b,c\n1,2,3";
 * const parsed = parseStringWASM(csv);
 * ```
 */
export async function loadWASM(input?: InitInput | Promise<InitInput>) {
  if (input) {
    await init(input);
  } else {
    // In Node.js environment, manually load the WASM file
    try {
      // Dynamically import Node.js modules to avoid bundling issues
      // @ts-expect-error - node: protocol imports are valid but may cause type errors in some configurations
      const { readFile } = await import("node:fs/promises");
      // @ts-expect-error - node: protocol imports are valid but may cause type errors in some configurations
      const { fileURLToPath } = await import("node:url");

      const wasmPath = fileURLToPath(
        new URL(
          "../../node_modules/web-csv-toolbox-wasm/web_csv_toolbox_wasm_bg.wasm",
          import.meta.url,
        ),
      );
      const wasmBuffer = await readFile(wasmPath);
      await init(wasmBuffer);
    } catch (_error) {
      // If manual loading fails, fallback to default init (for browser environments)
      await init();
    }
  }
}
