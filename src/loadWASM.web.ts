import init, { InitInput } from "web-csv-toolbox-wasm";

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
  await init(input);
}
