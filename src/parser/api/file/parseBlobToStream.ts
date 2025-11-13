import type { CSVRecord, ParseBinaryOptions } from "../../../core/types.ts";
import { getOptionsFromBlob } from "../../../utils/blob/getOptionsFromBlob.ts";
import { parseUint8ArrayStreamToStream } from "../binary/parseUint8ArrayStreamToStream.ts";

/**
 * Parse CSV from a {@link !Blob} or {@link !File} to stream of records.
 *
 * @param blob - Blob or File to parse
 * @param options - Parsing options
 * @returns Stream of records
 *
 * @category Middle-level API
 */
export function parseBlobToStream<Header extends ReadonlyArray<string>>(
  blob: Blob,
  options?: ParseBinaryOptions<Header>,
): ReadableStream<CSVRecord<Header>> {
  const options_ = getOptionsFromBlob(blob, options);
  return parseUint8ArrayStreamToStream(blob.stream(), options_);
}
