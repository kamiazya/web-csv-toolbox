import { convertBinaryToString } from "@/converters/binary/convertBinaryToString.ts";
import type { InferCSVRecord, ParseBinaryOptions } from "@/core/types.ts";
import { parseStringToIterableIterator } from "@/parser/api/string/parseStringToIterableIterator.ts";
import { commonParseErrorHandling } from "@/utils/error/commonParseErrorHandling.ts";

/**
 * Parses the given binary data into an iterable iterator of CSV records.
 *
 * @param binary - The binary data to parse.
 * @param options - The parse options.
 * @returns An iterable iterator of CSV records.
 * @throws {RangeError} If the binary size exceeds maxBinarySize limit.
 * @throws {ParseError} When an error occurs while parsing the CSV data.
 *
 * @remarks
 * **WARNING**: This function loads the entire binary data into memory before iteration.
 * For large files (>100MB), consider using streaming alternatives like `parseStream()` or `parseUint8ArrayStream()`
 * to avoid memory exhaustion.
 *
 * The default maxBinarySize is 100MB. While this function returns an iterator, the entire
 * binary is converted to a string in memory before iteration begins.
 */
export function parseBinaryToIterableIterator<
  Header extends ReadonlyArray<string>,
  Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
>(
  binary: Uint8Array | ArrayBuffer,
  options?: Options,
): IterableIterator<InferCSVRecord<Header, Options>> {
  try {
    const csv = convertBinaryToString(binary, options ?? {});
    return parseStringToIterableIterator(csv, options);
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
