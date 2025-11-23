import * as internal from "@/converters/iterators/convertThisAsyncIterableIteratorToArray.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  CSVBinary,
  CSVData,
  CSVRecord,
  CSVString,
  InferCSVRecord,
  ParseBinaryOptions,
  ParseOptions,
  PickCSVHeader,
} from "@/core/types.ts";
import { parseBinary } from "@/parser/api/binary/parseBinary.ts";
import { parseBinaryStream } from "@/parser/api/binary/parseBinaryStream.ts";
import { parseBlob } from "@/parser/api/file/parseBlob.ts";
import { parseRequest } from "@/parser/api/network/parseRequest.ts";
import { parseResponse } from "@/parser/api/network/parseResponse.ts";
import { parseString } from "@/parser/api/string/parseString.ts";
import { parseStringStream } from "@/parser/api/string/parseStringStream.ts";

/**
 * Parse CSV to records.
 *
 * {@link !String}, {@link !ReadableStream}<string | {@link !Uint8Array}>, {@link !Response}, {@link !Request}, {@link !Blob}, and {@link !File} are supported.
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
 * {@link parseString}, {@link parseBinary}, {@link parseBinaryStream},
 * {@link parseStringStream}, {@link parseResponse}, {@link parseRequest}, and {@link parseBlob} are used internally.
 *
 * If you known the type of the CSV, it performs better to use them directly.
 *
 * | If you want to parse a...                    | Use...                        | Options...                 |
 * | -------------------------------------------- | ----------------------------- | -------------------------- |
 * | {@link !String}                              | {@link parseString}           | {@link ParseOptions}       |
 * | {@link !ReadableStream}<{@link !String}>     | {@link parseStringStream}     | {@link ParseOptions}       |
 * | {@link !Uint8Array} \| {@link !ArrayBuffer}  | {@link parseBinary}           | {@link ParseBinaryOptions} |
 * | {@link !ReadableStream}<{@link !Uint8Array}> | {@link parseBinaryStream} | {@link ParseBinaryOptions} |
 * | {@link !Response}                            | {@link parseResponse}         | {@link ParseBinaryOptions} |
 * | {@link !Request}                             | {@link parseRequest}          | {@link ParseBinaryOptions} |
 * | {@link !Blob} \| {@link !File}               | {@link parseBlob}             | {@link ParseBinaryOptions} |
 *
 * **Performance Characteristics:**
 * - **Memory usage**: O(1) - constant per record (streaming approach)
 * - **Suitable for**: Files of any size, browser and server environments
 * - **Recommended for**: Large files (> 10MB) or memory-constrained environments
 *
 * This function processes CSV data as an async iterable iterator, yielding one record at a time.
 * Memory footprint remains constant regardless of file size, making it ideal for large datasets.
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
export function parse<const CSVSource extends CSVString>(
  csv: CSVSource,
): AsyncIterableIterator<CSVRecord<PickCSVHeader<CSVSource>, "object">>;
export function parse<const Header extends ReadonlyArray<string>>(
  csv: CSVString,
): AsyncIterableIterator<CSVRecord<Header, "object">>;
export function parse<
  const CSVSource extends CSVString,
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Header extends ReadonlyArray<string> = PickCSVHeader<
    CSVSource,
    Delimiter,
    Quotation
  >,
  const Options extends ParseOptions<
    Header,
    Delimiter,
    Quotation
  > = ParseOptions<Header, Delimiter, Quotation>,
>(
  csv: CSVSource,
  options: Options,
): AsyncIterableIterator<InferCSVRecord<Header, Options>>;
export function parse<
  const Header extends ReadonlyArray<string>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  csv: CSVString,
  options: Options,
): AsyncIterableIterator<InferCSVRecord<Header, Options>>;
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
 *   decompression: 'gzip',
 * })) {
 *   // ...
 * }
 * ```
 */
export function parse<
  const Header extends ReadonlyArray<string>,
  const Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
>(
  csv: CSVBinary,
  options?: Options,
): AsyncIterableIterator<InferCSVRecord<Header, Options>>;
export async function* parse<
  const Header extends ReadonlyArray<string>,
  const Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
>(
  csv: CSVData,
  options?: Options,
): AsyncIterableIterator<InferCSVRecord<Header, Options>> {
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
      yield* parseBinaryStream(
        branch2 as ReadableStream<Uint8Array>,
        options,
      );
    }
  } else if (csv instanceof Response) {
    yield* parseResponse(csv, options);
  } else if (csv instanceof Request) {
    yield* parseRequest(csv, options);
  } else if (csv instanceof Blob) {
    yield* parseBlob(csv, options);
  }
}

export declare namespace parse {
  /**
   * Parse CSV string to array of records,
   * ideal for smaller data sets.
   *
   * @remarks
   * **Performance Characteristics:**
   * - **Memory usage**: O(n) - proportional to file size (loads entire result into memory)
   * - **Suitable for**: Small datasets, quick prototyping
   * - **Recommended max**: ~10MB (browser), ~100MB (Node.js/Deno)
   *
   * This function collects all records into an array before returning.
   * For large files, consider using the streaming {@link parse} function instead.
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
  export function toArray<
    Header extends ReadonlyArray<string>,
    Options extends ParseOptions<Header> = ParseOptions<Header>,
  >(
    csv: CSVString,
    options?: Options,
  ): Promise<InferCSVRecord<Header, Options>[]>;
  /**
   * Parse CSV binary to array of records,
   * ideal for smaller data sets.
   *
   * @remarks
   * **Performance Characteristics:**
   * - **Memory usage**: O(n) - proportional to file size (loads entire result into memory)
   * - **Suitable for**: Small datasets, quick prototyping
   * - **Recommended max**: ~10MB (browser), ~100MB (Node.js/Deno)
   *
   * This function collects all records into an array before returning.
   * For large files, consider using the streaming {@link parse} function instead.
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
  export function toArray<
    Header extends ReadonlyArray<string>,
    Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
  >(
    csv: CSVBinary,
    options?: Options,
  ): Promise<InferCSVRecord<Header, Options>[]>;
}

Object.defineProperties(parse, {
  toArray: {
    enumerable: true,
    writable: false,
    value: internal.convertThisAsyncIterableIteratorToArray,
  },
});
