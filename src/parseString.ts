import type { CSVRecord, ParseOptions } from "./common/types.ts";
import { commonParseErrorHandling } from "./commonParseErrorHandling.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "./constants.ts";
import { routeStringParsing } from "./execution/router.ts";
import { parseStringToArraySync } from "./parseStringToArraySync.ts";
import { parseStringToIterableIterator } from "./parseStringToIterableIterator.ts";
import { parseStringToStream } from "./parseStringToStream.ts";
import * as internal from "./utils/convertThisAsyncIterableIteratorToArray.ts";
import type { PickCSVHeader } from "./utils/types.ts";

/**
 * Parse CSV string to records.
 *
 * @category Middle-level API
 * @param csv CSV string to parse
 * @param options Parsing options. See {@link ParseOptions}.
 * @returns Async iterable iterator of records.
 *
 * If you want array of records, use {@link parseString.toArray} function.
 *
 * @remarks
 * **Performance Characteristics:**
 * - **Memory usage**: O(1) - constant per record (streaming approach)
 * - **Suitable for**: Files of any size
 * - **Recommended for**: Large CSV strings (> 10MB) or memory-constrained environments
 *
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
export function parseString<const CSVSource extends string>(
  csv: CSVSource,
): AsyncIterableIterator<CSVRecord<PickCSVHeader<CSVSource>>>;
export function parseString<const Header extends ReadonlyArray<string>>(
  csv: string,
): AsyncIterableIterator<CSVRecord<Header>>;
export function parseString<const Header extends ReadonlyArray<string>>(
  csv: string,
  options: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>>;
export function parseString<
  const CSVSource extends string,
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Header extends ReadonlyArray<string> = PickCSVHeader<
    CSVSource,
    Delimiter,
    Quotation
  >,
>(
  csv: CSVSource,
  options?: ParseOptions<Header, Delimiter, Quotation>,
): AsyncIterableIterator<CSVRecord<Header>>;
export function parseString(
  csv: string,
  options?: ParseOptions,
): AsyncIterableIterator<CSVRecord<string[]>>;
export async function* parseString<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  try {
    // If execution strategies are specified, use the router
    if (options?.execution && options.execution.length > 0) {
      yield* await routeStringParsing(csv, options);
    } else {
      // Default: use existing implementation (backward compatible)
      yield* parseStringToIterableIterator(csv, options);
    }
  } catch (error) {
    commonParseErrorHandling(error);
  }
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
