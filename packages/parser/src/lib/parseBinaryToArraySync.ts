import type { CSVRecord, ParseBinaryOptions } from "@web-csv-toolbox/common";
import { convertBinaryToString } from "@web-csv-toolbox/shared";

import { parseStringToArraySync } from "./parseStringToArraySync";
import { commonParseErrorHandling } from "./utils/commonParseErrorHandling";

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
