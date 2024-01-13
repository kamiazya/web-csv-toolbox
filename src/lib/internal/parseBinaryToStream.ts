import { CSVRecord, ParseBinaryOptions } from "../common/types.js";
import { convertBinaryToString } from "./convertBinaryToString.js";
import { parseStringToStream } from "./parseStringToStream.js";

export function parseBinaryToStream<Header extends ReadonlyArray<string>>(
  binary: Uint8Array | ArrayBuffer,
  options: ParseBinaryOptions<Header> = {},
): ReadableStream<CSVRecord<Header>> {
  const csv = convertBinaryToString(binary, options);
  return parseStringToStream(csv, options);
}
