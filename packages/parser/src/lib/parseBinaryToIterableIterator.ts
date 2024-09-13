import type { CSVRecord, ParseBinaryOptions } from "@web-csv-toolbox/common";
import { convertBinaryToString } from "@web-csv-toolbox/shared";

import { parseStringToIterableIterator } from "./parseStringToIterableIterator";
import { commonParseErrorHandling } from "./utils/commonParseErrorHandling";

/**
 * Parses the given binary data into an iterable iterator of CSV records.
 *
 * @param binary - The binary data to parse.
 * @param options - The parse options.
 * @returns An iterable iterator of CSV records.
 * @throws {ParseError} When an error occurs while parsing the CSV data.
 */
export function parseBinaryToIterableIterator<
  Header extends ReadonlyArray<string>,
>(
  binary: Uint8Array | ArrayBuffer,
  options: ParseBinaryOptions<Header> = {},
): IterableIterator<CSVRecord<Header>> {
  try {
    const csv = convertBinaryToString(binary, options);
    return parseStringToIterableIterator(csv, options);
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
