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
import type { WorkerStrategyName } from "@/execution/utils/contextToStrategy.ts";
import type { WorkerSession } from "@/worker/helpers/WorkerSession.ts";

/**
 * Options for strategy execution.
 */
export interface StrategyExecutionOptions {
  /**
   * Preferred strategies in priority order.
   *
   * @remarks
   * When provided, the selector will try strategies in this order,
   * falling back to the next strategy if the current one fails.
   *
   * This can be generated from ExecutionPathResolver output using:
   * ```ts
   * const plan = resolver.resolve(ctx);
   * const preferredStrategies = contextsToPreferredStrategies(plan.contexts);
   * ```
   */
  preferredStrategies?: WorkerStrategyName[];
}

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
   * @param execOptions - Strategy execution options
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
    execOptions?: StrategyExecutionOptions,
  ): AsyncIterableIterator<T> {
    // If preferredStrategies is provided, use priority-based execution
    if (execOptions?.preferredStrategies?.length) {
      yield* this.executeWithPriority(
        input,
        options,
        session,
        engineConfig,
        execOptions.preferredStrategies,
      );
      return;
    }

    // Determine which strategy to use (legacy behavior)
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
            const fallbackConfig = engineConfig.createWorkerFallbackConfig();
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
          const fallbackConfig = engineConfig.createWorkerFallbackConfig();
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

  /**
   * Execute with priority-based strategy selection.
   *
   * Tries each strategy in order until one succeeds.
   * If all strategies fail, throws the error from the last attempted strategy.
   *
   * @internal
   */
  private async *executeWithPriority<
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
    preferredStrategies: WorkerStrategyName[],
  ): AsyncIterableIterator<T> {
    let lastError: Error | undefined;

    for (const strategyName of preferredStrategies) {
      const strategy = this.strategies.get(strategyName);
      if (!strategy) {
        continue; // Skip unavailable strategies
      }

      try {
        yield* strategy.execute(input, options, session, engineConfig);
        return; // Success, exit the loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // In strict mode, don't try fallback strategies
        if (engineConfig.hasStrict()) {
          throw lastError;
        }

        // Notify about fallback to next strategy
        if (engineConfig.onFallback) {
          const fallbackConfig = engineConfig.createWorkerFallbackConfig();
          engineConfig.onFallback({
            requestedConfig: engineConfig.toConfig(),
            actualConfig: fallbackConfig.toConfig(),
            reason: `Strategy "${strategyName}" failed: ${lastError.message}`,
            error: lastError,
          });
        }
        // Continue to next strategy
      }
    }

    // All strategies failed
    throw lastError ?? new Error("No available worker strategies");
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
  execOptions?: StrategyExecutionOptions,
): AsyncIterableIterator<T> {
  return globalSelector.execute(
    input,
    options,
    session,
    engineConfig,
    execOptions,
  );
}

/**
 * Register a custom worker strategy.
 *
 * @internal
 */
export function registerWorkerStrategy(strategy: WorkerStrategy): void {
  globalSelector.register(strategy);
}
