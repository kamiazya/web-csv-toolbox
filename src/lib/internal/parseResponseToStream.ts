import { CSVRecord, ParseBinaryOptions } from "../common/types.js";
import { getOptionsFromResponse } from "./getOptionsFromResponse.js";
import { parseUint8ArrayStreamToStream } from "./parseUint8ArrayStreamToStream.js";

export function parseResponseToStream<Header extends ReadonlyArray<string>>(
  response: Response,
  options?: ParseBinaryOptions<Header>,
): ReadableStream<CSVRecord<Header>> {
  const options_ = getOptionsFromResponse(response, options);
  if (response.body === null) {
    throw new Error("Response body is null");
  }
  return parseUint8ArrayStreamToStream(response.body, options_);
}
