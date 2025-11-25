import { convertStreamToAsyncIterableIterator } from "@/converters/iterators/convertStreamToAsyncIterableIterator.ts";
import * as internal from "@/converters/iterators/convertThisAsyncIterableIteratorToArray.ts";
import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  CSVRecord,
  InferCSVRecord,
  ParseOptions,
  PickCSVHeader,
} from "@/core/types.ts";
import { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { executeWithWorkerStrategy } from "@/engine/strategies/WorkerStrategySelector.ts";
import { parseStringStreamToStream } from "@/parser/api/string/parseStringStreamToStream.ts";
import { WASMBinaryCSVStreamTransformer } from "@/parser/stream/WASMBinaryCSVStreamTransformer.ts";
import { loadWASM } from "@/wasm/WasmInstance.main.web.ts";
import { WorkerSession } from "@/worker/helpers/WorkerSession.ts";

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
 *   engine: EnginePresets.memoryEfficient()
 * })) {
 *   console.log(record);
 * }
 * ```
 *
 * **WASM Execution:**
 * - `engine: { wasm: true }` enables WASM-based parsing for better performance
 * - `engine: { wasm: true, worker: true }` combines WASM with worker offloading
 * - WASM only supports UTF-8 encoding and object output format
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
  const Options extends ParseOptions<
    Header,
    Delimiter,
    Quotation
  > = ParseOptions<Header, Delimiter, Quotation>,
>(
  csv: CSVSource,
  options: Options,
): AsyncIterableIterator<InferCSVRecord<Header, Options>>;
export function parseStringStream<
  const CSVSource extends ReadableStream<string>,
  const Header extends ReadonlyArray<string> = PickCSVHeader<CSVSource>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  csv: CSVSource,
  options?: Options,
): AsyncIterableIterator<InferCSVRecord<Header, Options>>;
export function parseStringStream<
  const Header extends ReadonlyArray<string>,
  const Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  stream: ReadableStream<string>,
  options?: Options,
): AsyncIterableIterator<InferCSVRecord<Header, Options>>;
export async function* parseStringStream<
  Header extends ReadonlyArray<string>,
  Options extends ParseOptions<Header> = ParseOptions<Header>,
>(
  stream: ReadableStream<string>,
  options?: Options,
): AsyncIterableIterator<InferCSVRecord<Header, Options>> {
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
      ) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
    } finally {
      session?.[Symbol.dispose]();
    }
  } else if (engineConfig.hasWasm()) {
    // WASM execution for string streams
    // Validate that array output format is not used with WASM
    if (options?.outputFormat === "array") {
      throw new Error(
        "Array output format is not supported with WASM execution. " +
          "Use outputFormat: 'object' (default) or disable WASM (engine: { wasm: false }).",
      );
    }

    // Initialize WASM
    await loadWASM();

    // Create WASM stream transformer with options
    const transformer = new WASMBinaryCSVStreamTransformer({
      delimiter: options?.delimiter,
      quotation: options?.quotation,
      header: options?.header as readonly string[] | undefined,
      maxFieldCount: options?.maxFieldCount,
    });

    // Convert string stream to binary stream, then process with WASM
    const recordStream = stream
      .pipeThrough(new TextEncoderStream())
      .pipeThrough(transformer);

    const iterator = convertStreamToAsyncIterableIterator(recordStream);

    try {
      yield* iterator as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
    } catch (error) {
      try {
        await recordStream.cancel().catch(() => {});
      } catch {
        // Ignore cancellation errors
      }
      throw error;
    }
  } else {
    // Main thread execution (default for streams)
    const recordStream = parseStringStreamToStream(stream, options);

    // Create iterator from the record stream
    // Note: convertStreamToAsyncIterableIterator will handle abort signal cleanup
    const iterator = convertStreamToAsyncIterableIterator(recordStream);

    try {
      yield* iterator as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
    } catch (error) {
      // If an error occurs (including abort), cancel the record stream
      // to release the lock on the original input stream
      try {
        await recordStream.cancel().catch(() => {});
      } catch {
        // Ignore cancellation errors
      }
      throw error;
    }
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
  export function toArray<
    Header extends ReadonlyArray<string>,
    Options extends ParseOptions<Header> = ParseOptions<Header>,
  >(
    stream: ReadableStream<string>,
    options?: Options,
  ): Promise<InferCSVRecord<Header, Options>[]>;
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
  export function toStream<
    Header extends ReadonlyArray<string>,
    Options extends ParseOptions<Header> = ParseOptions<Header>,
  >(
    stream: ReadableStream<string>,
    options?: Options,
  ): ReadableStream<InferCSVRecord<Header, Options>>;
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
