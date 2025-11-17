import { parseStringToArraySync as wasmParseStringToArraySync } from "#/wasm/loaders/loadWASM.js";
import {
  isSyncInitialized,
  loadWASMSync,
} from "#/wasm/loaders/loadWASMSync.js";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { CommonOptions, CSVRecord, PickCSVHeader } from "@/core/types.ts";
import {
  parseWithWASM,
  prepareCSVWithHeader,
  validateWASMOptions,
} from "./parseStringToArraySyncWASM.shared.ts";

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
 * - WASM is automatically initialized on first use (optional preloading via {@link loadWASM} improves first-parse performance)
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
  const { header } = options;

  // Validate options
  const { delimiter, delimiterCode, quotation, maxBufferSize, source } =
    validateWASMOptions(options);

  // Prepare CSV with custom header if provided
  const csvToParse = prepareCSVWithHeader(csv, header, delimiter, quotation);

  // Auto-initialize WASM if not already initialized
  if (!isSyncInitialized()) {
    try {
      loadWASMSync();
    } catch (error) {
      // Throw helpful error with troubleshooting hints
      throw new RangeError(
        "WASM initialization failed. " +
          `Original error: ${error instanceof Error ? error.message : String(error)}. ` +
          "Possible causes: " +
          "(1) Unsupported runtime (WASM not available), " +
          "(2) WASM binary inaccessible or corrupted, " +
          "(3) Bundler configuration issues (ensure WASM file is included in bundle). " +
          "Try: Check browser/runtime supports WebAssembly, verify bundler settings, or use async loadWASM() for better error details.",
      );
    }
  }

  // Parse using WASM
  return parseWithWASM(
    csvToParse,
    delimiterCode,
    maxBufferSize,
    source,
    wasmParseStringToArraySync,
  );
}
