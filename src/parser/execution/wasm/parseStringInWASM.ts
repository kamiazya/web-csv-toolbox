import type { CSVRecord, ParseOptions } from "@/core/types.ts";
import { parseStringToArraySyncWASM } from "@/parser/api/string/parseStringToArraySyncWASM.main.node.ts";

/**
 * Parse CSV string using WebAssembly in main thread.
 *
 * @internal
 * @param csv - CSV string to parse
 * @param options - Parsing options
 * @returns Async iterable iterator of records
 *
 * @remarks
 * WASM module is automatically initialized on first use if not already loaded.
 * However, it is recommended to call {@link loadWASM} beforehand for better performance.
 *
 * WASM parser has limitations:
 * - Only supports UTF-8 encoding
 * - Only supports double-quote (") as quotation character
 * - Synchronous operation (no streaming)
 */
export async function* parseStringInWASM<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Use WASM implementation (automatically initialized if needed)
  const records = parseStringToArraySyncWASM(csv, options);

  // Yield records
  for (const record of records) {
    yield record;
  }
}
