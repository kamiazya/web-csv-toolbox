import type { CSVRecord, ParseBinaryOptions } from "./common/types.ts";
import { commonParseErrorHandling } from "./commonParseErrorHandling.ts";
import { parseStringToStream } from "./parseStringToStream.ts";
import { convertBinaryToString } from "./utils/convertBinaryToString.ts";

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
