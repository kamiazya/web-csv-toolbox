import { CSVRecord, ParseBinaryOptions } from "./common/types.js";
import * as internal from "./internal/toArray.js";
import { parseUint8Array } from "./parseUint8Array.js";

/**
 * Parse a binary from an {@link !ArrayBuffer}.
 *
 * @category Middle-level API

 * @param buffer CSV ArrayBuffer to parse.
 * @param options Parsing options
 * @returns Async iterable iterator of records.
 *
 * @example Parsing CSV files from ArrayBuffers
 *
 * ```ts
 * import { parseArrayBuffer } from 'web-csv-toolbox';
 *
 * const csv = `name,age
 * Alice,42
 * Bob,69`;
 *
 * const buffer = new TextEncoder().encode(csv).buffer;
 *
 * for await (const record of parseArrayBuffer(buffer)) {
 *   console.log(record);
 * }
 * // Prints:
 * // { name: 'Alice', age: '42' }
 * // { name: 'Bob', age: '69' }
 * ```
 */
export function parseArrayBuffer<Header extends ReadonlyArray<string>>(
  buffer: ArrayBuffer,
  options?: ParseBinaryOptions<Header>,
) {
  return parseUint8Array(new Uint8Array(buffer), options);
}
export namespace parseArrayBuffer {
  /**
   * Parse a binary from an {@link !ArrayBuffer} to an array of records.
   * @param buffer CSV ArrayBuffer to parse.
   * @param options Parsing options
   * @returns Array of records
   * @example
   * ```ts
   * import { parseArrayBuffer } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * const buffer = new TextEncoder().encode(csv).buffer;
   *
   * const records = await parseArrayBuffer.toArray(buffer);
   * console.log(records);
   * // Prints:
   * // [ { name: 'Alice', age: '42' }, { name: 'Bob', age: '69' } ]
   * ```
   */
  export declare function toArray<Header extends ReadonlyArray<string>>(
    buffer: ArrayBuffer,
    options?: ParseBinaryOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
  Object.defineProperty(parseArrayBuffer, "toArray", {
    enumerable: true,
    writable: false,
    value: internal.toArray,
  });
}
