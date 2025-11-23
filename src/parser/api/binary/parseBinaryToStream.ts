import { convertBinaryToString } from "@/converters/binary/convertBinaryToString.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { InferCSVRecord, ParseBinaryOptions } from "@/core/types.ts";
import { parseStringToStream } from "@/parser/api/string/parseStringToStream.ts";
import { commonParseErrorHandling } from "@/utils/error/commonParseErrorHandling.ts";

/**
 * Parses binary CSV data into a ReadableStream of records.
 *
 * @param binary - The binary CSV data to parse (BufferSource: Uint8Array, ArrayBuffer, or other TypedArray).
 * @param options - Parsing options.
 * @returns A ReadableStream of CSV records.
 * @throws {RangeError} If the binary size exceeds maxBinarySize limit.
 * @throws {TypeError} If the encoded data is not valid.
 * @throws {ParseError} When an error occurs while parsing the CSV data.
 */
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
  binary: BufferSource,
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
