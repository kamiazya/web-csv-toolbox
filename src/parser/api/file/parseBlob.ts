import * as internal from "../../../converters/iterators/convertThisAsyncIterableIteratorToArray.ts";
import { DEFAULT_ARRAY_BUFFER_THRESHOLD } from "../../../core/constants.ts";
import type { CSVRecord, ParseBinaryOptions } from "../../../core/types.ts";
import { getOptionsFromBlob } from "../../../utils/blob/getOptionsFromBlob.ts";
import { commonParseErrorHandling } from "../../../utils/error/commonParseErrorHandling.ts";
import { parseBinary } from "../binary/parseBinary.ts";
import { parseUint8ArrayStream } from "../binary/parseUint8ArrayStream.ts";
import { parseBlobToStream } from "../file/parseBlobToStream.ts";

/**
 * Parse CSV from a {@link !Blob} or {@link !File} to records.
 *
 * @remarks
 * This function can parse CSV data from Blob or File objects.
 * If the Blob has a type with charset parameter, it will be used for decoding.
 *
 * File objects (from file inputs or drag-and-drop) extend Blob and are automatically supported.
 *
 * @category Middle-level API
 * @param blob - The blob or file to parse
 * @param options - Parsing options
 * @returns Async iterable iterator of records.
 *
 * If you want array of records, use {@link parseBlob.toArray} function.
 *
 * @example Parsing CSV from Blob
 *
 * ```ts
 * import { parseBlob } from 'web-csv-toolbox';
 *
 * const blob = new Blob(['name,age\nAlice,42\nBob,69'], { type: 'text/csv' });
 *
 * for await (const record of parseBlob(blob)) {
 *   console.log(record);
 * }
 * ```
 *
 * @example Parsing CSV from File (input element)
 *
 * ```ts
 * import { parseBlob } from 'web-csv-toolbox';
 *
 * const input = document.querySelector('input[type="file"]');
 * input.addEventListener('change', async (event) => {
 *   const file = event.target.files[0];
 *   for await (const record of parseBlob(file)) {
 *     console.log(record);
 *   }
 * });
 * ```
 *
 * @example Parsing CSV from Blob with charset
 *
 * ```ts
 * import { parseBlob } from 'web-csv-toolbox';
 *
 * const blob = new Blob([csvData], { type: 'text/csv;charset=shift-jis' });
 *
 * for await (const record of parseBlob(blob)) {
 *   console.log(record);
 * }
 * ```
 */
export function parseBlob<Header extends ReadonlyArray<string>>(
  blob: Blob,
  options?: ParseBinaryOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Extract options from blob
  const options_ = getOptionsFromBlob(blob, options);

  // Get threshold from engine config or use default
  const threshold =
    options_?.engine?.arrayBufferThreshold ?? DEFAULT_ARRAY_BUFFER_THRESHOLD;

  // Return wrapper async generator for error handling
  return (async function* () {
    try {
      // Choose strategy based on blob size and threshold
      if (blob.size < threshold) {
        // Small file: use arrayBuffer for better performance
        const buffer = await blob.arrayBuffer();
        yield* parseBinary(new Uint8Array(buffer), options_);
      } else {
        // Large file: use streaming for memory efficiency
        yield* parseUint8ArrayStream(blob.stream(), options_);
      }
    } catch (error) {
      commonParseErrorHandling(error);
    }
  })();
}

export declare namespace parseBlob {
  /**
   * Parse CSV from a {@link !Blob} or {@link !File} to array of records.
   *
   * @returns Array of records
   *
   * @example Parsing CSV from Blob
   *
   * ```ts
   * import { parseBlob } from 'web-csv-toolbox';
   *
   * const blob = new Blob(['name,age\nAlice,42\nBob,69'], { type: 'text/csv' });
   *
   * const records = await parseBlob.toArray(blob);
   * console.log(records);
   * ```
   */
  export function toArray<Header extends ReadonlyArray<string>>(
    blob: Blob,
    options?: ParseBinaryOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
  /**
   * Parse CSV from a {@link !Blob} or {@link !File} to stream of records.
   *
   * @param blob - Blob or File to parse
   * @returns Stream of records
   *
   * @example Parsing CSV from Blob
   *
   * ```ts
   * import { parseBlob } from 'web-csv-toolbox';
   *
   * const blob = new Blob(['name,age\nAlice,42\nBob,69'], { type: 'text/csv' });
   *
   * await parseBlob.toStream(blob)
   *   .pipeTo(
   *     new WritableStream({
   *       write(record) {
   *         console.log(record);
   *       },
   *    }),
   * );
   * // Prints:
   * // { name: 'Alice', age: '42' }
   * // { name: 'Bob', age: '69' }
   * ```
   */
  export function toStream<Header extends ReadonlyArray<string>>(
    blob: Blob,
    options?: ParseBinaryOptions<Header>,
  ): ReadableStream<CSVRecord<Header>>;
}

Object.defineProperties(parseBlob, {
  toArray: {
    enumerable: true,
    writable: false,
    value: internal.convertThisAsyncIterableIteratorToArray,
  },
  toStream: {
    enumerable: true,
    writable: false,
    value: parseBlobToStream,
  },
});
