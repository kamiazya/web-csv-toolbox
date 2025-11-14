import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  CSVBinary,
  ParseBinaryOptions,
  ParseOptions,
} from "@/core/types.ts";
import type { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { MessageStreamingStrategy } from "@/engine/strategies/MessageStreamingStrategy.ts";
import { TransferableStreamStrategy } from "@/engine/strategies/TransferableStreamStrategy.ts";
import type { WorkerStrategy } from "@/engine/strategies/WorkerStrategy.ts";
import type { WorkerSession } from "@/worker/helpers/WorkerSession.ts";

/**
 * Worker strategy selector.
 *
 * Selects and executes the appropriate worker communication strategy based on engine configuration.
 * Handles fallback from stream-transfer to message-streaming if needed.
 *
 * @internal
 */
export class WorkerStrategySelector {
  private strategies = new Map<string, WorkerStrategy>();

  constructor() {
    // Register default strategies
    this.register(new MessageStreamingStrategy());
    this.register(new TransferableStreamStrategy());
  }

  /**
   * Register a worker strategy.
   */
  register(strategy: WorkerStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Execute with the appropriate strategy based on engine configuration.
   *
   * @param input - Input data
   * @param options - Parse options
   * @param session - Worker session (can be null)
   * @param engineConfig - Engine configuration
   * @returns Async iterable iterator of parsed records
   */
  async *execute<
    T,
    Header extends ReadonlyArray<string> = readonly string[],
    Delimiter extends string = DEFAULT_DELIMITER,
    Quotation extends string = DEFAULT_QUOTATION,
  >(
    input: string | CSVBinary | ReadableStream<string>,
    options:
      | ParseOptions<Header, Delimiter, Quotation>
      | ParseBinaryOptions<Header, Delimiter, Quotation>
      | undefined,
    session: WorkerSession | null,
    engineConfig: InternalEngineConfig,
  ): AsyncIterableIterator<T> {
    // Determine which strategy to use
    const requestedStrategy = engineConfig.hasStreamTransfer()
      ? "stream-transfer"
      : "message-streaming";

    const strategy = this.strategies.get(requestedStrategy);

    if (!strategy) {
      // If stream-transfer is not available, fallback to message-streaming
      if (requestedStrategy === "stream-transfer") {
        const fallbackStrategy = this.strategies.get("message-streaming");
        if (fallbackStrategy) {
          // Notify about fallback
          if (engineConfig.onFallback) {
            const fallbackConfig = engineConfig.createFallbackConfig();
            engineConfig.onFallback({
              requestedConfig: engineConfig.toConfig(),
              actualConfig: fallbackConfig.toConfig(),
              reason: "TransferableStream strategy not available",
              error: undefined,
            });
          }

          yield* fallbackStrategy.execute(
            input,
            options,
            session,
            engineConfig,
          );
          return;
        }
      }

      throw new Error(`Worker strategy "${requestedStrategy}" not available`);
    }

    try {
      // Execute with the requested strategy
      yield* strategy.execute(input, options, session, engineConfig);
    } catch (error) {
      // Handle fallback if not in strict mode
      if (engineConfig.hasStrict()) {
        // Strict mode: re-throw error
        throw error;
      }

      // Auto-fallback to message-streaming
      if (requestedStrategy === "stream-transfer") {
        const fallbackStrategy = this.strategies.get("message-streaming");
        if (fallbackStrategy) {
          // Notify about fallback
          const fallbackConfig = engineConfig.createFallbackConfig();
          if (engineConfig.onFallback) {
            engineConfig.onFallback({
              requestedConfig: engineConfig.toConfig(),
              actualConfig: fallbackConfig.toConfig(),
              reason: error instanceof Error ? error.message : String(error),
              error: error instanceof Error ? error : undefined,
            });
          }

          // Execute with fallback strategy
          yield* fallbackStrategy.execute(
            input,
            options,
            session,
            fallbackConfig,
          );
          return;
        }
      }

      // No fallback available, re-throw
      throw error;
    }
  }
}

// Global instance
const globalSelector = new WorkerStrategySelector();

/**
 * Execute parsing with worker strategy.
 *
 * @internal
 */
export function executeWithWorkerStrategy<
  T,
  Header extends ReadonlyArray<string> = readonly string[],
  Delimiter extends string = DEFAULT_DELIMITER,
  Quotation extends string = DEFAULT_QUOTATION,
>(
  input: string | CSVBinary | ReadableStream<string>,
  options:
    | ParseOptions<Header, Delimiter, Quotation>
    | ParseBinaryOptions<Header, Delimiter, Quotation>
    | undefined,
  session: WorkerSession | null,
  engineConfig: InternalEngineConfig,
): AsyncIterableIterator<T> {
  return globalSelector.execute(input, options, session, engineConfig);
}

/**
 * Register a custom worker strategy.
 *
 * @internal
 */
export function registerWorkerStrategy(strategy: WorkerStrategy): void {
  globalSelector.register(strategy);
}
