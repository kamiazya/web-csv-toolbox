import type { CSVRecord, ParseBinaryOptions } from "./common/types.ts";
import { getOptionsFromFile } from "./getOptionsFromFile.ts";
import { parseBlob } from "./parseBlob.ts";

/**
 * Parse CSV from a {@link !File} to array of records.
 *
 * @remarks
 * This function automatically sets the file name as the error source for better
 * error reporting (unless explicitly overridden via options).
 *
 * @category Middle-level API
 * @param file - The file to parse
 * @param options - Parsing options
 * @returns Promise of array of records
 *
 * @example Parsing CSV from File
 *
 * ```ts
 * import { parseFileToArray } from 'web-csv-toolbox';
 *
 * const input = document.querySelector('input[type="file"]');
 * input.addEventListener('change', async (event) => {
 *   const file = event.target.files[0];
 *   const records = await parseFileToArray(file);
 *   console.log(records);
 * });
 * ```
 */
export async function parseFileToArray<Header extends ReadonlyArray<string>>(
  file: File,
  options?: ParseBinaryOptions<Header>,
): Promise<CSVRecord<Header>[]> {
  const rows: CSVRecord<Header>[] = [];
  const options_ = getOptionsFromFile(file, options);
  for await (const row of parseBlob(file, options_)) {
    rows.push(row);
  }
  return rows;
}
