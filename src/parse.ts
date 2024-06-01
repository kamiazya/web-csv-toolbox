import type {
  CSV,
  CSVBinary,
  CSVRecord,
  CSVString,
  ParseBinaryOptions,
  ParseOptions,
} from "./common/types.ts";
import { parseBinary } from "./parseBinary.ts";
import { parseResponse } from "./parseResponse.ts";
import { parseString } from "./parseString.ts";
import { parseStringStream } from "./parseStringStream.ts";
import { parseUint8ArrayStream } from "./parseUint8ArrayStream.ts";
import * as internal from "./utils/convertThisAsyncIterableIteratorToArray.ts";

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
 * {@link parseString}, {@link parseBinary}, {@link parseUint8ArrayStream},
 * {@link parseStringStream} and {@link parseResponse} are used internally.
 *
 * If you known the type of the CSV, it performs better to use them directly.
 *
 * | If you want to parse a...                    | Use...                        | Options...                 |
 * | -------------------------------------------- | ----------------------------- | -------------------------- |
 * | {@link !String}                              | {@link parseString}           | {@link ParseOptions}       |
 * | {@link !ReadableStream}<{@link !String}>     | {@link parseStringStream}     | {@link ParseOptions}       |
 * | {@link !Uint8Array} \| {@link !ArrayBuffer}  | {@link parseBinary}           | {@link ParseBinaryOptions} |
 * | {@link !ReadableStream}<{@link !Uint8Array}> | {@link parseUint8ArrayStream} | {@link ParseBinaryOptions} |
 * | {@link !Response}                            | {@link parseResponse}         | {@link ParseBinaryOptions} |
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
  csv: CSVString,
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
 * // This CSV data is gzipped and encoded in shift-jis.
 * const response = await fetch('https://example.com/data.csv.gz');
 *
 * for await (const record of parse(response, {
 *   charset: 'shift-jis',
 *   decomposition: 'gzip',
 * })) {
 *   // ...
 * }
 * ```
 */
export function parse<Header extends ReadonlyArray<string>>(
  csv: CSVBinary,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>>;
export async function* parse<Header extends ReadonlyArray<string>>(
  csv: CSV,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  if (typeof csv === "string") {
    yield* parseString(csv, options);
  } else if (csv instanceof Uint8Array || csv instanceof ArrayBuffer) {
    yield* parseBinary(csv, options);
  } else if (csv instanceof ReadableStream) {
    const [branch1, branch2] = csv.tee();
    const reader1 = branch1.getReader();
    const { value: firstChunk } = await reader1.read();
    reader1.releaseLock();
    if (typeof firstChunk === "string") {
      yield* parseStringStream(branch2 as ReadableStream<string>, options);
    } else if (firstChunk instanceof Uint8Array) {
      yield* parseUint8ArrayStream(
        branch2 as ReadableStream<Uint8Array>,
        options,
      );
    }
  } else if (csv instanceof Response) {
    yield* parseResponse(csv, options);
  }
}

export declare namespace parse {
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
  export function toArray<Header extends ReadonlyArray<string>>(
    csv: CSVString,
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
  export function toArray<Header extends ReadonlyArray<string>>(
    csv: CSVBinary,
    options?: ParseBinaryOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
}

Object.defineProperties(parse, {
  toArray: {
    enumerable: true,
    writable: false,
    value: internal.convertThisAsyncIterableIteratorToArray,
  },
});
