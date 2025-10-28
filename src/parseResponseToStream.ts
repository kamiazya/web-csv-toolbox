import type { CSVRecord, ParseBinaryOptions } from "./common/types.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "./constants.ts";
import { commonParseErrorHandling } from "./commonParseErrorHandling.ts";
import { getOptionsFromResponse } from "./getOptionsFromResponse.ts";
import { parseUint8ArrayStreamToStream } from "./parseUint8ArrayStreamToStream.ts";

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
