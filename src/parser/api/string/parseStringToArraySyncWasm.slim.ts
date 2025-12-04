import { parseStringToArraySync as wasmParseStringToArraySync } from "web-csv-toolbox-wasm";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { CommonOptions, CSVRecord, PickCSVHeader } from "@/core/types.ts";
import { isInitialized } from "@/wasm/loaders/wasmState.ts";
import {
  parseWithWasm,
  prepareCSVWithHeader,
  validateWasmOptions,
} from "./parseStringToArraySyncWasm.shared.ts";

/**
 * Parse CSV string to an array of record objects using WebAssembly (synchronous).
 *
 * Returns `CSVRecord<Header>[]` - an array where each element is a record object
 * representing a CSV row with column names as keys.
 *
 * IMPORTANT for `/slim` entry:
 * You MUST call `loadWasm()` before using this function.
 * Unlike the main entry point, this will NOT auto-initialize Wasm.
 */
export function parseStringToArraySyncWasm<
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
export function parseStringToArraySyncWasm<
  const CSVSource extends string,
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
>(
  csv: CSVSource,
  options?: CommonOptions<Delimiter, Quotation>,
): CSVRecord<Header>[];
export function parseStringToArraySyncWasm<
  const Header extends ReadonlyArray<string>,
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
>(
  csv: string,
  options?: CommonOptions<Delimiter, Quotation>,
): CSVRecord<Header>[];
export function parseStringToArraySyncWasm<
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
    validateWasmOptions(options);

  // Check if Wasm is initialized (required for slim entry)
  if (!isInitialized()) {
    throw new RangeError(
      "Wasm module is not initialized. " +
        "Please call loadWasm() before using parseStringToArraySyncWasm() in the slim entry.",
    );
  }

  // Prepare CSV with custom header if provided
  const csvToParse = prepareCSVWithHeader(csv, header, delimiter, quotation);

  // Parse using Wasm (must be initialized beforehand)
  return parseWithWasm(
    csvToParse,
    delimiterCode,
    maxBufferSize,
    source,
    wasmParseStringToArraySync,
  );
}
