import { CSVRecord, ParseOptions } from "./common/index.js";
import { getOptionsFromResponse } from "./internal/getOptionsFromResponse.js";
import { responseToStream } from "./internal/responseToStream.js";
import * as internal from "./internal/toArray.js";
import { parseUint8ArrayStream } from "./parseUint8ArrayStream.js";

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
  const options_ = getOptionsFromResponse(response, options);
  if (response.body === null) {
    throw new Error("Response body is null");
  }
  return parseUint8ArrayStream(response.body, options_);
}

export namespace parseResponse {
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
  export declare function toArray<Header extends ReadonlyArray<string>>(
    response: Response,
    options?: ParseOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
  Object.defineProperty(parseResponse, "toArray", {
    enumerable: true,
    writable: false,
    value: internal.toArray,
  });

  export declare function toStream<Header extends ReadonlyArray<string>>(
    response: Response,
    options?: ParseOptions<Header>,
  ): ReadableStream<CSVRecord<Header>[]>;
  Object.defineProperty(parseResponse, "toStream", {
    enumerable: true,
    writable: false,
    value: responseToStream,
  });
}
