import { convertIterableIteratorToAsync } from "@/converters/iterators/convertIterableIteratorToAsync.ts";
import * as internal from "@/converters/iterators/convertThisAsyncIterableIteratorToArray.ts";
import type {
  CSVRecord,
  InferCSVRecord,
  ParseBinaryOptions,
  ParseOptions,
} from "@/core/types.ts";
import { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { executeWithWorkerStrategy } from "@/engine/strategies/WorkerStrategySelector.ts";
import { EnvironmentCapabilities } from "@/execution/EnvironmentCapabilities.ts";
import {
  ExecutionPathResolver,
  type ResolverContext,
} from "@/execution/ExecutionPathResolver.ts";
import { parseBinaryToArraySync } from "@/parser/api/binary/parseBinaryToArraySync.ts";
import { parseBinaryToIterableIterator } from "@/parser/api/binary/parseBinaryToIterableIterator.ts";
import { parseBinaryToStream } from "@/parser/api/binary/parseBinaryToStream.ts";
import { parseBinaryInGPU } from "@/parser/execution/gpu/parseBinaryInGPU.ts";
import { parseBinaryInWASM } from "@/parser/execution/wasm/parseBinaryInWASM.ts";
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

  // Get environment capabilities (async to properly detect GPU via requestAdapter)
  const capabilities = await EnvironmentCapabilities.getInstance();

  // Build resolver context
  const resolverContext: ResolverContext = {
    inputType: "binary",
    outputFormat: options?.outputFormat ?? "object",
    charset: options?.charset,
    engineConfig,
    capabilities,
  };

  // Resolve execution plan based on optimizationHint and capabilities
  const resolver = new ExecutionPathResolver();
  const plan = resolver.resolve(resolverContext);

  // Determine execution path based on plan
  const backends = plan.backends;

  // Convert BufferSource to Uint8Array for GPU parsing
  const uint8Array =
    bytes instanceof ArrayBuffer
      ? new Uint8Array(bytes)
      : ArrayBuffer.isView(bytes)
        ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        : bytes;

  // Try backends in priority order
  for (const backend of backends) {
    if (backend === "gpu" && capabilities.gpu && engineConfig.hasGpu()) {
      // GPU execution
      yield* parseBinaryInGPU(
        uint8Array,
        options as ParseBinaryOptions<Header> | undefined,
      ) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
      return;
    }

    if (backend === "wasm" && engineConfig.hasWasm()) {
      // Validate that array output format is not used with WASM
      if (options?.outputFormat === "array") {
        continue; // Skip WASM, try next backend
      }
      // WASM execution
      yield* parseBinaryInWASM(
        bytes,
        options as ParseBinaryOptions<Header> | undefined,
      ) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
      return;
    }

    if (backend === "js") {
      // Check plan.contexts to determine if worker or main thread should be used
      // For non-stream inputs, worker-message is viable
      const preferWorker = plan.contexts.some(
        (ctx) => ctx === "worker-message" || ctx === "worker-stream-transfer",
      );
      const mainFirst = plan.contexts[0] === "main";

      // Use worker only if:
      // 1. Worker is enabled in config
      // 2. Worker context is available in plan
      // 3. Main is NOT the first priority (respecting optimizationHint)
      if (engineConfig.hasWorker() && preferWorker && !mainFirst) {
        const session = engineConfig.workerPool
          ? await WorkerSession.create({
              workerPool: engineConfig.workerPool,
              workerURL: engineConfig.workerURL,
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
            engineConfig,
          ) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
          return;
        } finally {
          session?.[Symbol.dispose]();
        }
      }

      // JavaScript main thread execution (preferred or fallback)
      const iterator = parseBinaryToIterableIterator(bytes, options);
      yield* convertIterableIteratorToAsync(iterator) as AsyncIterableIterator<
        InferCSVRecord<Header, Options>
      >;
      return;
    }
  }

  // Fallback to JavaScript if no backend succeeded
  const iterator = parseBinaryToIterableIterator(bytes, options);
  yield* convertIterableIteratorToAsync(iterator) as AsyncIterableIterator<
    InferCSVRecord<Header, Options>
  >;
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
