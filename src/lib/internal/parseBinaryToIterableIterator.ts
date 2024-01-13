import { CSVRecord, ParseBinaryOptions } from "../common/types.js";
import { convertBinaryToString } from "./convertBinaryToString.js";
import { parseStringToIterableIterator } from "./parseStringToIterableIterator.js";

export function parseBinaryToIterableIterator<
  Header extends ReadonlyArray<string>,
>(
  binary: Uint8Array | ArrayBuffer,
  options: ParseBinaryOptions<Header> = {},
): IterableIterator<CSVRecord<Header>> {
  const csv = convertBinaryToString(binary, options);
  return parseStringToIterableIterator(csv, options);
}
