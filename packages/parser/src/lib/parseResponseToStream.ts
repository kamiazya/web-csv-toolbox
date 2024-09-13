import type { CSVRecord, ParseBinaryOptions } from "@web-csv-toolbox/common";

import { parseUint8ArrayStreamToStream } from "./parseUint8ArrayStreamToStream";
import { commonParseErrorHandling } from "./utils/commonParseErrorHandling";
import { getOptionsFromResponse } from "./utils/getOptionsFromResponse";

export function parseResponseToStream<Header extends ReadonlyArray<string>>(
  response: Response,
  options?: ParseBinaryOptions<Header>,
): ReadableStream<CSVRecord<Header>> {
  try {
    const options_ = getOptionsFromResponse(response, options);
    if (response.body === null) {
      throw new RangeError("Response body is null");
    }
    return parseUint8ArrayStreamToStream(response.body, options_);
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
