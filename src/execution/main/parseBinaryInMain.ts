import type { CSVRecord, ParseBinaryOptions } from "../../common/types.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "../../constants.ts";
import { parseBinaryToIterableIterator } from "../../parseBinaryToIterableIterator.ts";
import { convertIterableIteratorToAsync } from "../../utils/convertIterableIteratorToAsync.ts";

/**
 * Parse CSV binary in main thread.
 * This is the default binary parsing implementation.
 *
 * @internal
 * @param binary CSV binary to parse (Uint8Array or ArrayBuffer)
 * @param options Parsing options
 * @returns Async iterable iterator of records
 */
export function parseBinaryInMain<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  binary: Uint8Array | ArrayBuffer,
  options?: ParseBinaryOptions<Header, Delimiter, Quotation>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Use existing binary parsing implementation
  const iterator = parseBinaryToIterableIterator<Header>(
    binary,
    options as ParseBinaryOptions<Header> | undefined,
  );
  return convertIterableIteratorToAsync(iterator);
}
