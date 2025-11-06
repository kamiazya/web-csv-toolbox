import type { CSVRecord, ParseBinaryOptions } from "./common/types.ts";
import { getOptionsFromFile } from "./getOptionsFromFile.ts";
import { parseUint8ArrayStreamToStream } from "./parseUint8ArrayStreamToStream.ts";

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
export function parseFileToStream<Header extends ReadonlyArray<string>>(
  file: File,
  options?: ParseBinaryOptions<Header>,
): ReadableStream<CSVRecord<Header>> {
  const options_ = getOptionsFromFile(file, options);
  return parseUint8ArrayStreamToStream(file.stream(), options_);
}
