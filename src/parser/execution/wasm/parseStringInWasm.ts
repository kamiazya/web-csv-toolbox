import { parseStringToArraySyncWasm } from "#/parser/api/string/parseStringToArraySyncWasm.main.js";
import type { CSVRecord, ParseOptions } from "@/core/types.ts";

/**
 * Parse CSV string using WebAssembly in main thread.
 *
 * @internal
 * @param csv - CSV string to parse
 * @param options - Parsing options
 * @returns Async iterable iterator of records
 *
 * @remarks
 * Wasm module is automatically initialized on first use if not already loaded.
 * However, it is recommended to call {@link loadWasm} beforehand for better performance.
 *
 * Wasm parser has limitations:
 * - Only supports UTF-8 encoding
 * - Only supports double-quote (") as quotation character
 * - Synchronous operation (no streaming)
 */
export async function* parseStringInWasm<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Use Wasm implementation (automatically initialized if needed)
  const records = parseStringToArraySyncWasm(csv, options);

  // Yield records
  for (const record of records) {
    yield record;
  }
}
