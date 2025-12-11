import { parseStringToArraySyncWasm } from "#/parser/api/string/parseStringToArraySyncWasm.main.js";
import { convertBinaryToString } from "@/converters/binary/convertBinaryToString.ts";
import type { CSVRecord, ParseBinaryOptions } from "@/core/types.ts";

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
 * Wasm module is automatically initialized on first use if not already loaded.
 * However, it is recommended to call {@link loadWasm} beforehand for better performance.
 *
 * Converts binary to string then uses Wasm parser.
 * Wasm parser has limitations:
 * - Only supports UTF-8 encoding
 * - Only supports double-quote (") as quotation character
 */
export async function* parseBinaryInWasm<Header extends ReadonlyArray<string>>(
  binary: BufferSource,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Convert binary to string with proper option handling
  const csv = convertBinaryToString(binary, options ?? {});

  // Use Wasm parser (automatically initialized if needed)
  const records = parseStringToArraySyncWasm(csv, options);

  // Yield records
  for (const record of records) {
    yield record;
  }
}
