import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { InferCSVRecord, ParseBinaryOptions } from "@/core/types.ts";
import { parseBinaryStreamToStream } from "@/parser/api/binary/parseBinaryStreamToStream.ts";
import { commonParseErrorHandling } from "@/utils/error/commonParseErrorHandling.ts";
import { getOptionsFromResponse } from "@/utils/response/getOptionsFromResponse.ts";

export function parseResponseToStream<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
  Options extends ParseBinaryOptions<
    Header,
    Delimiter,
    Quotation
  > = ParseBinaryOptions<Header, Delimiter, Quotation>,
>(
  response: Response,
  options?: Options,
): ReadableStream<InferCSVRecord<Header, Options>> {
  try {
    const options_ = getOptionsFromResponse(response, options);
    if (response.body === null) {
      throw new TypeError("Response body is null");
    }
    return parseBinaryStreamToStream<Header, Delimiter, Quotation, Options>(
      response.body,
      options_ as Options,
    ) as ReadableStream<InferCSVRecord<Header, Options>>;
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
