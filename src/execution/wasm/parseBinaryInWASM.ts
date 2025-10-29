import type { CSVRecord, ParseBinaryOptions } from "../../common/types.ts";
import { parseStringToArraySyncWASM } from "../../parseStringToArraySyncWASM.ts";

/**
 * Parse CSV binary using WebAssembly in main thread.
 *
 * @internal
 * @param binary CSV binary to parse
 * @param options Parsing options
 * @returns Async iterable iterator of records
 *
 * @remarks
 * Converts binary to UTF-8 string then uses WASM parser.
 * WASM parser has limitations:
 * - Only supports UTF-8 encoding
 * - Only supports double-quote (") as quotation character
 */
export function parseBinaryInWASM<Header extends ReadonlyArray<string>>(
  binary: Uint8Array | ArrayBuffer,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Convert binary to string
  const decoder = new TextDecoder(options?.charset ?? "utf-8");
  const csv = decoder.decode(binary);

  // Use WASM parser
  const records = parseStringToArraySyncWASM(csv, options);

  // Convert array to async iterator
  return (async function* () {
    for (const record of records) {
      yield record;
    }
  })();
}
