import { convertBinaryToString } from "@/converters/binary/convertBinaryToString.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { InferCSVRecord, ParseBinaryOptions } from "@/core/types.ts";
import { parseStringToStream } from "@/parser/api/string/parseStringToStream.ts";
import { commonParseErrorHandling } from "@/utils/error/commonParseErrorHandling.ts";

export function parseBinaryToStream<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
  Options extends ParseBinaryOptions<
    Header,
    Delimiter,
    Quotation
  > = ParseBinaryOptions<Header, Delimiter, Quotation>,
>(
  binary: Uint8Array | ArrayBuffer,
  options?: Options,
): ReadableStream<InferCSVRecord<Header, Options>> {
  try {
    const csv = convertBinaryToString(binary, options ?? {});
    return parseStringToStream(csv, options as any) as ReadableStream<
      InferCSVRecord<Header, Options>
    >;
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
