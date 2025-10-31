import type { CSVRecord, ParseOptions } from "../../common/types.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "../../constants.ts";
import { parseStringToIterableIterator } from "../../parseStringToIterableIterator.ts";
import { convertIterableIteratorToAsync } from "../../utils/convertIterableIteratorToAsync.ts";

/**
 * Parse CSV string in main thread.
 * This is the default implementation.
 *
 * @internal
 * @param csv CSV string to parse
 * @param options Parsing options
 * @returns Async iterable iterator of records
 */
export function parseStringInMain<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  csv: string,
  options?: ParseOptions<Header, Delimiter, Quotation>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Use existing synchronous implementation
  const iterator = parseStringToIterableIterator<Header>(
    csv,
    options as ParseOptions<Header> | undefined,
  );
  return convertIterableIteratorToAsync(iterator);
}
