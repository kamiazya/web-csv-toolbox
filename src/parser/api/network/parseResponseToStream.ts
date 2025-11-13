import type { DEFAULT_DELIMITER } from "../../../core/constants.ts";
import type { CSVRecord, ParseBinaryOptions } from "../../../core/types.ts";
import { commonParseErrorHandling } from "../../../utils/error/commonParseErrorHandling.ts";
import { getOptionsFromResponse } from "../../../utils/response/getOptionsFromResponse.ts";
import { parseUint8ArrayStreamToStream } from "../binary/parseUint8ArrayStreamToStream.ts";

export function parseResponseToStream<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = '"',
>(
  response: Response,
  options?: ParseBinaryOptions<Header, Delimiter, Quotation>,
): ReadableStream<CSVRecord<Header>> {
  try {
    const options_ = getOptionsFromResponse(response, options);
    if (response.body === null) {
      throw new TypeError("Response body is null");
    }
    return parseUint8ArrayStreamToStream(response.body, options_);
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
