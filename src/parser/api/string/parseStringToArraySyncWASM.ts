import { parseStringToArraySync as wasmParseStringToArraySync } from "#/wasm/loadWASM.js";
import {
  isSyncInitialized,
  loadWASMSync,
} from "#/wasm/loadWASMSync.js";
import {
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
  DOUBLE_QUOTE,
} from "@/core/constants.ts";
import type { CommonOptions, CSVRecord, PickCSVHeader } from "@/core/types.ts";
import { assertCommonOptions } from "@/utils/validation/assertCommonOptions.ts";

/**
 * Parse CSV string to record of arrays using WebAssembly (synchronous).
 *
 * @param csv - CSV string to parse
 * @param options - Parse options
 * @param wasmPool - Optional WASM pool for custom instance management
 * @returns Record of arrays
 *
 * @remarks
 * This function uses WebAssembly to parse CSV string synchronously.
 *
 * **WASM Initialization:**
 * WASM module is automatically initialized on first use.
 * However, it is recommended to call {@link loadWASM} beforehand for better performance.
 *
 * ```ts
 * // Recommended: Initialize WASM beforehand
 * import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox';
 * await loadWASM();
 * const result = parseStringToArraySyncWASM(csv);
 * ```
 *
 * ```ts
 * // Alternative: Automatic initialization (works but slower on first use)
 * import { parseStringToArraySyncWASM } from 'web-csv-toolbox';
 * const result = parseStringToArraySyncWASM(csv);
 * ```
 *
 * **Performance Characteristics:**
 * - **Execution**: Synchronous operation that blocks the calling thread
 * - **Memory usage**: O(n) - loads entire result into memory
 * - **Use case**: Suitable when you need synchronous parsing and can accept blocking behavior
 *
 * **Limitations:**
 * - Only supports UTF-8 string (not UTF-16)
 * - Only supports double quote (`"`) as quotation character
 * - Only supports single character as delimiter
 * - Requires prior WASM initialization (synchronous limitation)
 *
 * @example Recommended usage with loadWASM
 * ```ts
 * import { loadWASM, parseStringToArraySyncWASM } from "web-csv-toolbox";
 *
 * // Recommended: Load WASM beforehand
 * await loadWASM();
 *
 * const csv = "a,b,c\n1,2,3";
 * const result = parseStringToArraySyncWASM(csv);
 * console.log(result);
 * // Prints: [{ a: "1", b: "2", c: "3" }]
 * ```
 *
 * @example Alternative: automatic initialization (slower on first use)
 * ```ts
 * import { parseStringToArraySyncWASM } from "web-csv-toolbox";
 *
 * // WASM is automatically initialized on first use
 * const result = parseStringToArraySyncWASM(csv);
 * ```
 *
 * @beta
 * @throws {RangeError} If provided options are invalid or WASM module is not initialized
 * @throws {TypeError} If provided options have invalid types
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
  const {
    delimiter = DEFAULT_DELIMITER,
    quotation = DEFAULT_QUOTATION,
    maxBufferSize = 10485760,
    source,
    header,
  } = options;
  if (typeof delimiter !== "string" || delimiter.length !== 1) {
    throw new RangeError(
      "Invalid delimiter, must be a single character on WASM.",
    );
  }
  if (quotation !== DOUBLE_QUOTE) {
    throw new RangeError("Invalid quotation, must be double quote on WASM.");
  }
  assertCommonOptions({ delimiter, quotation, maxBufferSize });
  const delimiterCode = delimiter.charCodeAt(0);

  // If custom header is provided, prepend it to the CSV string
  // so WASM parser treats it as the header row
  let csvToParse = csv;
  if (header) {
    // Escape fields that contain special characters
    const escapedHeader = header.map((field) => {
      if (
        field.includes(delimiter) ||
        field.includes(quotation) ||
        field.includes("\n") ||
        field.includes("\r")
      ) {
        return `${quotation}${field.replace(new RegExp(quotation, "g"), quotation + quotation)}${quotation}`;
      }
      return field;
    });
    csvToParse = `${escapedHeader.join(delimiter)}\n${csv}`;
  }

  // Auto-initialize WASM if not already initialized
  if (!isSyncInitialized()) {
    try {
      loadWASMSync();
    } catch (error) {
      // In Node.js or when sync init fails, throw helpful error
      throw new RangeError(
        "WASM module is not initialized. " +
          "In browser: WASM will be auto-initialized on first use. " +
          "In Node.js: WASM will be auto-initialized on first use (with inlined WASM). " +
          `Original error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Use the imported WASM function (initialized by loadWASMSync)
  return JSON.parse(
    wasmParseStringToArraySync(
      csvToParse,
      delimiterCode,
      maxBufferSize,
      source ?? "",
    ),
  );
}
