import * as internal from "../../../converters/iterators/convertThisAsyncIterableIteratorToArray.ts";
import type {
  DEFAULT_DELIMITER,
  DEFAULT_QUOTATION,
} from "../../../core/constants.ts";
import type {
  CSVRecord,
  ParseOptions,
  PickCSVHeader,
} from "../../../core/types.ts";
import { InternalEngineConfig } from "../../../engine/config/InternalEngineConfig.ts";
import { executeWithWorkerStrategy } from "../../../engine/strategies/WorkerStrategySelector.ts";
import { commonParseErrorHandling } from "../../../utils/error/commonParseErrorHandling.ts";
import { WorkerSession } from "../../../worker/helpers/WorkerSession.ts";
import { parseStringToArraySync } from "../string/parseStringToArraySync.ts";
import { parseStringToArraySyncWASM } from "../string/parseStringToArraySyncWASM.ts";
import { parseStringToIterableIterator } from "../string/parseStringToIterableIterator.ts";
import { parseStringToStream } from "../string/parseStringToStream.ts";

/**
 * Parse CSV string to records.
 *
 * @category Middle-level API
 * @param csv CSV string to parse
 * @param options Parsing options. See {@link ParseOptions}.
 * @returns Async iterable iterator of records.
 *
 * If you want array of records, use {@link parseString.toArray} function.
 *
 * @remarks
 * **Performance Characteristics:**
 * - **Memory usage**: O(1) - constant per record (streaming approach)
 * - **Suitable for**: Files of any size
 * - **Recommended for**: Large CSV strings (> 10MB) or memory-constrained environments
 *
 * **Execution Strategies:**
 * Control how parsing is executed using the `engine` option:
 * - **Main thread** (default): `engine: { worker: false }` - No overhead, good for small files
 * - **Worker thread**: `engine: { worker: true }` - Offloads parsing, good for large files
 * - **WebAssembly**: `engine: { wasm: true }` - Fast parsing, limited to UTF-8 and double-quotes
 * - **Combined**: `engine: { worker: true, wasm: true }` - Worker + WASM for maximum performance
 *
 * Use {@link EnginePresets} for convenient configurations:
 * ```ts
 * import { parseString, EnginePresets } from 'web-csv-toolbox';
 *
 * // Use fastest available execution method
 * for await (const record of parseString(csv, {
 *   engine: EnginePresets.fastest()
 * })) {
 *   console.log(record);
 * }
 * ```
 *
 * @example Parsing CSV files from strings
 *
 * ```ts
 * import { parseString } from 'web-csv-toolbox';
 *
 * const csv = `name,age
 * Alice,42
 * Bob,69`;
 *
 * for await (const record of parseString(csv)) {
 *   console.log(record);
 * }
 * // Prints:
 * // { name: 'Alice', age: '42' }
 * // { name: 'Bob', age: '69' }
 * ```
 *
 * @example Using worker execution for better performance
 * ```ts
 * import { parseString } from 'web-csv-toolbox';
 *
 * // Offload parsing to a worker thread
 * for await (const record of parseString(largeCSV, {
 *   engine: { worker: true }
 * })) {
 *   console.log(record);
 * }
 * ```
 */
export function parseString<const CSVSource extends string>(
  csv: CSVSource,
): AsyncIterableIterator<CSVRecord<PickCSVHeader<CSVSource>>>;
export function parseString<const Header extends ReadonlyArray<string>>(
  csv: string,
): AsyncIterableIterator<CSVRecord<Header>>;
export function parseString<const Header extends ReadonlyArray<string>>(
  csv: string,
  options: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>>;
export function parseString<
  const CSVSource extends string,
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Header extends ReadonlyArray<string> = PickCSVHeader<
    CSVSource,
    Delimiter,
    Quotation
  >,
>(
  csv: CSVSource,
  options?: ParseOptions<Header, Delimiter, Quotation>,
): AsyncIterableIterator<CSVRecord<Header>>;
export function parseString(
  csv: string,
  options?: ParseOptions,
): AsyncIterableIterator<CSVRecord<string[]>>;
export async function* parseString<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  try {
    // Parse engine configuration
    const engineConfig = new InternalEngineConfig(options?.engine);

    if (engineConfig.hasWorker()) {
      // Worker execution
      const session = engineConfig.workerPool
        ? await WorkerSession.create({
            workerPool: engineConfig.workerPool,
            workerURL: engineConfig.workerURL,
          })
        : null;

      try {
        yield* executeWithWorkerStrategy<CSVRecord<Header>>(
          csv,
          options,
          session,
          engineConfig,
        );
      } finally {
        session?.[Symbol.dispose]();
      }
    } else {
      // Main thread execution
      if (engineConfig.hasWasm()) {
        yield* parseStringToArraySyncWASM(csv, options);
      } else {
        yield* parseStringToIterableIterator(csv, options);
      }
    }
  } catch (error) {
    commonParseErrorHandling(error);
  }
}
export declare namespace parseString {
  /**
   * Parse CSV string to records.
   *
   * @returns Array of records
   *
   * @example
   * ```ts
   * import { parseString } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * const records = await parseString.toArray(csv);
   * console.log(records);
   * // Prints:
   * // [ { name: 'Alice', age: '42' }, { name: 'Bob', age: '69' } ]
   * ```
   */
  export function toArray<Header extends ReadonlyArray<string>>(
    csv: string,
    options?: ParseOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
  /**
   * Parse CSV string to records.
   *
   * @returns Array of records
   *
   * @example
   *
   * ```ts
   * import { parseString } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * const records = parseString.toArraySync(csv);
   * console.log(records);
   * // Prints:
   * // [ { name: 'Alice', age: '42' }, { name: 'Bob', age: '69' } ]
   * ```
   */
  export function toArraySync<Header extends ReadonlyArray<string>>(
    csv: string,
    options?: ParseOptions<Header>,
  ): CSVRecord<Header>[];
  /**
   * Parse CSV string to records.
   *
   * @returns Async iterable iterator of records
   *
   * @example
   * ```ts
   * import { parseString } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * for (const record of parseString.toIterableIterator(csv)) {
   *   console.log(record);
   * }
   * // Prints:
   * // { name: 'Alice', age: '42' }
   * // { name: 'Bob', age: '69' }
   * ```
   */
  export function toIterableIterator<Header extends ReadonlyArray<string>>(
    csv: string,
    options?: ParseOptions<Header>,
  ): IterableIterator<CSVRecord<Header>>;
  /**
   * Parse CSV string to records.
   *
   * @returns Readable stream of records
   *
   * @example
   * ```ts
   * import { parseString } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * await parseString.toStream(csv)
   *   .pipeTo(
   *      new WritableStream({
   *        write(record) {
   *          console.log(record);
   *        },
   *      }),
   *   );
   * // Prints:
   * // { name: 'Alice', age: '42' }
   * // { name: 'Bob', age: '69' }
   * ```
   */
  export function toStream<Header extends ReadonlyArray<string>>(
    csv: string,
    options?: ParseOptions<Header>,
  ): ReadableStream<CSVRecord<Header>>;
}
Object.defineProperties(parseString, {
  toArray: {
    enumerable: true,
    writable: false,
    value: internal.convertThisAsyncIterableIteratorToArray,
  },
  toArraySync: {
    enumerable: true,
    writable: false,
    value: parseStringToArraySync,
  },
  toIterableIterator: {
    enumerable: true,
    writable: false,
    value: parseStringToIterableIterator,
  },
  toStream: {
    enumerable: true,
    writable: false,
    value: parseStringToStream,
  },
});
