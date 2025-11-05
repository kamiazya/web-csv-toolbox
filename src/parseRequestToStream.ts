import type { CSVRecord, ParseOptions } from "./common/types.ts";
import { getOptionsFromRequest } from "./getOptionsFromRequest.ts";
import { parseUint8ArrayStreamToStream } from "./parseUint8ArrayStreamToStream.ts";

/**
 * Parse CSV Request to stream of records.
 *
 * @param request - Request to parse
 * @param options - Parsing options
 * @returns Stream of records
 *
 * @category Middle-level API
 */
export function parseRequestToStream<Header extends ReadonlyArray<string>>(
  request: Request,
  options?: ParseOptions<Header>,
): ReadableStream<CSVRecord<Header>> {
  const options_ = getOptionsFromRequest(request, options);
  if (request.body === null) {
    throw new TypeError("Request body is null");
  }
  return parseUint8ArrayStreamToStream(request.body, options_);
}
