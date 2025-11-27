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
import {
  executeWithWorkerStrategy,
  type StrategyExecutionOptions,
} from "@/engine/strategies/WorkerStrategySelector.ts";
import { EnvironmentCapabilities } from "@/execution/EnvironmentCapabilities.ts";
import {
  ExecutionPathResolver,
  type ResolverContext,
} from "@/execution/ExecutionPathResolver.ts";
import { parseBinaryStreamToStream } from "@/parser/api/binary/parseBinaryStreamToStream.ts";
import { parseBinaryStreamInGPU } from "@/parser/execution/gpu/parseBinaryStreamInGPU.ts";
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
 * If you want array of records, use {@link parseBinaryStream.toArray} function.
 *
 * @example Parsing CSV binary
 *
 * ```ts
 * import { parseBinaryStream } from 'web-csv-toolbox';
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
 * for await (const record of parseBinaryStream(stream)) {
 *   console.log(record);
 * }
 * ```
 */
export async function* parseBinaryStream<
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

  // Get environment capabilities (async to properly detect GPU via requestAdapter)
  const capabilities = await EnvironmentCapabilities.getInstance();

  // Build resolver context
  const resolverContext: ResolverContext = {
    inputType: "binary-stream",
    outputFormat: options?.outputFormat ?? "object",
    charset: options?.charset,
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
            yield* parseBinaryStreamInGPU(
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
                options as
                  | ParseOptions<Header>
                  | ParseBinaryOptions<Header>
                  | undefined,
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
          const recordStream = parseBinaryStreamToStream<
            Header,
            Delimiter,
            Quotation,
            Options
          >(stream, options);

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
        const nextCombination = findNextViableCombination(
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
  const recordStream = parseBinaryStreamToStream<
    Header,
    Delimiter,
    Quotation,
    Options
  >(stream, options);

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
function findNextViableCombination(
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
      isViableCombination(currentContext, backend, engineConfig, capabilities)
    ) {
      return { context: currentContext, backend };
    }
  }

  // Check remaining contexts
  for (let c = contextIdx + 1; c < plan.contexts.length; c++) {
    const context = plan.contexts[c];
    if (context === undefined) continue;
    for (const backend of plan.backends) {
      if (isViableCombination(context, backend, engineConfig, capabilities)) {
        return { context, backend };
      }
    }
  }

  return null;
}

/**
 * Check if a context/backend combination is viable for stream input.
 */
function isViableCombination(
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

export declare namespace parseBinaryStream {
  /**
   * Parse CSV binary to array of records,
   * ideal for smaller data sets.
   *
   * @returns Array of records
   *
   * @example Parsing CSV binary
   * ```ts
   * import { parseBinaryStream } from 'web-csv-toolbox';
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
   * const records = await parseBinaryStream.toArray(stream);
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
   * import { parseBinaryStream } from 'web-csv-toolbox';
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
   * await parseBinaryStream.toStream(stream)
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
Object.defineProperties(parseBinaryStream, {
  toArray: {
    enumerable: true,
    writable: false,
    value: internal.convertThisAsyncIterableIteratorToArray,
  },
  toStream: {
    enumerable: true,
    writable: false,
    value: parseBinaryStreamToStream,
  },
});
