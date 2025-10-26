import type { CSVRecord, ParseBinaryOptions } from "../../common/types.ts";
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
export function parseBinaryInMain<Header extends ReadonlyArray<string>>(
  binary: Uint8Array | ArrayBuffer,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Use existing binary parsing implementation
  const iterator = parseBinaryToIterableIterator(binary, options);
  return convertIterableIteratorToAsync(iterator);
}
