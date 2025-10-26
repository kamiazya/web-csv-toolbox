import type { CSVRecord, ParseOptions } from "../../common/types.ts";
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
export function parseStringInMain<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Use existing synchronous implementation
  const iterator = parseStringToIterableIterator(csv, options);
  return convertIterableIteratorToAsync(iterator);
}
