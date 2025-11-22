import { parseStringToArraySync as wasmParseStringToArraySync } from "web-csv-toolbox-wasm";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { CommonOptions, CSVRecord, PickCSVHeader } from "@/core/types.ts";
import { isInitialized } from "@/wasm/loaders/wasmState.ts";
import {
  parseWithWASM,
  prepareCSVWithHeader,
  validateWASMOptions,
} from "./parseStringToArraySyncWASM.shared.ts";

/**
 * Parse CSV string to an array of record objects using WebAssembly (synchronous).
 *
 * Returns `CSVRecord<Header>[]` - an array where each element is a record object
 * representing a CSV row with column names as keys.
 *
 * IMPORTANT for `/slim` entry:
 * You MUST call `loadWASM()` before using this function.
 * Unlike the main entry point, this will NOT auto-initialize WASM.
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
  options: CommonOptions<Delimiter, Quotation> & { header?: Header } = {},
): CSVRecord<Header>[] {
  const { header } = options;

  // Validate options
  const { delimiter, delimiterCode, quotation, maxBufferSize, source } =
    validateWASMOptions(options);

  // Check if WASM is initialized (required for slim entry)
  if (!isInitialized()) {
    throw new RangeError(
      "WASM module is not initialized. " +
        "Please call loadWASM() before using parseStringToArraySyncWASM() in the slim entry.",
    );
  }

  // Prepare CSV with custom header if provided
  const csvToParse = prepareCSVWithHeader(csv, header, delimiter, quotation);

  // Parse using WASM (must be initialized beforehand)
  return parseWithWASM(
    csvToParse,
    delimiterCode,
    maxBufferSize,
    source,
    wasmParseStringToArraySync,
  );
}
