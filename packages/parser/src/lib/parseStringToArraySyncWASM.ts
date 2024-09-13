import type {
  CSVRecord,
  CommonOptions,
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
  PickCSVHeader,
} from "@web-csv-toolbox/common";

import { type loadWASM, parseStringToArraySync } from "@web-csv-toolbox/wasm";

/**
 * Parse CSV string to record of arrays.
 *
 * @param csv CSV string
 * @param options Parse options
 * @returns Record of arrays
 *
 * @remarks
 * This function uses WebAssembly to parse CSV string.
 * Before calling this function, you must call {@link loadWASM} function.
 *
 * This function only supports UTF-8 string.
 * If you pass a string that is not UTF-8, like UTF-16, it throws an error.
 * This function only supports double quote as quotation.
 * So, `options.quotation` must be `"` (double quote). Otherwise, it throws an error.
 *
 * And this function only supports single character as delimiter.
 * So, `options.delimiter` must be a single character. Otherwise, it throws an error.
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
 * @beta
 * @throws {RangeError | TypeError} - If provided options are invalid.
 */
export function parseStringToArraySyncWASM<
  const CSVSource extends string,
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Header extends ReadonlyArray<string> = PickCSVHeader<
    CSVSource,
    Delimiter,
    Quotation
  >,
>(
  csv: CSVSource,
  options: CommonOptions<Delimiter, Quotation>,
): CSVRecord<Header>[];
export function parseStringToArraySyncWASM<
  const CSVSource extends string,
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
>(
  csv: CSVSource,
  options?: CommonOptions<Delimiter, Quotation>,
): CSVRecord<Header>[];
export function parseStringToArraySyncWASM<
  const Header extends ReadonlyArray<string>,
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
>(
  csv: string,
  options?: CommonOptions<Delimiter, Quotation>,
): CSVRecord<Header>[];
export function parseStringToArraySyncWASM<
  const Header extends readonly string[],
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
>(
  csv: string,
  options: CommonOptions<Delimiter, Quotation> = {},
): CSVRecord<Header>[] {
  return JSON.parse(parseStringToArraySync(csv, options));
}
