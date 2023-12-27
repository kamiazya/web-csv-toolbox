import { CSVRecord, ParseOptions } from "./common/index.js";
import { parseMime } from "./internal/parseMime.js";
import * as internal from "./internal/toArray.js";
import { parseBinaryStream } from "./parseBinaryStream.js";

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
  const { headers } = response;
  const contentType = headers.get("content-type") ?? "text/csv";
  const mime = parseMime(contentType);
  if (mime.type !== "text/csv") {
    throw new Error(`Invalid mime type: ${contentType}`);
  }
  const decomposition =
    (headers.get("content-encoding") as CompressionFormat) ?? undefined;
  const charset = mime.parameters.charset ?? "utf-8";
  // TODO: Support header=present and header=absent
  // const header = mime.parameters.header ?? "present";
  if (response.body === null) {
    throw new Error("Response body is null");
  }
  return parseBinaryStream(response.body, {
    decomposition,
    charset,
    ...options,
  });
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
  parseResponse.toArray = internal.toArray;
}
