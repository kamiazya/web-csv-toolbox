import { CSVRecord, ParseBinaryOptions, ParseOptions } from "./common/types.js";
import * as internal from "./internal/toArray.js";
import { type parseBinaryStream } from "./parseBinaryStream.js";
import { parseResponse } from "./parseResponse.js";
import { parseStream } from "./parseStream.js";
import { parseString } from "./parseString.js";
import { type parseStringStream } from "./parseStringStream.js";

/**
 * Parse CSV to records.
 *
 * {@link !String}, {@link !ReadableStream}<string | {@link !Uint8Array}> and {@link !Response} are supported.
 *
 *
 * @typeParam Header Header type like `['name', 'age']`.
 *
 * @param csv CSV string to parse.
 * @param options Parsing options for CSV string parsing.
 * @returns Async iterable iterator of records.
 *
 * If you want array of records, use {@link parse.toArray} function.
 * @category High-level API
 *
 * @remarks
 * {@link parseString}, {@link parseBinaryStream},
 * {@link parseStringStream} and {@link parseResponse} are used internally.
 *
 * If you known the type of the CSV, it performs better to use them directly.
 *
 * | If you want to parse a...           | Use...                    | Data are treated as... |
 * | ----------------------------------- | ------------------------- | ---------------------- |
 * | {@link !String}                     | {@link parseString}    | String                 |
 * | {@link !ReadableStream}<string>     | {@link parseStringStream} | String                 |
 * | {@link !ReadableStream}<Uint8Array> | {@link parseBinaryStream} | Binary                 |
 * | {@link !Response}                   | {@link parseResponse}     | Binary                 |
 *
 * @example Parsing CSV files from strings
 *
 * ```ts
 * import { parse } from 'web-csv-toolbox';
 *
 * const csv = `name,age
 * Alice,42
 * Bob,69`;
 *
 * for await (const record of parse(csv)) {
 *   console.log(record);
 * }
 * // Prints:
 * // { name: 'Alice', age: '42' }
 * // { name: 'Bob', age: '69' }
 * ```
 *
 * @example Parsing CSV files from streams
 *
 * ```ts
 * import { parse } from 'web-csv-toolbox';
 *
 * const csv = `name,age
 * Alice,42
 * Bob,69`;
 *
 * const stream = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue(csv);
 *     controller.close();
 *   }
 * });
 *
 * for await (const record of parse(stream)) {
 *  console.log(record);
 * }
 * // Prints:
 * // { name: 'Alice', age: '42' }
 * // { name: 'Bob', age: '69' }
 * ```
 *
 *
 * @example Parsing CSV files with headers
 *
 * ```ts
 * import { parse } from 'web-csv-toolbox';
 *
 * // This CSV has no header.
 * const csv = `Alice,42
 * Bob,69`;
 *
 * for await (const record of parse(csv, { header: ['name', 'age'] })) {
 *  console.log(record);
 * }
 * // Prints:
 * // { name: 'Alice', age: '42' }
 * // { name: 'Bob', age: '69' }
 * ```
 *
 * @example Parsing CSV files with different delimiters characters
 *
 * ```ts
 * import { parse } from 'web-csv-toolbox';
 *
 * const csv = `name\tage
 * Alice\t42
 * Bob\t69`;
 *
 * for await (const record of parse(csv, { delimiter: '\t' })) {
 * console.log(record);
 * }
 * // Prints:
 * // { name: 'Alice', age: '42' }
 * // { name: 'Bob', age: '69' }
 * ```
 */
export function parse<Header extends ReadonlyArray<string>>(
  csv: string | ReadableStream<string>,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>>;
/**
 * Parse CSV binary to records.
 *
 * @param csv CSV binary to parse.
 * @param options Parsing options for CSV binary parsing.
 *
 * @example Parsing CSV files from responses
 *
 * ```ts
 * import { parse } from 'web-csv-toolbox';
 *
 * // This CSV data is not gzipped and encoded in utf-8.
 * const response = await fetch('https://example.com/data.csv');
 *
 * for await (const record of parse(response)) {
 *   // ...
 * }
 * ```
 *
 * @example Parsing CSV files with options spcialized for binary
 *
 * ```ts
 * import { parse } from 'web-csv-toolbox';
 *
 * // This CSV data is gzipped and encoded in shift-jis and has BOM.
 * const response = await fetch('https://example.com/data.csv.gz');
 *
 * for await (const record of parse(response, {
 *   charset: 'shift-jis',
 *   ignoreBOM: true,
 *   decomposition: 'gzip',
 * })) {
 *   // ...
 * }
 * ```
 */
export function parse<Header extends ReadonlyArray<string>>(
  csv: ReadableStream<Uint8Array> | Response,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>>;
export async function* parse<Header extends ReadonlyArray<string>>(
  csv: string | ReadableStream<Uint8Array | string> | Response,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  if (typeof csv === "string") {
    yield* parseString(csv, options);
  } else if (csv instanceof ReadableStream) {
    yield* parseStream(csv, options);
  } else if (csv instanceof Response) {
    yield* parseResponse(csv, options);
  }
}
export namespace parse {
  /**
   * Parse CSV string to array of records,
   * ideal for smaller data sets.
   *
   * @example Parse a CSV as array of records
   *
   * ```ts
   * import { parse } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * const records = await parse.toArray(csv);
   * console.log(records);
   * // Prints:
   * // [ { name: 'Alice', age: '42' }, { name: 'Bob', age: '69' } ]
   * ```
   */
  export declare function toArray<Header extends ReadonlyArray<string>>(
    csv: string | ReadableStream<string>,
    options?: ParseOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
  /**
   * Parse CSV string to array of records,
   * ideal for smaller data sets.
   *
   * @example Parse a CSV as array of records
   *
   * ```ts
   * import { parse } from 'web-csv-toolbox';
   *
   * const response = await fetch('https://example.com/data.csv');
   *
   * const records = await parse.toArray(response);
   * console.log(records);
   * ```
   */
  export declare function toArray<Header extends ReadonlyArray<string>>(
    csv: ReadableStream<Uint8Array> | Response,
    options?: ParseOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
  parse.toArray = internal.toArray;
}
