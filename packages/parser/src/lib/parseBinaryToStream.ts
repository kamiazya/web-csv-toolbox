import type { CSVRecord, ParseBinaryOptions } from "@web-csv-toolbox/common";
import { convertBinaryToString } from "@web-csv-toolbox/shared";

import { parseStringToStream } from "./parseStringToStream";
import { commonParseErrorHandling } from "./utils/commonParseErrorHandling";

export function parseBinaryToStream<Header extends ReadonlyArray<string>>(
  binary: Uint8Array | ArrayBuffer,
  options: ParseBinaryOptions<Header> = {},
): ReadableStream<CSVRecord<Header>> {
  try {
    const csv = convertBinaryToString(binary, options);
    return parseStringToStream(csv, options);
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
