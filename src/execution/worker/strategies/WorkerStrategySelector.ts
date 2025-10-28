import type { ParseOptions, ParseBinaryOptions } from "../../../common/types.ts";
import type { InternalEngineConfig } from "../../InternalEngineConfig.ts";
import type { WorkerSession } from "../helpers/WorkerSession.ts";
import type { WorkerStrategy } from "./WorkerStrategy.ts";
import { MessageStreamingStrategy } from "./MessageStreamingStrategy.ts";
import { TransferableStreamStrategy } from "./TransferableStreamStrategy.ts";

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
  async *execute<T>(
    input: any,
    options: ParseOptions<any> | ParseBinaryOptions<any> | undefined,
    session: WorkerSession | null,
    engineConfig: InternalEngineConfig,
  ): AsyncIterableIterator<T> {
    // Determine which strategy to use
    const requestedStrategy = engineConfig.hasStreamTransfer()
      ? 'stream-transfer'
      : 'message-streaming';

    const strategy = this.strategies.get(requestedStrategy);

    if (!strategy) {
      // If stream-transfer is not available, fallback to message-streaming
      if (requestedStrategy === 'stream-transfer') {
        const fallbackStrategy = this.strategies.get('message-streaming');
        if (fallbackStrategy) {
          // Notify about fallback
          if (engineConfig.onFallback) {
            const fallbackConfig = engineConfig.createFallbackConfig();
            engineConfig.onFallback({
              requestedConfig: engineConfig.toConfig(),
              actualConfig: fallbackConfig.toConfig(),
              reason: 'TransferableStream strategy not available',
              error: undefined,
            });
          }

          yield* fallbackStrategy.execute(input, options, session, engineConfig);
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
      if (requestedStrategy === 'stream-transfer') {
        const fallbackStrategy = this.strategies.get('message-streaming');
        if (fallbackStrategy) {
          // Notify about fallback
          if (engineConfig.onFallback) {
            const fallbackConfig = engineConfig.createFallbackConfig();
            engineConfig.onFallback({
              requestedConfig: engineConfig.toConfig(),
              actualConfig: fallbackConfig.toConfig(),
              reason: error instanceof Error ? error.message : String(error),
              error: error instanceof Error ? error : undefined,
            });
          }

          // Execute with fallback strategy
          yield* fallbackStrategy.execute(input, options, session, fallbackConfig);
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
export function executeWithWorkerStrategy<T>(
  input: any,
  options: ParseOptions<any> | ParseBinaryOptions<any> | undefined,
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
