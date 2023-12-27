import { CSVRecord, ParseBinaryOptions } from "./common/types.js";
import * as internal from "./internal/toArray.js";
import { parseStringStream } from "./parseStringStream.js";

/**
 * Parse CSV to records.
 * This function is for parsing a binary stream.
 *
 * @category Middle-level API
 * @remarks
 * If you want to parse a string, use {@link parseStringStream}.
 * @param stream CSV string to parse
 * @param options Parsing options. See {@link ParseBinaryOptions}.
 * @returns Async iterable iterator of records.
 *
 * If you want array of records, use {@link parseBinaryStream.toArray} function.
 *
 * @example Parsing CSV binary
 *
 * ```ts
 * import { parseBinaryStream } from 'web-csv-toolbox';
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
 * for await (const record of parseBinaryStream(csv)) {
 * console.log(record);
 * }
 * ```
 */
export async function* parseBinaryStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  const { charset, fatal, ignoreBOM, decomposition } = options ?? {};
  yield* parseStringStream(
    [
      // NOTE: if decompression is undefined, it will be ignored.
      ...(decomposition ? [new DecompressionStream(decomposition)] : []),
      // NOTE: if charset is undefined, it will be decoded as utf-8.
      new TextDecoderStream(charset, { fatal, ignoreBOM }),
    ].reduce<ReadableStream>(
      (stream, transformer) => stream.pipeThrough(transformer),
      stream,
    ),
    options,
  );
}

export namespace parseBinaryStream {
  /**
   * Parse CSV binary to array of records,
   * ideal for smaller data sets.
   *
   * @returns Array of records
   *
   * @example Parsing CSV binary
   * ```ts
   * import { parseBinaryStream } from 'web-csv-toolbox';
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
   * const records = await parseBinaryStream.toArray(stream);
   * console.log(records);
   * ```
   */
  export declare function toArray<Header extends ReadonlyArray<string>>(
    stream: ReadableStream<Uint8Array>,
    options?: ParseBinaryOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
  parseBinaryStream.toArray = internal.toArray;
}
