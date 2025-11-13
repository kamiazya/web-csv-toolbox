import type { CSVRecord, ParseBinaryOptions } from "../../../core/types.ts";
import { getOptionsFromRequest } from "../../../utils/request/getOptionsFromRequest.ts";
import { parseUint8ArrayStreamToStream } from "../binary/parseUint8ArrayStreamToStream.ts";

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
  options?: ParseBinaryOptions<Header>,
): ReadableStream<CSVRecord<Header>> {
  const options_: ParseBinaryOptions<Header> = getOptionsFromRequest(
    request,
    options,
  );
  if (request.body === null) {
    throw new TypeError("Request body is null");
  }
  return parseUint8ArrayStreamToStream(request.body, options_);
}
