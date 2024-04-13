import type { CSVRecord, ParseOptions, PickHeader } from "./common/types.ts";
import type { COMMA, DOUBLE_QUOTE } from "./constants.ts";
import { parseStringToArraySync } from "./parseStringToArraySync.ts";
import { parseStringToIterableIterator } from "./parseStringToIterableIterator.ts";
import { parseStringToStream } from "./parseStringToStream.ts";
import * as internal from "./utils/convertThisAsyncIterableIteratorToArray.ts";

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
export function parseString<
  CSVSource extends string,
  Delimiter extends string = typeof COMMA,
  Quotation extends string = typeof DOUBLE_QUOTE,
  Header extends ReadonlyArray<string> = PickHeader<
    CSVSource,
    Delimiter,
    Quotation
  >,
>(
  csv: CSVSource,
  options: ParseOptions<Header> & {
    delimiter?: Delimiter;
    quotation?: Quotation;
  },
): AsyncIterableIterator<CSVRecord<Header>>;
export function parseString<
  CSVSource extends string,
  Header extends ReadonlyArray<string> = PickHeader<CSVSource>,
>(
  csv: CSVSource,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>>;
export function parseString<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>>;
export async function* parseString<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  yield* parseStringToIterableIterator(csv, options);
}
export declare namespace parseString {
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
  export function toArray<Header extends ReadonlyArray<string>>(
    csv: string,
    options?: ParseOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
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
  export function toArraySync<Header extends ReadonlyArray<string>>(
    csv: string,
    options?: ParseOptions<Header>,
  ): CSVRecord<Header>[];
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
  export function toIterableIterator<Header extends ReadonlyArray<string>>(
    csv: string,
    options?: ParseOptions<Header>,
  ): IterableIterator<CSVRecord<Header>>;
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
  export function toStream<Header extends ReadonlyArray<string>>(
    csv: string,
    options?: ParseOptions<Header>,
  ): ReadableStream<CSVRecord<Header>>;
}
Object.defineProperties(parseString, {
  toArray: {
    enumerable: true,
    writable: false,
    value: internal.convertThisAsyncIterableIteratorToArray,
  },
  toArraySync: {
    enumerable: true,
    writable: false,
    value: parseStringToArraySync,
  },
  toIterableIterator: {
    enumerable: true,
    writable: false,
    value: parseStringToIterableIterator,
  },
  toStream: {
    enumerable: true,
    writable: false,
    value: parseStringToStream,
  },
});
