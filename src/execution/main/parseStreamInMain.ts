import type { CSVRecord, ParseOptions } from "../../common/types.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "../../constants.ts";
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
export function parseStreamInMain<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header, Delimiter, Quotation>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Use existing stream implementation
  const recordStream = parseStringStreamToStream<ReadableStream<string>, Header>(
    stream,
    options as ParseOptions<Header> | undefined,
  );
  return convertStreamToAsyncIterableIterator(recordStream);
}
