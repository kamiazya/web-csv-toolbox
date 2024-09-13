import {
  type CommonOptions,
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
  assertCommonOptions,
} from "@web-csv-toolbox/common";

import init, {
  parseStringToArraySync as $parseStringToArraySync,
  type InitInput,
} from "../build/web.js";

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
