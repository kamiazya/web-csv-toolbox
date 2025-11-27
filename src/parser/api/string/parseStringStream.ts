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
import {
  executeWithWorkerStrategy,
  type StrategyExecutionOptions,
} from "@/engine/strategies/WorkerStrategySelector.ts";
import { EnvironmentCapabilities } from "@/execution/EnvironmentCapabilities.ts";
import {
  ExecutionPathResolver,
  type ResolverContext,
} from "@/execution/ExecutionPathResolver.ts";
import { parseStringStreamToStream } from "@/parser/api/string/parseStringStreamToStream.ts";
import { parseStringStreamInGPU } from "@/parser/execution/gpu/parseStringStreamInGPU.ts";
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
 *   engine: EnginePresets.recommended()
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

  // Get environment capabilities (async to properly detect GPU via requestAdapter)
  const capabilities = await EnvironmentCapabilities.getInstance();

  // Build resolver context
  const resolverContext: ResolverContext = {
    inputType: "string-stream",
    outputFormat: options?.outputFormat ?? "object",
    engineConfig,
    capabilities,
  };

  // Resolve execution plan based on optimizationHint and capabilities
  const resolver = new ExecutionPathResolver();
  const plan = resolver.resolve(resolverContext);

  // Track last error for fallback reporting
  let lastError: Error | null = null;

  // Iterate through contexts in priority order (per design: contexts × backends)
  for (const context of plan.contexts) {
    // For each context, try viable backends in priority order
    for (const backend of plan.backends) {
      try {
        // GPU backend - only viable in main context for streams
        if (backend === "gpu" && context === "main") {
          if (capabilities.gpu && engineConfig.hasGpu()) {
            yield* parseStringStreamInGPU(
              stream,
              options,
            ) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
            return;
          }
        }

        // JS backend in worker-stream-transfer context
        if (backend === "js" && context === "worker-stream-transfer") {
          if (engineConfig.hasWorker()) {
            const session = engineConfig.workerPool
              ? await WorkerSession.create({
                  workerPool: engineConfig.workerPool,
                  workerURL: engineConfig.workerURL,
                })
              : null;

            const execOptions: StrategyExecutionOptions = {
              preferredStrategies: ["stream-transfer"],
            };

            try {
              yield* executeWithWorkerStrategy<CSVRecord<Header>>(
                stream,
                options,
                session,
                engineConfig,
                execOptions,
              ) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
              return;
            } finally {
              session?.[Symbol.dispose]();
            }
          }
        }

        // JS backend in main context
        if (backend === "js" && context === "main") {
          const recordStream = parseStringStreamToStream(stream, options);
          const iterator = convertStreamToAsyncIterableIterator(recordStream);

          try {
            yield* iterator as AsyncIterableIterator<
              InferCSVRecord<Header, Options>
            >;
            return;
          } catch (error) {
            try {
              await recordStream.cancel().catch(() => {});
            } catch {
              // Ignore cancellation errors
            }
            throw error;
          }
        }

        // WASM backend is not applicable for stream inputs (requires buffering)
      } catch (error) {
        // Track error and notify fallback
        lastError = error instanceof Error ? error : new Error(String(error));
        const previousBackend = backend;
        const previousContext = context;

        // Find next viable combination for fallback notification
        const nextCombination = findNextViableCombinationForStringStream(
          plan,
          context,
          backend,
          engineConfig,
          capabilities,
        );

        if (nextCombination && engineConfig.onFallback) {
          engineConfig.onFallback({
            requestedConfig: engineConfig.toConfig(),
            actualConfig: engineConfig.toConfig(),
            reason: `${previousBackend}/${previousContext} failed: ${lastError.message}`,
          });
        }
        // Continue to next backend/context combination
      }
    }
  }

  // If we reach here, all combinations failed - throw last error or execute fallback
  if (lastError) {
    throw lastError;
  }

  // Final fallback: main thread JS execution
  const recordStream = parseStringStreamToStream(stream, options);
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
}

/**
 * Find the next viable context/backend combination for fallback notification.
 */
function findNextViableCombinationForStringStream(
  plan: { backends: string[]; contexts: string[] },
  currentContext: string,
  currentBackend: string,
  engineConfig: InternalEngineConfig,
  capabilities: { gpu: boolean; transferableStreams: boolean },
): { context: string; backend: string } | null {
  const contextIdx = plan.contexts.indexOf(currentContext);
  const backendIdx = plan.backends.indexOf(currentBackend);

  // Check remaining backends in current context
  for (let b = backendIdx + 1; b < plan.backends.length; b++) {
    const backend = plan.backends[b];
    if (
      backend !== undefined &&
      isViableCombinationForStringStream(
        currentContext,
        backend,
        engineConfig,
        capabilities,
      )
    ) {
      return { context: currentContext, backend };
    }
  }

  // Check remaining contexts
  for (let c = contextIdx + 1; c < plan.contexts.length; c++) {
    const context = plan.contexts[c];
    if (context === undefined) continue;
    for (const backend of plan.backends) {
      if (
        isViableCombinationForStringStream(
          context,
          backend,
          engineConfig,
          capabilities,
        )
      ) {
        return { context, backend };
      }
    }
  }

  return null;
}

/**
 * Check if a context/backend combination is viable for string stream input.
 */
function isViableCombinationForStringStream(
  context: string,
  backend: string,
  engineConfig: InternalEngineConfig,
  capabilities: { gpu: boolean; transferableStreams: boolean },
): boolean {
  if (backend === "gpu" && context === "main") {
    return capabilities.gpu && engineConfig.hasGpu();
  }
  if (backend === "js" && context === "worker-stream-transfer") {
    return engineConfig.hasWorker() && capabilities.transferableStreams;
  }
  if (backend === "js" && context === "main") {
    return true;
  }
  return false;
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
