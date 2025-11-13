import { convertBinaryToString } from "../../../converters/binary/convertBinaryToString.ts";
import type {
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
} from "../../../core/constants.ts";
import type { CSVRecord, ParseBinaryOptions } from "../../../core/types.ts";
import { commonParseErrorHandling } from "../../../utils/error/commonParseErrorHandling.ts";
import { parseStringToStream } from "../string/parseStringToStream.ts";

export function parseBinaryToStream<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  binary: Uint8Array | ArrayBuffer,
  options: ParseBinaryOptions<
    Header,
    Delimiter,
    Quotation
  > = {} as ParseBinaryOptions<Header, Delimiter, Quotation>,
): ReadableStream<CSVRecord<Header>> {
  try {
    const csv = convertBinaryToString(binary, options);
    return parseStringToStream(csv, options);
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
