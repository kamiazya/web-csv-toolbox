import type { CSVRecord, ParseBinaryOptions } from "../../common/types.ts";
import { parseUint8ArrayStreamToStream } from "../../parseUint8ArrayStreamToStream.ts";
import { convertStreamToAsyncIterableIterator } from "../../utils/convertStreamToAsyncIterableIterator.ts";

/**
 * Parse CSV Uint8Array stream in main thread.
 * This is the default streaming implementation.
 *
 * @internal
 * @param stream CSV Uint8Array stream to parse
 * @param options Parsing options
 * @returns Async iterable iterator of records
 */
export function parseUint8ArrayStreamInMain<
  Header extends ReadonlyArray<string>,
>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Use existing stream implementation
  const recordStream = parseUint8ArrayStreamToStream(stream, options);
  return convertStreamToAsyncIterableIterator(recordStream);
}
