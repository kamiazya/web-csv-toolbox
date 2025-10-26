import type { CSVRecord, ParseBinaryOptions } from "./common/types.ts";
import { routeUint8ArrayStreamParsing } from "./execution/router.ts";
import { parseUint8ArrayStreamToStream } from "./parseUint8ArrayStreamToStream.ts";
import { convertStreamToAsyncIterableIterator } from "./utils/convertStreamToAsyncIterableIterator.ts";
import * as internal from "./utils/convertThisAsyncIterableIteratorToArray.ts";

/**
 * Parse CSV to records.
 * This function is for parsing a binary stream.
 *
 * @category Middle-level API
 * @remarks
 * If you want to parse a string, use {@link parseStringStream}.
 * @param stream CSV string to parse
 * @param options Parsing options.
 * @returns Async iterable iterator of records.
 *
 * If you want array of records, use {@link parseUint8ArrayStream.toArray} function.
 *
 * @example Parsing CSV binary
 *
 * ```ts
 * import { parseUint8ArrayStream } from 'web-csv-toolbox';
 *
 * const csv = Uint8Array.from([
 *  // ...
 * ]);
 *
 * const stream = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue(csv);
 *     controller.close();
 *   },
 * });
 *
 * for await (const record of parseUint8ArrayStream(csv)) {
 *   console.log(record);
 * }
 * ```
 */
export function parseUint8ArrayStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header>,
):
  | AsyncIterableIterator<CSVRecord<Header>>
  | Promise<AsyncIterableIterator<CSVRecord<Header>>> {
  // If execution strategies are specified, use the router
  if (options?.execution && options.execution.length > 0) {
    return routeUint8ArrayStreamParsing(stream, options);
  }

  // Default: use existing implementation (backward compatible)
  const recordStream = parseUint8ArrayStreamToStream(stream, options);
  return convertStreamToAsyncIterableIterator(recordStream);
}

export declare namespace parseUint8ArrayStream {
  /**
   * Parse CSV binary to array of records,
   * ideal for smaller data sets.
   *
   * @returns Array of records
   *
   * @example Parsing CSV binary
   * ```ts
   * import { parseUint8ArrayStream } from 'web-csv-toolbox';
   *
   * const csv = Uint8Array.from([
   *   // ...
   * ]);
   *
   * const stream = new ReadableStream({
   *   start(controller) {
   *     controller.enqueue(csv);
   *     controller.close();
   *   },
   * });
   *
   * const records = await parseUint8ArrayStream.toArray(stream);
   * console.log(records);
   * ```
   */
  export function toArray<Header extends ReadonlyArray<string>>(
    stream: ReadableStream<Uint8Array>,
    options?: ParseBinaryOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
  /**
   * Parse CSV binary to array of records.
   *
   * @returns Stream of records
   *
   * @example Parsing CSV binary
   * ```ts
   * import { parseUint8ArrayStream } from 'web-csv-toolbox';
   *
   * const csv = Uint8Array.from([
   *  // ...
   * ]);
   *
   * const stream = new ReadableStream({
   *  start(controller) {
   *   controller.enqueue(csv);
   *  controller.close();
   * },
   * });
   *
   * await parseUint8ArrayStream.toStream(stream)
   *   .pipeTo(new WritableStream({
   *     write(record) {
   *       console.log(record);
   *     },
   *   }),
   * );
   * ```
   */
  export function toStream<Header extends ReadonlyArray<string>>(
    stream: ReadableStream<Uint8Array>,
    options?: ParseBinaryOptions<Header>,
  ): ReadableStream<CSVRecord<Header>[]>;
}
Object.defineProperties(parseUint8ArrayStream, {
  toArray: {
    enumerable: true,
    writable: false,
    value: internal.convertThisAsyncIterableIteratorToArray,
  },
  toStream: {
    enumerable: true,
    writable: false,
    value: parseUint8ArrayStreamToStream,
  },
});
