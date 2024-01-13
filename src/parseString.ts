import { CSVRecord, ParseOptions } from "./common/types.js";
import { parseStringToArraySync } from "./internal/parseStringToArraySync.js";
import { parseStringToIterableIterator } from "./internal/parseStringToIterableIterator.js";
import { parseStringToStream } from "./internal/parseStringToStream.js";
import * as internal from "./internal/utils/toArray.js";

/**
 * Parse CSV string to records.
 *
 * @category Middle-level API
 * @param csv CSV string to parse
 * @param options Parsing options. See {@link ParseOptions}.
 * @returns Async iterable iterator of records.
 *
 * If you want array of records, use {@link parseString.toArray} function.
 * @example Parsing CSV files from strings
 *
 * ```ts
 * import { parseString } from 'web-csv-toolbox';
 *
 * const csv = `name,age
 * Alice,42
 * Bob,69`;
 *
 * for await (const record of parseString(csv)) {
 *   console.log(record);
 * }
 * // Prints:
 * // { name: 'Alice', age: '42' }
 * // { name: 'Bob', age: '69' }
 * ```
 */
export async function* parseString<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  yield* parseStringToIterableIterator(csv, options);
}
export namespace parseString {
  /**
   * Parse CSV string to records.
   *
   * @returns Array of records
   *
   * @example
   * ```ts
   * import { parseString } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * const records = await parseString.toArray(csv);
   * console.log(records);
   * // Prints:
   * // [ { name: 'Alice', age: '42' }, { name: 'Bob', age: '69' } ]
   * ```
   */
  export declare function toArray<Header extends ReadonlyArray<string>>(
    csv: string,
    options?: ParseOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
  Object.defineProperty(parseString, "toArray", {
    enumerable: true,
    writable: false,
    value: internal.toArray,
  });

  /**
   * Parse CSV string to records.
   *
   * @returns Array of records
   *
   * @example
   *
   * ```ts
   * import { parseString } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * const records = parseString.toArraySync(csv);
   * console.log(records);
   * // Prints:
   * // [ { name: 'Alice', age: '42' }, { name: 'Bob', age: '69' } ]
   * ```
   */
  export declare function toArraySync<Header extends ReadonlyArray<string>>(
    csv: string,
    options?: ParseOptions<Header>,
  ): CSVRecord<Header>[];
  Object.defineProperty(parseString, "toArraySync", {
    enumerable: true,
    writable: false,
    value: parseStringToArraySync,
  });

  /**
   * Parse CSV string to records.
   *
   * @returns Async iterable iterator of records
   *
   * @example
   * ```ts
   * import { parseString } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * for (const record of parseString.toIterableIterator(csv)) {
   *   console.log(record);
   * }
   * // Prints:
   * // { name: 'Alice', age: '42' }
   * // { name: 'Bob', age: '69' }
   * ```
   */
  export declare function toIterableIterator<
    Header extends ReadonlyArray<string>,
  >(
    csv: string,
    options?: ParseOptions<Header>,
  ): IterableIterator<CSVRecord<Header>>;
  Object.defineProperty(parseString, "toIterableIterator", {
    enumerable: true,
    writable: false,
    value: parseStringToIterableIterator,
  });

  /**
   * Parse CSV string to records.
   *
   * @returns Readable stream of records
   *
   * @example
   * ```ts
   * import { parseString } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * await parseString.toStream(csv)
   *   .pipeTo(
   *      new WritableStream({
   *        write(record) {
   *          console.log(record);
   *        },
   *      }),
   *   );
   * // Prints:
   * // { name: 'Alice', age: '42' }
   * // { name: 'Bob', age: '69' }
   * ```
   */
  export declare function toStream<Header extends ReadonlyArray<string>>(
    csv: string,
    options?: ParseOptions<Header>,
  ): ReadableStream<CSVRecord<Header>>;
  Object.defineProperty(parseString, "toStream", {
    enumerable: true,
    writable: false,
    value: parseStringToStream,
  });
}
