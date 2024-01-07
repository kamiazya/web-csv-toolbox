import { CSVRecord, ParseBinaryOptions } from "../common/types.js";
import { convertToString } from "./convertToString.js";
import { stringToStream } from "./stringToStream.js";

export function binaryToStream<Header extends ReadonlyArray<string>>(
  binary: Uint8Array | ArrayBuffer,
  options: ParseBinaryOptions<Header> = {},
): ReadableStream<CSVRecord<Header>> {
  const csv = convertToString(binary, options);
  return stringToStream(csv, options);
}
