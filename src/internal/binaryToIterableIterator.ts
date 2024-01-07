import { CSVRecord, ParseBinaryOptions } from "../common/types.js";
import { convertToString } from "./convertToString.js";
import { stringToIterableIterator } from "./stringToIterableIterator.js";

export function binaryToIterableIterator<Header extends ReadonlyArray<string>>(
  binary: Uint8Array | ArrayBuffer,
  options: ParseBinaryOptions<Header> = {},
): IterableIterator<CSVRecord<Header>> {
  const csv = convertToString(binary, options);
  return stringToIterableIterator(csv, options);
}
