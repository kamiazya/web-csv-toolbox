import { CSVRecord, ParseBinaryOptions } from "./common/types.js";
import { SingleValueReadableStream } from "./internal/SingleValueReadableStream.js";
import { binaryToArraySync } from "./internal/binaryToArraySync.js";
import { binaryToIterableIterator } from "./internal/binaryToIterableIterator.js";
import { binaryToStream } from "./internal/binaryToStream.js";
import * as internal from "./internal/toArray.js";
import { parseUint8ArrayStream } from "./parseUint8ArrayStream.js";

/**
 * Parse a binary from an {@link !Uint8Array}.
 *
 * @category Middle-level API
 *
 * @param bytes CSV bytes to parse.
 * @param options Parsing options
 * @returns Async iterable iterator of records.
 *
 * @example Parsing CSV binary
 *
 * ```ts
 * import { parseUint8Array } from 'web-csv-toolbox';
 *
 * const csv = Uint8Array.from([
 *   // ...
 * ]);
 *
 * for await (const record of parseUint8Array(csv)) {
 *   console.log(record);
 * }
 * ```
 */
export function parseUint8Array<Header extends ReadonlyArray<string>>(
  bytes: Uint8Array,
  options?: ParseBinaryOptions<Header>,
) {
  return parseUint8ArrayStream(new SingleValueReadableStream(bytes), options);
}

export namespace parseUint8Array {
  /**
   * Parse a binary from an {@link !Uint8Array} to an array of records.
   *
   * @param bytes CSV bytes to parse.
   * @param options Parsing options
   * @returns Array of records
   *
   * @example
   * ```ts
   * import { parseUint8Array } from 'web-csv-toolbox';
   *
   * const csv = Uint8Array.from([
   *  // ...
   * ]);
   *
   * const records = await parseUint8Array.toArray(csv);
   * ```
   */
  export declare function toArray<Header extends ReadonlyArray<string>>(
    bytes: Uint8Array,
    options?: ParseBinaryOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
  Object.defineProperty(parseUint8Array, "toArray", {
    enumerable: true,
    writable: false,
    value: internal.toArray,
  });

  export declare function toArraySync<Header extends ReadonlyArray<string>>(
    bytes: Uint8Array,
    options?: ParseBinaryOptions<Header>,
  ): CSVRecord<Header>[];
  Object.defineProperty(parseUint8Array, "toArraySync", {
    enumerable: true,
    writable: false,
    value: binaryToArraySync,
  });

  export declare function toIterableIterator<
    Header extends ReadonlyArray<string>,
  >(
    bytes: Uint8Array,
    options?: ParseBinaryOptions<Header>,
  ): IterableIterator<CSVRecord<Header>>;
  Object.defineProperty(parseUint8Array, "toIterableIterator", {
    enumerable: true,
    writable: false,
    value: binaryToIterableIterator,
  });

  export declare function toStream<Header extends ReadonlyArray<string>>(
    bytes: Uint8Array,
    options?: ParseBinaryOptions<Header>,
  ): ReadableStream<CSVRecord<Header>>;
  Object.defineProperty(parseUint8Array, "toStream", {
    enumerable: true,
    writable: false,
    value: binaryToStream,
  });
}
