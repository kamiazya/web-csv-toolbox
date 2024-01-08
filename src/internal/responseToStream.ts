import { CSVRecord, ParseBinaryOptions } from "../common/types.js";
import { getOptionsFromResponse } from "./getOptionsFromResponse.js";
import { uint8ArrayStreamToStream } from "./uint8ArrayStreamToStream.js";

export function responseToStream<Header extends ReadonlyArray<string>>(
  response: Response,
  options?: ParseBinaryOptions<Header>,
): ReadableStream<CSVRecord<Header>> {
  const options_ = getOptionsFromResponse(response, options);
  if (response.body === null) {
    throw new Error("Response body is null");
  }
  return uint8ArrayStreamToStream(response.body, options_);
}
