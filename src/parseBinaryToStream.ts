import type { CSVRecord, ParseBinaryOptions } from "./common/types.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "./constants.ts";
import { commonParseErrorHandling } from "./commonParseErrorHandling.ts";
import { parseStringToStream } from "./parseStringToStream.ts";
import { convertBinaryToString } from "./utils/convertBinaryToString.ts";

export function parseBinaryToStream<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = '"',
>(
  binary: Uint8Array | ArrayBuffer,
  options: ParseBinaryOptions<Header, Delimiter, Quotation> = {} as ParseBinaryOptions<Header, Delimiter, Quotation>,
): ReadableStream<CSVRecord<Header>> {
  try {
    const csv = convertBinaryToString(binary, options);
    return parseStringToStream(csv, options);
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
