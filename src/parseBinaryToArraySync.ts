import type { CSVRecord, ParseBinaryOptions } from "./common/types.ts";
import { commonParseErrorHandling } from "./commonParseErrorHandling.ts";
import { convertBinaryToString } from "./convertBinaryToString.ts";
import { parseStringToArraySync } from "./parseStringToArraySync.ts";

export function parseBinaryToArraySync<Header extends ReadonlyArray<string>>(
  binary: Uint8Array | ArrayBuffer,
  options: ParseBinaryOptions<Header> = {},
): CSVRecord<Header>[] {
  try {
    const csv = convertBinaryToString(binary, options);
    return parseStringToArraySync(csv, options);
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
