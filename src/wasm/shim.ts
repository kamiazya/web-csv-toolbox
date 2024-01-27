import { CSVRecord } from "../common/types.ts";

import init, { parseStringToArraySync } from "web-csv-toolbox-wasm";

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
export async function loadWASM() {
  await init();
}

/**
 * Parse CSV string to record of arrays.
 *
 * This function is asynchronous.
 *
 * @param csv CSV string
 * @returns Record of arrays
 *
 * @example
 *
 * ```ts
 * import { loadWASM, parseStringWASM } from "web-csv-toolbox";
 *
 * await loadWASM();
 *
 * const csv = "a,b,c\n1,2,3";
 *
 * const result = parseStringToArraySyncWASM(csv);
 * console.log(result);
 * // Prints:
 * // [{ a: "1", b: "2", c: "3" }]
 * ```
 */
export function parseStringToArraySyncWASM<Header extends readonly string[]>(
  csv: string,
): CSVRecord<Header>[] {
  return JSON.parse(parseStringToArraySync(csv));
}
