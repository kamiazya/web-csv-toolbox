import type { CSVRecord, ParseBinaryOptions } from "./common/types.ts";
import { getOptionsFromResponse } from "./getOptionsFromResponse.ts";
import { parseUint8ArrayStreamToStream } from "./parseUint8ArrayStreamToStream.ts";

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
