import * as internal from "@/converters/iterators/convertThisAsyncIterableIteratorToArray.ts";
import type { InferCSVRecord, ParseBinaryOptions } from "@/core/types.ts";
import { parseBinaryStream } from "@/parser/api/binary/parseBinaryStream.ts";
import { parseRequestToStream } from "@/parser/api/network/parseRequestToStream.ts";
import { commonParseErrorHandling } from "@/utils/error/commonParseErrorHandling.ts";
import { getOptionsFromRequest } from "@/utils/request/getOptionsFromRequest.ts";

/**
 * Parse HTTP Request what contains CSV to records,
 * ideal for server-side use cases.
 *
 * @remarks
 * This function automatically treats request headers.
 *
 * - If `Content-Type` header is not set, it assumes `text/csv`.
 * - If `Content-Type` header is not `text/csv`, it throws an error.
 * - If `Content-Type` header has charset parameter, it uses it for decoding.
 * - If `Content-Encoding` header is set, it decompresses the request.
 * - Should there be any conflicting information between the header and the options, the option's value will take precedence.
 *
 * This function is particularly useful for server-side environments like Cloudflare Workers,
 * Service Workers, or other edge computing platforms that use the Request API.
 *
 * @category Middle-level API
 * @param request - The request object to parse
 * @param options - Parsing options
 * @returns Async iterable iterator of records.
 *
 * If you want array of records, use {@link parseRequest.toArray} function.
 *
 * @example Parsing CSV from Request (Cloudflare Workers)
 *
 * ```ts
 * import { parseRequest } from 'web-csv-toolbox';
 *
 * export default {
 *   async fetch(request: Request) {
 *     if (request.method === 'POST' && request.headers.get('content-type')?.includes('text/csv')) {
 *       for await (const record of parseRequest(request)) {
 *         console.log(record);
 *       }
 *       return new Response('CSV processed', { status: 200 });
 *     }
 *     return new Response('Not Found', { status: 404 });
 *   }
 * };
 * ```
 *
 * @example Parsing CSV from Request (Service Worker)
 *
 * ```ts
 * import { parseRequest } from 'web-csv-toolbox';
 *
 * self.addEventListener('fetch', (event) => {
 *   const request = event.request;
 *   if (request.method === 'POST' && request.url.endsWith('/upload-csv')) {
 *     event.respondWith(
 *       (async () => {
 *         const records = [];
 *         for await (const record of parseRequest(request)) {
 *           records.push(record);
 *         }
 *         return new Response(JSON.stringify(records), {
 *           headers: { 'Content-Type': 'application/json' }
 *         });
 *       })()
 *     );
 *   }
 * });
 * ```
 */
export function parseRequest<
  Header extends ReadonlyArray<string>,
  Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
>(
  request: Request,
  options?: Options,
): AsyncIterableIterator<InferCSVRecord<Header, Options>> {
  // Validate synchronously before creating async generator
  const options_: ParseBinaryOptions<Header> = getOptionsFromRequest(
    request,
    options,
  );
  if (request.body === null) {
    throw new TypeError("Request body is null");
  }

  // Return wrapper async generator for error handling
  return (async function* () {
    try {
      yield* parseBinaryStream(
        request.body!,
        options_,
      ) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
    } catch (error) {
      commonParseErrorHandling(error);
    }
  })();
}

export declare namespace parseRequest {
  /**
   * Parse CSV Request to array of records.
   *
   * @returns Array of records
   *
   * @example Parsing CSV Request
   *
   * ```ts
   * import { parseRequest } from 'web-csv-toolbox';
   *
   * const request = new Request('https://example.com', {
   *   method: 'POST',
   *   headers: { 'Content-Type': 'text/csv' },
   *   body: 'name,age\nAlice,42\nBob,69'
   * });
   *
   * const records = await parseRequest.toArray(request);
   * console.log(records);
   * ```
   */
  export function toArray<
    Header extends ReadonlyArray<string>,
    Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
  >(
    request: Request,
    options?: Options,
  ): Promise<InferCSVRecord<Header, Options>[]>;
  /**
   * Parse CSV Request to stream of records.
   *
   * @param request - Request to parse
   * @returns Stream of records
   *
   * @example Parsing CSV Request
   *
   * ```ts
   * import { parseRequest } from 'web-csv-toolbox';
   *
   * const request = new Request('https://example.com', {
   *   method: 'POST',
   *   headers: { 'Content-Type': 'text/csv' },
   *   body: 'name,age\nAlice,42\nBob,69'
   * });
   *
   * await parseRequest.toStream(request)
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
  export function toStream<
    Header extends ReadonlyArray<string>,
    Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
  >(
    request: Request,
    options?: Options,
  ): ReadableStream<InferCSVRecord<Header, Options>>;
}

Object.defineProperties(parseRequest, {
  toArray: {
    enumerable: true,
    writable: false,
    value: internal.convertThisAsyncIterableIteratorToArray,
  },
  toStream: {
    enumerable: true,
    writable: false,
    value: parseRequestToStream,
  },
});
