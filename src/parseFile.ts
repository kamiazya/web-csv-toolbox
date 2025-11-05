import type { CSVRecord, ParseBinaryOptions } from "./common/types.ts";
import { parseBlob } from "./parseBlob.ts";

/**
 * Parse CSV from a {@link !File} to records.
 *
 * @remarks
 * This is an alias for {@link parseBlob} since File extends Blob.
 *
 * This function can parse CSV data from File objects (from file inputs or drag-and-drop).
 * If the File has a type with charset parameter, it will be used for decoding.
 *
 * @category Middle-level API
 * @param file - The file to parse
 * @param options - Parsing options
 * @returns Async iterable iterator of records.
 *
 * If you want array of records, use {@link parseFile.toArray} function.
 *
 * @example Parsing CSV from File (input element)
 *
 * ```ts
 * import { parseFile } from 'web-csv-toolbox';
 *
 * const input = document.querySelector('input[type="file"]');
 * input.addEventListener('change', async (event) => {
 *   const file = event.target.files[0];
 *   for await (const record of parseFile(file)) {
 *     console.log(record);
 *   }
 * });
 * ```
 *
 * @example Parsing CSV from File (drag-and-drop)
 *
 * ```ts
 * import { parseFile } from 'web-csv-toolbox';
 *
 * dropZone.addEventListener('drop', async (event) => {
 *   event.preventDefault();
 *   const file = event.dataTransfer.files[0];
 *   for await (const record of parseFile(file)) {
 *     console.log(record);
 *   }
 * });
 * ```
 */
export function parseFile<Header extends ReadonlyArray<string>>(
  file: File,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  return parseBlob(file, options);
}

export declare namespace parseFile {
  /**
   * Parse CSV from a {@link !File} to array of records.
   *
   * @returns Array of records
   *
   * @example Parsing CSV from File
   *
   * ```ts
   * import { parseFile } from 'web-csv-toolbox';
   *
   * const input = document.querySelector('input[type="file"]');
   * input.addEventListener('change', async (event) => {
   *   const file = event.target.files[0];
   *   const records = await parseFile.toArray(file);
   *   console.log(records);
   * });
   * ```
   */
  export function toArray<Header extends ReadonlyArray<string>>(
    file: File,
    options?: ParseBinaryOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
  /**
   * Parse CSV from a {@link !File} to stream of records.
   *
   * @param file - File to parse
   * @returns Stream of records
   *
   * @example Parsing CSV from File
   *
   * ```ts
   * import { parseFile } from 'web-csv-toolbox';
   *
   * const input = document.querySelector('input[type="file"]');
   * input.addEventListener('change', async (event) => {
   *   const file = event.target.files[0];
   *   await parseFile.toStream(file)
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
  export function toStream<Header extends ReadonlyArray<string>>(
    file: File,
    options?: ParseBinaryOptions<Header>,
  ): ReadableStream<CSVRecord<Header>>;
}

Object.defineProperties(parseFile, {
  toArray: {
    enumerable: true,
    writable: false,
    value: parseBlob.toArray,
  },
  toStream: {
    enumerable: true,
    writable: false,
    value: parseBlob.toStream,
  },
});
