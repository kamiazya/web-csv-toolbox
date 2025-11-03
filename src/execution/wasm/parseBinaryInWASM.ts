import type { CSVRecord, ParseBinaryOptions } from "../../common/types.ts";
import { parseStringToArraySyncWASM } from "../../parseStringToArraySyncWASM.ts";
import { convertBinaryToString } from "../../utils/convertBinaryToString.ts";

/**
 * Parse CSV binary using WebAssembly in main thread.
 *
 * @internal
 * @param binary CSV binary to parse
 * @param options Parsing options
 * @returns Async iterable iterator of records
 * @throws {RangeError} If the binary size exceeds maxBinarySize limit or charset is not supported.
 * @throws {TypeError} If the encoded data is not valid for the specified charset.
 *
 * @remarks
 * Converts binary to string then uses WASM parser.
 * WASM parser has limitations:
 * - Only supports UTF-8 encoding
 * - Only supports double-quote (") as quotation character
 */
export function parseBinaryInWASM<Header extends ReadonlyArray<string>>(
  binary: Uint8Array | ArrayBuffer,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Convert binary to string with proper option handling
  const csv = convertBinaryToString(binary, options ?? {});

  // Use WASM parser
  const records = parseStringToArraySyncWASM(csv, options);

  // Convert array to async iterator
  return (async function* () {
    for (const record of records) {
      yield record;
    }
  })();
}
