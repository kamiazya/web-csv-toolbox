import { parseStringToArraySync } from "web-csv-toolbox-wasm";
import { assertCommonOptions } from "./assertCommonOptions.ts";
import { InvalidOptionError } from "./common/errors.ts";
import type { CSVRecord, CommonOptions } from "./common/types.ts";
import {
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
  DOUBLE_QUOTE,
} from "./constants.ts";
import type { loadWASM } from "./loadWASM.ts";
import type { PickCSVHeader } from "./utils/types.ts";

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
  const { delimiter = DEFAULT_DELIMITER, quotation = DEFAULT_QUOTATION } =
    options;
  if (typeof delimiter !== "string" || delimiter.length !== 1) {
    throw new InvalidOptionError(
      "Invalid delimiter, must be a single character on WASM.",
    );
  }
  if (quotation !== DOUBLE_QUOTE) {
    throw new InvalidOptionError(
      "Invalid quotation, must be double quote on WASM.",
    );
  }
  assertCommonOptions({ delimiter, quotation });
  const demiliterCode = delimiter.charCodeAt(0);
  return JSON.parse(parseStringToArraySync(csv, demiliterCode));
}
