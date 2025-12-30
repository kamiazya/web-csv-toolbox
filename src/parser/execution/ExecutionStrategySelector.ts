import type { DEFAULT_DELIMITER, DEFAULT_QUOTATION } from "@/core/constants.ts";
import type {
  CSVRecord,
  InferCSVRecord,
  ParseBinaryOptions,
  ParseOptions,
} from "@/core/types.ts";
import type { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import { isWebGPUAvailable } from "@/parser/execution/gpu/parseStringInGPU.ts";
import { parseBinaryInWasm } from "@/parser/execution/wasm/parseBinaryInWasm.ts";
import { parseStringInWasm } from "@/parser/execution/wasm/parseStringInWasm.ts";
import { hasWasmSimd } from "@/wasm/loaders/wasmState.ts";

/**
 * Execution engine types
 */
export type ExecutionEngine = "gpu" | "wasm" | "javascript";

/**
 * Execution strategy for a specific input type and output format
 *
 * @internal
 */
export interface ExecutionStrategy<TInput, TOutput> {
  /**
   * Engine type (e.g., "gpu", "wasm", "javascript")
   */
  readonly engine: ExecutionEngine;

  /**
   * Check if this strategy is available in the current environment
   */
  isAvailable(): Promise<boolean>;

  /**
   * Execute the parsing with this strategy
   */
  execute(
    input: TInput,
    options: ParseOptions<readonly string[]> | ParseBinaryOptions<readonly string[]> | undefined,
  ): AsyncIterableIterator<TOutput> | AsyncGenerator<TOutput>;
}

/**
 * Execution strategy selector
 *
 * Selects and executes the appropriate parsing strategy (GPU/WASM/JavaScript)
 * based on engine configuration and environment capabilities.
 *
 * @internal
 */
export class ExecutionStrategySelector<TInput, TOutput> {
  private strategies: ExecutionStrategy<TInput, TOutput>[] = [];

  /**
   * Register a strategy (automatically sorted by priority later)
   */
  register(strategy: ExecutionStrategy<TInput, TOutput>): void {
    this.strategies.push(strategy);
  }

  /**
   * Execute parsing with automatic fallback based on engine configuration.
   *
   * Priority order:
   * 1. GPU (if enabled and available)
   * 2. WASM (if enabled and SIMD available)
   * 3. JavaScript (always available)
   *
   * @param input - Input data
   * @param options - Parse options
   * @param engineConfig - Engine configuration
   * @returns Async iterable iterator of parsed records
   */
  async *execute(
    input: TInput,
    options: ParseOptions<readonly string[]> | ParseBinaryOptions<readonly string[]> | undefined,
    engineConfig: InternalEngineConfig,
  ): AsyncIterableIterator<TOutput> {
    // Determine requested engines based on configuration
    const requestedEngines: ExecutionEngine[] = [];

    if (engineConfig.hasGPU()) {
      requestedEngines.push("gpu");
    }
    if (engineConfig.hasWasm()) {
      requestedEngines.push("wasm");
    }
    requestedEngines.push("javascript"); // Always available as final fallback

    // Try each engine in priority order
    let lastError: Error | undefined;

    for (const engineType of requestedEngines) {
      // Find strategy for this engine
      const strategy = this.strategies.find((s) => s.engine === engineType);
      if (!strategy) {
        continue; // Strategy not registered, try next
      }

      // Check if strategy is available
      const isAvailable = await strategy.isAvailable();
      if (!isAvailable) {
        // Notify about unavailability
        if (engineConfig.onFallback && engineType !== "javascript") {
          const fallbackConfig = engineType === "gpu"
            ? engineConfig.createGPUFallbackConfig()
            : engineConfig.createWasmFallbackConfig();

          engineConfig.onFallback({
            requestedConfig: engineConfig.toConfig(),
            actualConfig: fallbackConfig.toConfig(),
            reason: `${engineType.toUpperCase()} is not available in this environment`,
          });
        }
        continue; // Try next strategy
      }

      try {
        // Execute with this strategy
        yield* strategy.execute(input, options);
        return; // Success - exit
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Notify about execution failure (except for last strategy)
        const isLastEngine =
          requestedEngines.indexOf(engineType) === requestedEngines.length - 1;
        if (!isLastEngine && engineConfig.onFallback) {
          const fallbackConfig = engineType === "gpu"
            ? engineConfig.createGPUFallbackConfig()
            : engineConfig.createWasmFallbackConfig();

          engineConfig.onFallback({
            requestedConfig: engineConfig.toConfig(),
            actualConfig: fallbackConfig.toConfig(),
            reason: `${engineType.toUpperCase()} execution failed: ${lastError.message}`,
            error: lastError,
          });
        }
        // Continue to next strategy
      }
    }

    // All strategies failed
    throw lastError || new Error("All execution strategies failed");
  }
}

/**
 * Create a selector for string-based parsing
 *
 * @internal
 */
export function createStringExecutionSelector<
  Header extends ReadonlyArray<string>,
  Options extends ParseOptions<Header>,
>(
  gpuExecutor: (csv: string, options?: Options) => AsyncIterableIterator<InferCSVRecord<Header, Options>> | AsyncGenerator<InferCSVRecord<Header, Options>>,
  jsExecutor: (csv: string, options?: Options) => IterableIterator<InferCSVRecord<Header, Options>>,
): ExecutionStrategySelector<string, InferCSVRecord<Header, Options>> {
  const selector = new ExecutionStrategySelector<string, InferCSVRecord<Header, Options>>();

  // GPU strategy
  selector.register({
    engine: "gpu",
    async isAvailable() {
      return await isWebGPUAvailable();
    },
    execute(input: string, options) {
      return gpuExecutor(input, options as Options) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
    },
  });

  // WASM strategy
  selector.register({
    engine: "wasm",
    async isAvailable() {
      return hasWasmSimd();
    },
    execute(input: string, options) {
      return parseStringInWasm(input, options as Options) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
    },
  });

  // JavaScript strategy
  selector.register({
    engine: "javascript",
    async isAvailable() {
      return true; // Always available
    },
    async *execute(input: string, options) {
      // Convert sync iterator to async
      for (const record of jsExecutor(input, options as Options)) {
        yield record;
      }
    },
  });

  return selector;
}

/**
 * Create a selector for binary-based parsing
 *
 * @internal
 */
export function createBinaryExecutionSelector<
  Header extends ReadonlyArray<string>,
  Options extends ParseBinaryOptions<Header>,
>(
  gpuExecutor: (bytes: BufferSource, options?: Options) => AsyncIterableIterator<InferCSVRecord<Header, Options>> | AsyncGenerator<InferCSVRecord<Header, Options>>,
  jsExecutor: (bytes: BufferSource, options?: Options) => IterableIterator<InferCSVRecord<Header, Options>>,
): ExecutionStrategySelector<BufferSource, InferCSVRecord<Header, Options>> {
  const selector = new ExecutionStrategySelector<BufferSource, InferCSVRecord<Header, Options>>();

  // GPU strategy
  selector.register({
    engine: "gpu",
    async isAvailable() {
      return await isWebGPUAvailable();
    },
    execute(input: BufferSource, options) {
      return gpuExecutor(input, options as Options) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
    },
  });

  // WASM strategy
  selector.register({
    engine: "wasm",
    async isAvailable() {
      return hasWasmSimd();
    },
    execute(input: BufferSource, options) {
      if ((options as ParseBinaryOptions<Header>)?.outputFormat === "array") {
        throw new Error(
          "Array output format is not supported with WASM execution. " +
          "Use outputFormat: 'object' (default) or disable WASM (engine: { wasm: false }).",
        );
      }
      return parseBinaryInWasm(input, options as Options) as AsyncIterableIterator<InferCSVRecord<Header, Options>>;
    },
  });

  // JavaScript strategy
  selector.register({
    engine: "javascript",
    async isAvailable() {
      return true; // Always available
    },
    async *execute(input: BufferSource, options) {
      // Convert sync iterator to async
      for (const record of jsExecutor(input, options as Options)) {
        yield record;
      }
    },
  });

  return selector;
}

/**
 * Create a selector for stream-based parsing
 *
 * @internal
 */
export function createStreamExecutionSelector<
  Header extends ReadonlyArray<string>,
  Options extends ParseBinaryOptions<Header>,
>(
  gpuExecutor: (stream: ReadableStream<Uint8Array>, options?: Options) => AsyncIterableIterator<CSVRecord<Header>>,
  jsExecutor: (stream: ReadableStream<Uint8Array>, options?: Options) => AsyncIterableIterator<CSVRecord<Header>>,
): ExecutionStrategySelector<ReadableStream<Uint8Array>, CSVRecord<Header>> {
  const selector = new ExecutionStrategySelector<ReadableStream<Uint8Array>, CSVRecord<Header>>();

  // GPU strategy
  selector.register({
    engine: "gpu",
    async isAvailable() {
      return await isWebGPUAvailable();
    },
    async *execute(input: ReadableStream<Uint8Array>, options) {
      yield* gpuExecutor(input, options as Options);
    },
  });

  // WASM strategy (not yet implemented for streams)
  selector.register({
    engine: "wasm",
    async isAvailable() {
      return false; // WASM stream processing not yet implemented
    },
    async *execute(_input: ReadableStream<Uint8Array>, _options) {
      throw new Error("WASM stream processing not yet implemented");
    },
  });

  // JavaScript strategy
  selector.register({
    engine: "javascript",
    async isAvailable() {
      return true; // Always available
    },
    async *execute(input: ReadableStream<Uint8Array>, options) {
      yield* jsExecutor(input, options as Options);
    },
  });

  return selector;
}
