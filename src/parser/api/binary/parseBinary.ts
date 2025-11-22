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
import { parseBinaryToArraySync } from "@/parser/api/binary/parseBinaryToArraySync.ts";
import { parseBinaryToIterableIterator } from "@/parser/api/binary/parseBinaryToIterableIterator.ts";
import { parseBinaryToStream } from "@/parser/api/binary/parseBinaryToStream.ts";
import { parseBinaryInWASM } from "@/parser/execution/wasm/parseBinaryInWASM.ts";
import { WorkerSession } from "@/worker/helpers/WorkerSession.ts";

/**
 * Parse a binary from an {@link !Uint8Array}.
 *
 * @category Middle-level API
 *
 * @param bytes CSV bytes to parse.
 * @param options Parsing options
 * @returns Async iterable iterator of records.
 *
 * @example Parsing CSV binary
 *
 * ```ts
 * import { parseUint8Array } from 'web-csv-toolbox';
 *
 * const csv = Uint8Array.from([
 *   // ...
 * ]);
 *
 * for await (const record of parseUint8Array(csv)) {
 *   console.log(record);
 * }
 * ```
 */
export async function* parseBinary<
  Header extends ReadonlyArray<string>,
  Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
>(
  bytes: Uint8Array | ArrayBuffer,
  options?: Options,
): AsyncIterableIterator<InferCSVRecord<Header, Options>> {
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
        bytes,
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
    // Main thread execution
    if (engineConfig.hasWasm()) {
      // Validate that array output format is not used with WASM
      if (options?.outputFormat === "array") {
        throw new Error(
          "Array output format is not supported with WASM execution. " +
            "Use outputFormat: 'object' (default) or disable WASM (engine: { wasm: false }).",
        );
      }
      yield* parseBinaryInWASM(
        bytes,
        options as ParseBinaryOptions<Header> | undefined,
      ) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
    } else {
      const iterator = parseBinaryToIterableIterator(bytes, options);
      yield* convertIterableIteratorToAsync(iterator) as AsyncIterableIterator<
        InferCSVRecord<Header, Options>
      >;
    }
  }
}

export declare namespace parseBinary {
  /**
   * Parse a binary from an {@link !Uint8Array} to an array of records.
   *
   * @param bytes CSV bytes to parse.
   * @param options Parsing options
   * @returns Array of records
   *
   * @example
   * ```ts
   * import { parseUint8Array } from 'web-csv-toolbox';
   *
   * const csv = Uint8Array.from([
   *  // ...
   * ]);
   *
   * const records = await parseUint8Array.toArray(csv);
   * ```
   */
  export function toArray<
    Header extends ReadonlyArray<string>,
    Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
  >(
    bytes: Uint8Array | ArrayBuffer,
    options?: Options,
  ): Promise<InferCSVRecord<Header, Options>[]>;
  /**
   * Parse a binary from an {@link !Uint8Array} to an array of records.
   *
   * @param bytes CSV bytes to parse.
   * @param options Parsing options
   * @returns Array of records
   * @example
   *
   * ```ts
   * import { parseUint8Array } from 'web-csv-toolbox';
   *
   * const csv = Uint8Array.from([
   *  // ...
   * ]);
   *
   * const records = parseUint8Array.toArraySync(csv);
   * ```
   */
  export function toArraySync<
    Header extends ReadonlyArray<string>,
    Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
  >(
    bytes: Uint8Array | ArrayBuffer,
    options?: Options,
  ): InferCSVRecord<Header, Options>[];

  /**
   * Parse a binary from an {@link !Uint8Array} to an iterable iterator of records.
   *
   * @param bytes CSV bytes to parse.
   * @param options Parsing options
   * @returns Async iterable iterator of records.
   * @example
   * ```ts
   * import { parseUint8Array } from 'web-csv-toolbox';
   *
   * const csv = Uint8Array.from([
   *  // ...
   * ]);
   *
   * for (const record of parseUint8Array.toIterableIterator(csv)) {
   *   console.log(record);
   * }
   * ```
   */
  export function toIterableIterator<
    Header extends ReadonlyArray<string>,
    Options extends ParseBinaryOptions<Header> = ParseBinaryOptions<Header>,
  >(
    bytes: Uint8Array,
    options?: Options,
  ): IterableIterator<InferCSVRecord<Header, Options>>;

  /**
   * Parse a binary from an {@link !Uint8Array} to a stream of records.
   *
   * @param bytes CSV bytes to parse.
   * @param options Parsing options
   * @returns Stream of records.
   *
   * @example
   *
   * ```ts
   * import { parseUint8Array } from 'web-csv-toolbox';
   *
   * const csv = Uint8Array.from([
   *  // ...
   * ]);
   *
   * const stream = parseUint8Array.toStream(csv);
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
    bytes: Uint8Array,
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
