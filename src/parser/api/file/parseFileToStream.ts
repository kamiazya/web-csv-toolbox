import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type { InferCSVRecord, ParseBinaryOptions } from "@/core/types.ts";
import { parseBinaryStreamToStream } from "@/parser/api/binary/parseBinaryStreamToStream.ts";
import { getOptionsFromFile } from "@/utils/file/getOptionsFromFile.ts";

/**
 * Parse CSV from a {@link !File} to stream of records.
 *
 * @remarks
 * This function automatically sets the file name as the error source for better
 * error reporting (unless explicitly overridden via options).
 *
 * @category Middle-level API
 * @param file - File to parse
 * @param options - Parsing options
 * @returns Stream of records
 *
 * @example Parsing CSV from File
 *
 * ```ts
 * import { parseFileToStream } from 'web-csv-toolbox';
 *
 * const input = document.querySelector('input[type="file"]');
 * input.addEventListener('change', async (event) => {
 *   const file = event.target.files[0];
 *   await parseFileToStream(file)
 *     .pipeTo(
 *       new WritableStream({
 *         write(record) {
 *           console.log(record);
 *         },
 *      }),
 *   );
 * });
 * ```
 */
export function parseFileToStream<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
  Options extends ParseBinaryOptions<
    Header,
    Delimiter,
    Quotation
  > = ParseBinaryOptions<Header, Delimiter, Quotation>,
>(
  file: File,
  options?: Options,
): ReadableStream<InferCSVRecord<Header, Options>> {
  const options_ = getOptionsFromFile(file, options);
  return parseBinaryStreamToStream<Header, Delimiter, Quotation, Options>(
    file.stream(),
    options_ as Options,
  ) as ReadableStream<InferCSVRecord<Header, Options>>;
}
