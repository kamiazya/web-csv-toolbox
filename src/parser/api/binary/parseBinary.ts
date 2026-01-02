import * as internal from "@/converters/iterators/convertThisAsyncIterableIteratorToArray.ts";
import type {
  CSVRecord,
  InferCSVRecord,
  ParseBinaryOptions,
  ParseOptions,
} from "@/core/types.ts";
import { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { executeWithWorkerStrategy } from "@/engine/strategies/WorkerStrategySelector.ts";
import { parseBinaryToArraySync } from "@/parser/api/binary/parseBinaryToArraySync.ts";
import { parseBinaryToIterableIterator } from "@/parser/api/binary/parseBinaryToIterableIterator.ts";
import { parseBinaryToStream } from "@/parser/api/binary/parseBinaryToStream.ts";
import { createBinaryExecutionSelector } from "@/parser/execution/ExecutionStrategySelector.ts";
import { parseBinaryStreamInGPU } from "@/parser/execution/gpu/parseBinaryStreamInGPU.ts";
import { hasWasmSimd } from "@/wasm/loaders/wasmState.ts";
import { WorkerSession } from "@/worker/helpers/WorkerSession.ts";

/**
 * Parse a binary from a BufferSource.
 *
 * @category Middle-level API
 *
 * @param bytes CSV bytes to parse (BufferSource: Uint8Array, ArrayBuffer, or other TypedArray).
 * @param options Parsing options
 * @returns Async iterable iterator of records.
 *
 * @example Parsing CSV binary
 *
 * ```ts
 * import { parseBinary } from 'web-csv-toolbox';
 *
 * const csv = Uint8Array.from([
 *   // ...
 * ]);
 *
 * for await (const record of parseBinary(csv)) {
 *   console.log(record);
 * }
 * ```
 */
export async function* parseBinary<
  Header extends ReadonlyArray<string>,
  Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
>(
  bytes: BufferSource,
  options?: Options,
): AsyncIterableIterator<InferCSVRecord<Header, Options>> {
  // Parse engine configuration
  const engineConfig = new InternalEngineConfig(options?.engine);
  const simdAvailable = hasWasmSimd();
  const wasmEnabled = engineConfig.hasWasm() && simdAvailable;
  const runtimeEngineConfig = wasmEnabled
    ? engineConfig
    : engineConfig.createWasmFallbackConfig();

  // Notify about WASM SIMD unavailability if WASM was requested
  if (engineConfig.hasWasm() && !simdAvailable && engineConfig.onFallback) {
    const fallbackConfig = engineConfig.createWasmFallbackConfig();
    engineConfig.onFallback({
      requestedConfig: engineConfig.toConfig(),
      actualConfig: fallbackConfig.toConfig(),
      reason: "WebAssembly SIMD is not supported in this environment",
    });
  }

  if (runtimeEngineConfig.hasWorker()) {
    // Worker execution
    const session = runtimeEngineConfig.workerPool
      ? await WorkerSession.create({
          workerPool: runtimeEngineConfig.workerPool,
          workerURL: runtimeEngineConfig.workerURL,
        })
      : null;

    try {
      yield* executeWithWorkerStrategy<CSVRecord<Header>>(
        bytes,
        options as
          | ParseOptions<Header>
          | ParseBinaryOptions<Header>
          | undefined,
        session,
        runtimeEngineConfig,
      ) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
    } finally {
      session?.[Symbol.dispose]();
    }
  } else {
    // Main thread execution
    // Create execution selector with GPU and JavaScript executors
    const selector = createBinaryExecutionSelector<Header, Options>(
      // GPU executor
      async function* (bytes: BufferSource, options: Options | undefined) {
        // Convert BufferSource to ReadableStream for GPU processing
        const binaryStream = new ReadableStream<Uint8Array>({
          start(controller) {
            const uint8Array =
              bytes instanceof Uint8Array
                ? bytes
                : new Uint8Array(
                    bytes instanceof ArrayBuffer
                      ? bytes
                      : bytes.buffer.slice(
                          bytes.byteOffset,
                          bytes.byteOffset + bytes.byteLength,
                        ),
                  );
            controller.enqueue(uint8Array);
            controller.close();
          },
        });

        // GPU execution with automatic device management
        yield* parseBinaryStreamInGPU(binaryStream, options);
      } as any,
      // JavaScript executor (sync)
      (bytes, options) => parseBinaryToIterableIterator(bytes, options),
    );

    // Execute with automatic fallback: GPU → WASM → JavaScript
    yield* selector.execute(
      bytes,
      options,
      engineConfig,
    ) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
  }
}

export declare namespace parseBinary {
  /**
   * Parse a binary from a BufferSource to an array of records.
   *
   * @param bytes CSV bytes to parse (BufferSource: Uint8Array, ArrayBuffer, or other TypedArray).
   * @param options Parsing options
   * @returns Array of records
   *
   * @example
   * ```ts
   * import { parseBinary } from 'web-csv-toolbox';
   *
   * const csv = Uint8Array.from([
   *  // ...
   * ]);
   *
   * const records = await parseBinary.toArray(csv);
   * ```
   */
  export function toArray<
    Header extends ReadonlyArray<string>,
    Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
  >(
    bytes: BufferSource,
    options?: Options,
  ): Promise<InferCSVRecord<Header, Options>[]>;
  /**
   * Parse a binary from a BufferSource to an array of records.
   *
   * @param bytes CSV bytes to parse (BufferSource: Uint8Array, ArrayBuffer, or other TypedArray).
   * @param options Parsing options
   * @returns Array of records
   * @example
   *
   * ```ts
   * import { parseBinary } from 'web-csv-toolbox';
   *
   * const csv = Uint8Array.from([
   *  // ...
   * ]);
   *
   * const records = parseBinary.toArraySync(csv);
   * ```
   */
  export function toArraySync<
    Header extends ReadonlyArray<string>,
    Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
  >(bytes: BufferSource, options?: Options): InferCSVRecord<Header, Options>[];

  /**
   * Parse a binary from a BufferSource to an iterable iterator of records.
   *
   * @param bytes CSV bytes to parse (BufferSource: Uint8Array, ArrayBuffer, or other TypedArray).
   * @param options Parsing options
   * @returns Async iterable iterator of records.
   * @example
   * ```ts
   * import { parseBinary } from 'web-csv-toolbox';
   *
   * const csv = Uint8Array.from([
   *  // ...
   * ]);
   *
   * for (const record of parseBinary.toIterableIterator(csv)) {
   *   console.log(record);
   * }
   * ```
   */
  export function toIterableIterator<
    Header extends ReadonlyArray<string>,
    Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
  >(
    bytes: BufferSource,
    options?: Options,
  ): IterableIterator<InferCSVRecord<Header, Options>>;

  /**
   * Parse a binary from a BufferSource to a stream of records.
   *
   * @param bytes CSV bytes to parse (BufferSource: Uint8Array, ArrayBuffer, or other TypedArray).
   * @param options Parsing options
   * @returns Stream of records.
   *
   * @example
   *
   * ```ts
   * import { parseBinary } from 'web-csv-toolbox';
   *
   * const csv = Uint8Array.from([
   *  // ...
   * ]);
   *
   * const stream = parseBinary.toStream(csv);
   *
   * await stream.pipeTo(
   *   new WritableStream({
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
    bytes: BufferSource,
    options?: Options,
  ): ReadableStream<InferCSVRecord<Header, Options>>;
}

Object.defineProperties(parseBinary, {
  toArray: {
    enumerable: true,
    writable: false,
    value: internal.convertThisAsyncIterableIteratorToArray,
  },
  toArraySync: {
    enumerable: true,
    writable: false,
    value: parseBinaryToArraySync,
  },
  toIterableIterator: {
    enumerable: true,
    writable: false,
    value: parseBinaryToIterableIterator,
  },
  toStream: {
    enumerable: true,
    writable: false,
    value: parseBinaryToStream,
  },
});
