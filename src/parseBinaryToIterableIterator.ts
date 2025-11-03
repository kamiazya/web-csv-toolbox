import type { CSVRecord, ParseBinaryOptions } from "./common/types.ts";
import { commonParseErrorHandling } from "./commonParseErrorHandling.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "./constants.ts";
import { parseStringToIterableIterator } from "./parseStringToIterableIterator.ts";
import { convertBinaryToString } from "./utils/convertBinaryToString.ts";

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
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  binary: Uint8Array | ArrayBuffer,
  options: ParseBinaryOptions<
    Header,
    Delimiter,
    Quotation
  > = {} as ParseBinaryOptions<Header, Delimiter, Quotation>,
): IterableIterator<CSVRecord<Header>> {
  try {
    const csv = convertBinaryToString(binary, options);
    return parseStringToIterableIterator(csv, options);
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
