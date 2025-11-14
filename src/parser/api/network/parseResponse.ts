import * as internal from "@/converters/iterators/convertThisAsyncIterableIteratorToArray.ts";
import type { CSVRecord, ParseOptions } from "@/core/types.ts";
import { parseUint8ArrayStream } from "@/parser/api/binary/parseUint8ArrayStream.ts";
import { parseResponseToStream } from "@/parser/api/network/parseResponseToStream.ts";
import { commonParseErrorHandling } from "@/utils/error/commonParseErrorHandling.ts";
import { getOptionsFromResponse } from "@/utils/response/getOptionsFromResponse.ts";

/**
 * Parse HTTP Response what contains CSV to records,
 * ideal for smaller data sets.
 *
 * @remarks
 * This function automatically treats response headers.
 *
 * - If `Content-Type` header is not set, it assumes `text/csv`.
 * - If `Content-Type` header is not `text/csv`, it throws an error.
 * - If `Content-Type` header has charset parameter, it uses it for decoding.
 * - If `Content-Encoding` header is set, it decompresses the response.
 * - Should there be any conflicting information between the header and the options, the option's value will take precedence.
 *
 * @category Middle-level API
 * @param response
 * @param options
 * @returns Async iterable iterator of records.
 *
 * If you want array of records, use {@link parseResponse.toArray} function.
 *
 * @example Parsing CSV Response
 *
 * ```ts
 * import { parseResponse } from 'web-csv-toolbox';
 *
 * const response = await fetch('https://example.com/data.csv');
 *
 * for await (const record of parseResponse(response)) {
 *   console.log(record);
 * }
 * ```
 */
export function parseResponse<Header extends ReadonlyArray<string>>(
  response: Response,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Validate synchronously before creating async generator
  const options_ = getOptionsFromResponse(response, options);
  if (response.body === null) {
    throw new TypeError("Response body is null");
  }

  // Return wrapper async generator for error handling
  return (async function* () {
    try {
      yield* parseUint8ArrayStream(response.body!, options_);
    } catch (error) {
      commonParseErrorHandling(error);
    }
  })();
}

export declare namespace parseResponse {
  /**
   * Parse CSV Response to array of records.
   *
   * @returns Array of records
   *
   * @example Parsing CSV Response
   *
   * ```ts
   * import { parseResponse } from 'web-csv-toolbox';
   *
   * const response = await fetch('https://example.com/data.csv');
   *
   * const records = await parseResponse.toArray(response);
   * console.log(records);
   * ```
   */
  export function toArray<Header extends ReadonlyArray<string>>(
    response: Response,
    options?: ParseOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
  /**
   * Parse CSV Response to stream of records.
   *
   * @param response Response to parse
   * @returns Stream of records
   *
   * @example Parsing CSV Response
   *
   * ```ts
   * import { parseResponse } from 'web-csv-toolbox';
   *
   * const response = await fetch('https://example.com/data.csv');
   *
   * await parseResponse.toStream(response)
   *   .pipeTo(
   *     new WritableStream({
   *       write(record) {
   *         console.log(record);
   *       },
   *    }),
   * );
   * // Prints:
   * // { name: 'Alice', age: '42' }
   * // { name: 'Bob', age: '69' }
   * ```
   */
  export function toStream<Header extends ReadonlyArray<string>>(
    response: Response,
    options?: ParseOptions<Header>,
  ): ReadableStream<CSVRecord<Header>>;
}

Object.defineProperties(parseResponse, {
  toArray: {
    enumerable: true,
    writable: false,
    value: internal.convertThisAsyncIterableIteratorToArray,
  },
  toStreamSync: {
    enumerable: true,
    writable: false,
    value: parseResponseToStream,
  },
});
