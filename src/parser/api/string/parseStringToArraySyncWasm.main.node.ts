import {
  isSyncInitialized,
  loadWasmSync,
  parseStringToArraySync as wasmParseStringToArraySync,
} from "#/wasm/loaders/loadWasmSync.js";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { CommonOptions, CSVRecord, PickCSVHeader } from "@/core/types.ts";
import {
  parseWithWasm,
  prepareCSVWithHeader,
  validateWasmOptions,
} from "./parseStringToArraySyncWasm.shared.ts";

/**
 * Parse CSV string to record of arrays using WebAssembly (synchronous).
 *
 * @param csv - CSV string to parse
 * @param options - Parse options
 * @param wasmPool - Optional Wasm pool for custom instance management
 * @returns Record of arrays
 *
 * @remarks
 * This function uses WebAssembly to parse CSV string synchronously.
 *
 * **Wasm Initialization:**
 * Wasm module is automatically initialized on first use.
 * However, it is recommended to call {@link loadWasm} beforehand for better performance.
 *
 * ```ts
 * // Recommended: Initialize Wasm beforehand
 * import { loadWasm, parseStringToArraySyncWasm } from 'web-csv-toolbox';
 * await loadWasm();
 * const result = parseStringToArraySyncWasm(csv);
 * ```
 *
 * ```ts
 * // Alternative: Automatic initialization (works but slower on first use)
 * import { parseStringToArraySyncWasm } from 'web-csv-toolbox';
 * const result = parseStringToArraySyncWasm(csv);
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
 * - Wasm is automatically initialized on first use (optional preloading via {@link loadWasm} improves first-parse performance)
 *
 * @example Recommended usage with loadWasm
 * ```ts
 * import { loadWasm, parseStringToArraySyncWasm } from "web-csv-toolbox";
 *
 * // Recommended: Load Wasm beforehand
 * await loadWasm();
 *
 * const csv = "a,b,c\n1,2,3";
 * const result = parseStringToArraySyncWasm(csv);
 * console.log(result);
 * // Prints: [{ a: "1", b: "2", c: "3" }]
 * ```
 *
 * @example Alternative: automatic initialization (slower on first use)
 * ```ts
 * import { parseStringToArraySyncWasm } from "web-csv-toolbox";
 *
 * // Wasm is automatically initialized on first use
 * const result = parseStringToArraySyncWasm(csv);
 * ```
 *
 * @beta
 * @throws {RangeError} If provided options are invalid or Wasm module initialization fails
 * @throws {TypeError} If provided options have invalid types
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
  const {
    delimiter,
    delimiterCode,
    quotation,
    maxBufferSize,
    maxFieldCount,
    source,
  } = validateWasmOptions(options);

  // Prepare CSV with custom header if provided
  const csvToParse = prepareCSVWithHeader(csv, header, delimiter, quotation);

  // Auto-initialize Wasm if not already initialized
  if (!isSyncInitialized()) {
    try {
      loadWasmSync();
    } catch (error) {
      // Throw helpful error with troubleshooting hints
      throw new RangeError(
        "Wasm initialization failed. " +
          `Original error: ${error instanceof Error ? error.message : String(error)}. ` +
          "Possible causes: " +
          "(1) Unsupported runtime (Wasm not available), " +
          "(2) Wasm binary inaccessible or corrupted, " +
          "(3) Bundler configuration issues (ensure Wasm file is included in bundle). " +
          "Try: Check browser/runtime supports WebAssembly, verify bundler settings, or use async loadWasm() for better error details.",
      );
    }
  }

  // Parse using Wasm
  return parseWithWasm(
    csvToParse,
    delimiterCode,
    maxBufferSize,
    maxFieldCount,
    source,
    wasmParseStringToArraySync,
  );
}
