import { convertStreamToAsyncIterableIterator } from "@/converters/iterators/convertStreamToAsyncIterableIterator.ts";
import * as internal from "@/converters/iterators/convertThisAsyncIterableIteratorToArray.ts";
import type { DEFAULT_DELIMITER } from "@/core/constants.ts";
import type {
  CSVRecord,
  InferCSVRecord,
  ParseBinaryOptions,
  ParseOptions,
} from "@/core/types.ts";
import { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { executeWithWorkerStrategy } from "@/engine/strategies/WorkerStrategySelector.ts";
import { parseUint8ArrayStreamToStream } from "@/parser/api/binary/parseUint8ArrayStreamToStream.ts";
import { WorkerSession } from "@/worker/helpers/WorkerSession.ts";

/**
 * Parse CSV to records.
 * This function is for parsing a binary stream.
 *
 * @category Middle-level API
 * @remarks
 * If you want to parse a string, use {@link parseStringStream}.
 * @param stream CSV string to parse
 * @param options Parsing options.
 * @returns Async iterable iterator of records.
 *
 * If you want array of records, use {@link parseUint8ArrayStream.toArray} function.
 *
 * @example Parsing CSV binary
 *
 * ```ts
 * import { parseUint8ArrayStream } from 'web-csv-toolbox';
 *
 * const csv = Uint8Array.from([
 *  // ...
 * ]);
 *
 * const stream = new ReadableStream({
 *   start(controller) {
 *     controller.enqueue(csv);
 *     controller.close();
 *   },
 * });
 *
 * for await (const record of parseUint8ArrayStream(stream)) {
 *   console.log(record);
 * }
 * ```
 */
export async function* parseUint8ArrayStream<
  Header extends ReadonlyArray<string>,
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = '"',
  Options extends ParseBinaryOptions<
    Header,
    Delimiter,
    Quotation
  > = ParseBinaryOptions<Header, Delimiter, Quotation>,
>(
  stream: ReadableStream<Uint8Array>,
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
        options as
          | ParseOptions<Header>
          | ParseBinaryOptions<Header>
          | undefined,
        session,
        engineConfig,
      ) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
    } finally {
      session?.[Symbol.dispose]();
    }
  } else {
    // Main thread execution (default for streams)
    const recordStream = parseUint8ArrayStreamToStream<
      Header,
      Delimiter,
      Quotation,
      Options
    >(stream, options);

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

export declare namespace parseUint8ArrayStream {
  /**
   * Parse CSV binary to array of records,
   * ideal for smaller data sets.
   *
   * @returns Array of records
   *
   * @example Parsing CSV binary
   * ```ts
   * import { parseUint8ArrayStream } from 'web-csv-toolbox';
   *
   * const csv = Uint8Array.from([
   *   // ...
   * ]);
   *
   * const stream = new ReadableStream({
   *   start(controller) {
   *     controller.enqueue(csv);
   *     controller.close();
   *   },
   * });
   *
   * const records = await parseUint8ArrayStream.toArray(stream);
   * console.log(records);
   * ```
   */
  export function toArray<
    Header extends ReadonlyArray<string>,
    Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
  >(
    stream: ReadableStream<Uint8Array>,
    options?: Options,
  ): Promise<InferCSVRecord<Header, Options>[]>;
  /**
   * Parse CSV binary to array of records.
   *
   * @returns Stream of records
   *
   * @example Parsing CSV binary
   * ```ts
   * import { parseUint8ArrayStream } from 'web-csv-toolbox';
   *
   * const csv = Uint8Array.from([
   *  // ...
   * ]);
   *
   * const stream = new ReadableStream({
   *  start(controller) {
   *   controller.enqueue(csv);
   *  controller.close();
   * },
   * });
   *
   * await parseUint8ArrayStream.toStream(stream)
   *   .pipeTo(new WritableStream({
   *     write(record) {
   *       console.log(record);
   *     },
   *   }),
   * );
   * ```
   */
  export function toStream<
    Header extends ReadonlyArray<string>,
    Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
  >(
    stream: ReadableStream<Uint8Array>,
    options?: Options,
  ): ReadableStream<InferCSVRecord<Header, Options>>;
}
Object.defineProperties(parseUint8ArrayStream, {
  toArray: {
    enumerable: true,
    writable: false,
    value: internal.convertThisAsyncIterableIteratorToArray,
  },
  toStream: {
    enumerable: true,
    writable: false,
    value: parseUint8ArrayStreamToStream,
  },
});
