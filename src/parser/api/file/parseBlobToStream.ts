import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { InferCSVRecord, ParseBinaryOptions } from "@/core/types.ts";
import { parseUint8ArrayStreamToStream } from "@/parser/api/binary/parseUint8ArrayStreamToStream.ts";
import { getOptionsFromBlob } from "@/utils/blob/getOptionsFromBlob.ts";

/**
 * Parse CSV from a {@link !Blob} or {@link !File} to stream of records.
 *
 * @param blob - Blob or File to parse
 * @param options - Parsing options
 * @returns Stream of records
 *
 * @category Middle-level API
 */
export function parseBlobToStream<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
  Options extends ParseBinaryOptions<
    Header,
    Delimiter,
    Quotation
  > = ParseBinaryOptions<Header, Delimiter, Quotation>,
>(
  blob: Blob,
  options?: Options,
): ReadableStream<InferCSVRecord<Header, Options>> {
  const options_ = getOptionsFromBlob(blob, options);
  return parseUint8ArrayStreamToStream<Header, Delimiter, Quotation, Options>(
    blob.stream(),
    options_ as Options,
  ) as ReadableStream<InferCSVRecord<Header, Options>>;
}
