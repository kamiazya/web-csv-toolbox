import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { InferCSVRecord, ParseBinaryOptions } from "@/core/types.ts";
import { parseUint8ArrayStreamToStream } from "@/parser/api/binary/parseUint8ArrayStreamToStream.ts";
import { getOptionsFromRequest } from "@/utils/request/getOptionsFromRequest.ts";

/**
 * Parse CSV Request to stream of records.
 *
 * @param request - Request to parse
 * @param options - Parsing options
 * @returns Stream of records
 *
 * @category Middle-level API
 */
export function parseRequestToStream<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
  Options extends ParseBinaryOptions<
    Header,
    Delimiter,
    Quotation
  > = ParseBinaryOptions<Header, Delimiter, Quotation>,
>(
  request: Request,
  options?: Options,
): ReadableStream<InferCSVRecord<Header, Options>> {
  const options_: ParseBinaryOptions<Header, Delimiter, Quotation> =
    getOptionsFromRequest(request, options);
  if (request.body === null) {
    throw new TypeError("Request body is null");
  }
  return parseUint8ArrayStreamToStream<Header, Delimiter, Quotation, Options>(
    request.body,
    options_ as Options,
  ) as ReadableStream<InferCSVRecord<Header, Options>>;
}
