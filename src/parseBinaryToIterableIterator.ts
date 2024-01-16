import { CSVRecord, ParseBinaryOptions } from "./common/types.ts";
import { convertBinaryToString } from "./convertBinaryToString.ts";
import { parseStringToIterableIterator } from "./parseStringToIterableIterator.ts";

export function parseBinaryToIterableIterator<
  Header extends ReadonlyArray<string>,
>(
  binary: Uint8Array | ArrayBuffer,
  options: ParseBinaryOptions<Header> = {},
): IterableIterator<CSVRecord<Header>> {
  const csv = convertBinaryToString(binary, options);
  return parseStringToIterableIterator(csv, options);
}
