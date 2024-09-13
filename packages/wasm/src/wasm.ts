import {
  type CommonOptions,
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
  assertCommonOptions,
} from "@web-csv-toolbox/common";

import { parseStringToArraySync as $parseStringToArraySync } from "../build/nodejs";

/**
 * Load WASM module.
 *
 * This must be called before calling WebAssembly functions.
 *
 * @example
 *
 * ```ts
 * import { loadWASM, parseStringToArraySync } from "@web-csv-toolbox/wasm";
 *
 * await loadWASM();
 *
 * const csv = "a,b,c\n1,2,3";
 * const parsed = parseStringToArraySync(csv);
 * ```
 */
export async function loadWASM() {}

export function parseStringToArraySync<
  Delimiter extends string,
  Quotation extends string,
>(csv: string, options: CommonOptions<Delimiter, Quotation> = {}) {
  const { delimiter = DEFAULT_DELIMITER, quotation = DEFAULT_QUOTATION } =
    options;
  assertCommonOptions({ delimiter, quotation });
  if (options.quotation !== undefined) {
    throw new RangeError("Quotation is not supported in WASM");
  }
  return $parseStringToArraySync(csv, delimiter.charCodeAt(0));
}
