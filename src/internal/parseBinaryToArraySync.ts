import { CSVRecord, ParseBinaryOptions } from "../common/types.js";
import { convertBinaryToString } from "./convertBinaryToString.js";
import { parseStringToArraySync } from "./parseStringToArraySync.js";

export function parseBinaryToArraySync<Header extends ReadonlyArray<string>>(
  binary: Uint8Array | ArrayBuffer,
  options: ParseBinaryOptions<Header> = {},
): CSVRecord<Header>[] {
  const csv = convertBinaryToString(binary, options);
  return parseStringToArraySync(csv, options);
}
