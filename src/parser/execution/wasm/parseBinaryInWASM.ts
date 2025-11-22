import { convertBinaryToString } from "@/converters/binary/convertBinaryToString.ts";
import type { CSVRecord, ParseBinaryOptions } from "@/core/types.ts";
import { parseStringToArraySyncWASM } from "#/parser/api/string/parseStringToArraySyncWASM.main.js";

/**
 * Parse CSV binary using WebAssembly in main thread.
 *
 * @internal
 * @param binary - CSV binary to parse
 * @param options - Parsing options
 * @returns Async iterable iterator of records
 * @throws {RangeError} If the binary size exceeds maxBinarySize limit or charset is not supported.
 * @throws {TypeError} If the encoded data is not valid for the specified charset.
 *
 * @remarks
 * WASM module is automatically initialized on first use if not already loaded.
 * However, it is recommended to call {@link loadWASM} beforehand for better performance.
 *
 * Converts binary to string then uses WASM parser.
 * WASM parser has limitations:
 * - Only supports UTF-8 encoding
 * - Only supports double-quote (") as quotation character
 */
export async function* parseBinaryInWASM<Header extends ReadonlyArray<string>>(
  binary: Uint8Array | ArrayBuffer,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Convert binary to string with proper option handling
  const csv = convertBinaryToString(binary, options ?? {});

  // Use WASM parser (automatically initialized if needed)
  const records = parseStringToArraySyncWASM(csv, options);

  // Yield records
  for (const record of records) {
    yield record;
  }
}
