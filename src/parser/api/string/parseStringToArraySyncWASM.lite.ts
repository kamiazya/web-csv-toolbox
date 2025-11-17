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
 * Parse CSV string to record of arrays using WebAssembly (synchronous).
 *
 * **IMPORTANT for `/lite` version:**
 * You MUST call `loadWASM()` before using this function.
 * Unlike the main entry point, this will NOT auto-initialize WASM.
 *
 * @param csv - CSV string to parse
 * @param options - Parse options
 * @returns Record of arrays
 *
 * @throws {RangeError} If WASM module is not initialized or options are invalid
 * @throws {TypeError} If provided options have invalid types
 *
 * @example
 * ```ts
 * import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox/lite';
 *
 * // REQUIRED: Initialize WASM first
 * await loadWASM();
 *
 * const csv = 'name,age\nAlice,30\nBob,25';
 * const result = parseStringToArraySyncWASM(csv);
 * console.log(result);
 * // Prints: [{ name: "Alice", age: "30" }, { name: "Bob", age: "25" }]
 * ```
 *
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
  options: CommonOptions<Delimiter, Quotation> & { header?: Header } = {},
): CSVRecord<Header>[] {
  const { header } = options;

  // Validate options
  const { delimiter, delimiterCode, quotation, maxBufferSize, source } =
    validateWASMOptions(options);

  // Check if WASM is initialized (required for lite version)
  if (!isInitialized()) {
    throw new RangeError(
      "WASM module is not initialized. " +
        "Please call loadWASM() before using parseStringToArraySyncWASM() in the lite version.",
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
