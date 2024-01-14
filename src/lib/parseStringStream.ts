import { CSVRecord, ParseOptions } from "./common/types.ts";
import { parseStringStreamToStream } from "./internal/parseStringStreamToStream.ts";
import { streamToAsyncIterableIterator } from "./internal/utils/streamToAsyncIterableIterator.ts";
import * as internal from "./internal/utils/toArray.ts";

/**
 * Parse CSV string stream to records.
 *
 * @category Middle-level API
 * @param stream CSV string stream to parse
 * @param options Parsing options.
 * @returns Async iterable iterator of records.
 *
 * If you want array of records, use {@link parseStringStream.toArray} function.
 *
 * @example Parsing CSV files from strings
 *
 * ```ts
 * import { parseStringStream } from 'web-csv-toolbox';
 *
 * const csv = `name,age
 * Alice,42
 * Bob,69`;
 *
 * const stream = new ReadableStream({
 *  start(controller) {
 *     controller.enqueue(csv);
 *     controller.close();
 *   },
 * });
 *
 * for await (const record of parseStringStream(csv)) {
 *   console.log(record);
 * }
 * // Prints:
 * // { name: 'Alice', age: '42' }
 * // { name: 'Bob', age: '69' }
 * ```
 */
export function parseStringStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  const recordStream = parseStringStreamToStream(stream, options);
  return streamToAsyncIterableIterator(recordStream);
}

export namespace parseStringStream {
  /**
   * Parse CSV string stream to records.
   *
   * @returns Array of records
   *
   * @example
   *
   * ```ts
   * import { parseStringStream } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * const stream = new ReadableStream({
   *   start(controller) {
   *     controller.enqueue(csv);
   *     controller.close();
   *   },
   * });
   *
   * const records = await parseStringStream.toArray(stream);
   * console.log(records);
   * // Prints:
   * // [ { name: 'Alice', age: '42' }, { name: 'Bob', age: '69' } ]
   * ```
   */
  export declare function toArray<Header extends ReadonlyArray<string>>(
    stream: ReadableStream<string>,
    options?: ParseOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
  Object.defineProperty(parseStringStream, "toArray", {
    enumerable: true,
    writable: false,
    value: internal.toArray,
  });

  /**
   * Parse CSV string stream to records.
   *
   * @returns Array of records
   *
   * @example
   *
   * ```ts
   * import { parseStringStream } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * const stream = new ReadableStream({
   *   start(controller) {
   *     controller.enqueue(csv);
   *     controller.close();
   *   },
   * });
   *
   * await parseStringStream.toStream(stream)
   *   .pipeTo(
   *     new WritableStream({
   *       write(record) {
   *       console.log(record);
   *     },
   *   }),
   * );
   * ```
   */
  export declare function toStream<Header extends ReadonlyArray<string>>(
    stream: ReadableStream<string>,
    options?: ParseOptions<Header>,
  ): ReadableStream<CSVRecord<Header>>;
  Object.defineProperty(parseStringStream, "toStream", {
    enumerable: true,
    writable: false,
    value: parseStringStreamToStream,
  });
}