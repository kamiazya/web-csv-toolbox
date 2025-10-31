import type { CSVRecord, ParseOptions } from "./common/types.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "./constants.ts";
import type { PickCSVHeader } from "./utils/types.ts";
import { InternalEngineConfig } from "./execution/InternalEngineConfig.ts";
import { WorkerSession } from "./execution/worker/helpers/WorkerSession.ts";
import { executeWithWorkerStrategy } from "./execution/worker/strategies/WorkerStrategySelector.ts";
import { parseStringStreamToStream } from "./parseStringStreamToStream.ts";
import { convertStreamToAsyncIterableIterator } from "./utils/convertStreamToAsyncIterableIterator.ts";
import * as internal from "./utils/convertThisAsyncIterableIteratorToArray.ts";

/**
 * Parse CSV string stream to records.
 *
 * @category Middle-level API
 * @param stream CSV string stream to parse
 * @param options Parsing options.
 * @returns Async iterable iterator of records.
 *
 * If you want array of records, use {@link parseStringStream.toArray} function.
 *
 * @remarks
 * **Stream Execution Strategies:**
 *
 * For streams, the engine configuration supports two worker strategies:
 * - **stream-transfer** (recommended): Zero-copy stream transfer to worker
 *   - Supported on Chrome, Firefox, Edge
 *   - Automatically falls back to message-streaming on Safari
 * - **message-streaming**: Records sent via postMessage
 *   - Works on all browsers including Safari
 *   - Slightly higher overhead but more compatible
 *
 * By default, streams use main thread execution. To use workers with streams:
 * ```ts
 * import { parseStringStream, EnginePresets } from 'web-csv-toolbox';
 *
 * // Use worker with automatic stream-transfer (falls back if not supported)
 * for await (const record of parseStringStream(stream, {
 *   engine: EnginePresets.workerStreamTransfer()
 * })) {
 *   console.log(record);
 * }
 * ```
 *
 * Note: WASM execution is not supported for streams. If you specify
 * `engine: { wasm: true }` with a stream, it will fall back to main thread.
 *
 * @example Parsing CSV files from strings
 *
 * ```ts
 * import { parseStringStream } from 'web-csv-toolbox';
 *
 * const csv = `name,age
 * Alice,42
 * Bob,69`;
 *
 * const stream = new ReadableStream({
 *  start(controller) {
 *     controller.enqueue(csv);
 *     controller.close();
 *   },
 * });
 *
 * for await (const record of parseStringStream(stream)) {
 *   console.log(record);
 * }
 * // Prints:
 * // { name: 'Alice', age: '42' }
 * // { name: 'Bob', age: '69' }
 * ```
 *
 * @example Using worker with stream transfer for large files
 * ```ts
 * import { parseStringStream } from 'web-csv-toolbox';
 *
 * const response = await fetch('large-file.csv');
 * const stream = response.body
 *   .pipeThrough(new TextDecoderStream());
 *
 * // Use worker with stream-transfer strategy
 * for await (const record of parseStringStream(stream, {
 *   engine: { worker: true, workerStrategy: 'stream-transfer' }
 * })) {
 *   console.log(record);
 * }
 * ```
 */
export function parseStringStream<
  const CSVSource extends ReadableStream<string>,
  const Delimiter extends string = DEFAULT_DELIMITER,
  const Quotation extends string = DEFAULT_QUOTATION,
  const Header extends ReadonlyArray<string> = PickCSVHeader<
    CSVSource,
    Delimiter,
    Quotation
  >,
>(
  csv: CSVSource,
  options: ParseOptions<Header, Delimiter, Quotation>,
): AsyncIterableIterator<CSVRecord<Header>>;
export function parseStringStream<
  const CSVSource extends ReadableStream<string>,
  const Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
>(
  csv: CSVSource,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>>;
export function parseStringStream<const Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>>;
export async function* parseStringStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>,
): AsyncIterableIterator<CSVRecord<Header>> {
  // Parse engine configuration
  const engineConfig = new InternalEngineConfig(options?.engine);

  // Note: Worker execution with ReadableStream requires TransferableStream support
  // which is not available in Safari. For now, always use main thread execution.
  // TODO: Implement stream-transfer strategy for browsers that support it
  if (engineConfig.hasWorker() && engineConfig.hasStreamTransfer()) {
    // Worker execution with stream-transfer strategy
    const session = engineConfig.workerPool
      ? await WorkerSession.create({
          workerPool: engineConfig.workerPool,
          workerURL: engineConfig.workerURL,
        })
      : null;

    try {
      yield* executeWithWorkerStrategy<CSVRecord<Header>>(
        stream,
        options,
        session,
        engineConfig,
      );
    } finally {
      session?.[Symbol.dispose]();
    }
  } else {
    // Main thread execution (default for streams)
    const recordStream = parseStringStreamToStream(stream, options);
    yield* convertStreamToAsyncIterableIterator(recordStream);
  }
}

export declare namespace parseStringStream {
  /**
   * Parse CSV string stream to records.
   *
   * @returns Array of records
   *
   * @example
   *
   * ```ts
   * import { parseStringStream } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * const stream = new ReadableStream({
   *   start(controller) {
   *     controller.enqueue(csv);
   *     controller.close();
   *   },
   * });
   *
   * const records = await parseStringStream.toArray(stream);
   * console.log(records);
   * // Prints:
   * // [ { name: 'Alice', age: '42' }, { name: 'Bob', age: '69' } ]
   * ```
   */
  export function toArray<Header extends ReadonlyArray<string>>(
    stream: ReadableStream<string>,
    options?: ParseOptions<Header>,
  ): Promise<CSVRecord<Header>[]>;
  /**
   * Parse CSV string stream to records.
   *
   * @returns Array of records
   *
   * @example
   *
   * ```ts
   * import { parseStringStream } from 'web-csv-toolbox';
   *
   * const csv = `name,age
   * Alice,42
   * Bob,69`;
   *
   * const stream = new ReadableStream({
   *   start(controller) {
   *     controller.enqueue(csv);
   *     controller.close();
   *   },
   * });
   *
   * await parseStringStream.toStream(stream)
   *   .pipeTo(
   *     new WritableStream({
   *       write(record) {
   *       console.log(record);
   *     },
   *   }),
   * );
   * ```
   */
  export function toStream<Header extends ReadonlyArray<string>>(
    stream: ReadableStream<string>,
    options?: ParseOptions<Header>,
  ): ReadableStream<CSVRecord<Header>>;
}

Object.defineProperties(parseStringStream, {
  toArray: {
    enumerable: true,
    writable: false,
    value: internal.convertThisAsyncIterableIteratorToArray,
  },
  toStream: {
    enumerable: true,
    writable: false,
    value: parseStringStreamToStream,
  },
});
