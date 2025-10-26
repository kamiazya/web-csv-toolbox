import type { CSVRecord, ParseOptions } from "../../common/types.ts";
import { parseStringStreamToStream } from "../../parseStringStreamToStream.ts";
import { convertStreamToAsyncIterableIterator } from "../../utils/convertStreamToAsyncIterableIterator.ts";

/**
 * Parse CSV stream in main thread.
 * This is the default streaming implementation.
 *
 * @internal
 * @param stream CSV string stream to parse
 * @param options Parsing options
 * @returns Async iterable iterator of records
 */
export function parseStreamInMain<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Use existing stream implementation
  const recordStream = parseStringStreamToStream(stream, options);
  return convertStreamToAsyncIterableIterator(recordStream);
}
