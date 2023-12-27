import { CSVRecord, ParseBinaryOptions } from "./common/index.js";
import { type ParseOptions } from "./common/types.js";
import * as internal from "./internal/toArray.js";
import { parseBinaryStream } from "./parseBinaryStream.js";
import { parseStringStream } from "./parseStringStream.js";

/**
 * Parse CSV Stream to records,
 * ideal for smaller data sets.
 *
 * {@link !ReadableStream} of {@link !String} and {@link !Uint8Array} are supported.
 *
 * @remarks
 * {@link parseStringStream} and {@link parseBinaryStream} are used internally.
 * If you known the type of the stream, it performs better to use them directly.
 *
 * If you want to parse a string, use {@link parseStringStream}.
 * If you want to parse a Uint8Array, use {@link parseBinaryStream}.
 *
 * @category Middle-level API
 * @param csv CSV string to parse
 * @param options Parsing options. See {@link ParseOptions}.
 * @returns Async iterable iterator of records.
 *
 * If you want array of records, use {@link parseStream.toArray} function.
 *
 * @example Parsing CSV string stream
 *
 * ```ts
 *
 * import { parseStream } from 'web-csv-toolbox';
 *
 * const csv = `name,age
 * Alice,42
 * Bob,69`;
 *
 * const stream = new ReadableStream({
 *  start(controller) {
 *    controller.enqueue(csv);
 *   controller.close();
 * },
 * });
 *
 * for await (const record of parseStream(stream)) {
 *  console.log(record);
 * }
 * // Prints:
 * // { name: 'Alice', age: '42' }
 * // { name: 'Bob', age: '69' }
 * ```
 *
 * @example Parsing CSV binary stream
 *
 * ```ts
 * import { parseStream } from 'web-csv-toolbox';
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
 * for await (const record of parseStream(stream)) {
 *   console.log(record);
 * }
 * ```
 */
export async function* parseStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<Uint8Array | string>,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  const [branch1, branch2] = stream.tee();
  const reader1 = branch1.getReader();
  const { value: firstChunk } = await reader1.read();
  reader1.releaseLock();
  if (typeof firstChunk === "string") {
    yield* parseStringStream(branch2 as ReadableStream<string>, options);
  } else if (firstChunk instanceof Uint8Array) {
    yield* parseBinaryStream(branch2 as ReadableStream<Uint8Array>, options);
  }
}

export namespace parseStream {
  /**
   * Parse CSV Stream to array of records.
   *
   * @returns Array of records
   */
  export declare function toArray<Header extends ReadonlyArray<string>>(
    stream: ReadableStream<Uint8Array>,
    options?: ParseBinaryOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
  parseStream.toArray = internal.toArray;
}
