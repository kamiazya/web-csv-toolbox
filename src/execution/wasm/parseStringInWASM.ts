import type { CSVRecord, ParseOptions } from "../../common/types.ts";
import { parseStringToArraySyncWASM } from "../../parseStringToArraySyncWASM.ts";

/**
 * Parse CSV string using WebAssembly in main thread.
 *
 * @internal
 * @param csv CSV string to parse
 * @param options Parsing options
 * @returns Async iterable iterator of records
 *
 * @remarks
 * WASM parser has limitations:
 * - Only supports UTF-8 encoding
 * - Only supports double-quote (") as quotation character
 * - Synchronous operation (no streaming)
 */
export async function parseStringInWASM<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): Promise<AsyncIterableIterator<CSVRecord<Header>>> {
  // Use existing WASM implementation
  const records = parseStringToArraySyncWASM(csv, options);

  // Convert array to async iterator
  return (async function* () {
    for (const record of records) {
      yield record;
    }
  })();
}
