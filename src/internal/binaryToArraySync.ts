import { CSVRecord, ParseBinaryOptions } from "../common/types.js";
import { convertToString } from "./convertToString.js";
import { stringToArraySync } from "./stringToArraySync.js";

export function binaryToArraySync<Header extends ReadonlyArray<string>>(
  binary: Uint8Array | ArrayBuffer,
  options: ParseBinaryOptions<Header> = {},
): CSVRecord<Header>[] {
  const csv = convertToString(binary, options);
  return stringToArraySync(csv, options);
}
