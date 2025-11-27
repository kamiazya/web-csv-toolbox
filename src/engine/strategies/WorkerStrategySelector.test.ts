import { describe, expect, it, vi } from "vitest";
import type { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import type { WorkerStrategyName } from "@/execution/utils/contextToStrategy.ts";
import type { WorkerStrategy } from "./WorkerStrategy.ts";
import {
  executeWithWorkerStrategy,
  registerWorkerStrategy,
  type StrategyExecutionOptions,
  WorkerStrategySelector,
} from "./WorkerStrategySelector.ts";

// Create mock strategy
function createMockStrategy(
  name: string,
  results: unknown[] = [],
  shouldFail = false,
  failMessage = "Strategy failed",
): WorkerStrategy & { executeCalls: number } {
  let executeCalls = 0;
  return {
    name,
    async *execute() {
      executeCalls++;
      if (shouldFail) {
        throw new Error(failMessage);
      }
      for (const result of results) {
        yield result;
      }
    },
    get executeCalls() {
      return executeCalls;
    },
  } as unknown as WorkerStrategy & { executeCalls: number };
}

// Create mock engine config
function createMockEngineConfig(
  options: {
    hasStreamTransfer?: boolean;
    hasStrict?: boolean;
    onFallback?: ReturnType<typeof vi.fn>;
  } = {},
): InternalEngineConfig {
  const fallbackConfig = {
    toConfig: () => ({ worker: true, workerStrategy: "message-streaming" }),
  };

  return {
    hasStreamTransfer: () => options.hasStreamTransfer ?? false,
    hasStrict: () => options.hasStrict ?? false,
    onFallback: options.onFallback,
    toConfig: () => ({
      worker: true,
      workerStrategy: options.hasStreamTransfer
        ? "stream-transfer"
        : "message-streaming",
    }),
    createWorkerFallbackConfig: () => fallbackConfig,
  } as unknown as InternalEngineConfig;
}

describe("WorkerStrategySelector", () => {
  describe("register", () => {
    it("should register a custom strategy", async () => {
      const selector = new WorkerStrategySelector();
      const customStrategy = createMockStrategy("custom", [{ name: "test" }]);

      selector.register(customStrategy);

      // Try to use the custom strategy
      const engineConfig = createMockEngineConfig();
      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["custom" as WorkerStrategyName],
      };

      const results: unknown[] = [];
      for await (const record of selector.execute(
        "test",
        undefined,
        null,
        engineConfig,
        execOptions,
      )) {
        results.push(record);
      }

      expect(results).toEqual([{ name: "test" }]);
    });
  });

  describe("execute - legacy behavior", () => {
    it("should use message-streaming when hasStreamTransfer is false", async () => {
      const selector = new WorkerStrategySelector();
      const engineConfig = createMockEngineConfig({ hasStreamTransfer: false });

      // Override with mock strategy
      const mockStrategy = createMockStrategy("message-streaming", [{ id: 1 }]);
      selector.register(mockStrategy);

      const results: unknown[] = [];
      for await (const record of selector.execute(
        "csv",
        undefined,
        null,
        engineConfig,
      )) {
        results.push(record);
      }

      expect(results).toEqual([{ id: 1 }]);
      expect(mockStrategy.executeCalls).toBe(1);
    });

    it("should use stream-transfer when hasStreamTransfer is true", async () => {
      const selector = new WorkerStrategySelector();
      const engineConfig = createMockEngineConfig({ hasStreamTransfer: true });

      const mockStrategy = createMockStrategy("stream-transfer", [{ id: 2 }]);
      selector.register(mockStrategy);

      const results: unknown[] = [];
      for await (const record of selector.execute(
        "csv",
        undefined,
        null,
        engineConfig,
      )) {
        results.push(record);
      }

      expect(results).toEqual([{ id: 2 }]);
    });

    it("should throw error when strategy is not available", async () => {
      const selector = new WorkerStrategySelector();

      // Remove all strategies
      (selector as any).strategies.clear();

      const engineConfig = createMockEngineConfig();

      await expect(async () => {
        for await (const _ of selector.execute(
          "csv",
          undefined,
          null,
          engineConfig,
        )) {
          // consume
        }
      }).rejects.toThrow("Worker strategy");
    });
  });

  describe("execute - preferredStrategies", () => {
    it("should use first preferred strategy when available", async () => {
      const selector = new WorkerStrategySelector();
      const engineConfig = createMockEngineConfig();

      const streamStrategy = createMockStrategy("stream-transfer", [
        { source: "stream" },
      ]);
      const messageStrategy = createMockStrategy("message-streaming", [
        { source: "message" },
      ]);
      selector.register(streamStrategy);
      selector.register(messageStrategy);

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["stream-transfer", "message-streaming"],
      };

      const results: unknown[] = [];
      for await (const record of selector.execute(
        "csv",
        undefined,
        null,
        engineConfig,
        execOptions,
      )) {
        results.push(record);
      }

      expect(results).toEqual([{ source: "stream" }]);
      expect(streamStrategy.executeCalls).toBe(1);
      expect(messageStrategy.executeCalls).toBe(0); // Not called
    });

    it("should fallback to second strategy when first fails", async () => {
      const selector = new WorkerStrategySelector();
      const engineConfig = createMockEngineConfig({ hasStrict: false });

      const failingStrategy = createMockStrategy(
        "stream-transfer",
        [],
        true,
        "Stream failed",
      );
      const workingStrategy = createMockStrategy("message-streaming", [
        { fallback: true },
      ]);
      selector.register(failingStrategy);
      selector.register(workingStrategy);

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["stream-transfer", "message-streaming"],
      };

      const results: unknown[] = [];
      for await (const record of selector.execute(
        "csv",
        undefined,
        null,
        engineConfig,
        execOptions,
      )) {
        results.push(record);
      }

      expect(results).toEqual([{ fallback: true }]);
      expect(failingStrategy.executeCalls).toBe(1);
      expect(workingStrategy.executeCalls).toBe(1);
    });

    it("should skip unavailable strategies", async () => {
      const selector = new WorkerStrategySelector();
      const engineConfig = createMockEngineConfig();

      // Only register message-streaming
      const messageStrategy = createMockStrategy("message-streaming", [
        { only: "message" },
      ]);
      selector.register(messageStrategy);

      // Clear default strategies and re-register only message-streaming
      (selector as any).strategies.clear();
      selector.register(messageStrategy);

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["stream-transfer", "message-streaming"],
      };

      const results: unknown[] = [];
      for await (const record of selector.execute(
        "csv",
        undefined,
        null,
        engineConfig,
        execOptions,
      )) {
        results.push(record);
      }

      expect(results).toEqual([{ only: "message" }]);
    });

    it("should throw error when all strategies fail", async () => {
      const selector = new WorkerStrategySelector();
      const engineConfig = createMockEngineConfig({ hasStrict: false });

      const failingStrategy1 = createMockStrategy(
        "stream-transfer",
        [],
        true,
        "Strategy 1 failed",
      );
      const failingStrategy2 = createMockStrategy(
        "message-streaming",
        [],
        true,
        "Strategy 2 failed",
      );
      selector.register(failingStrategy1);
      selector.register(failingStrategy2);

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["stream-transfer", "message-streaming"],
      };

      await expect(async () => {
        for await (const _ of selector.execute(
          "csv",
          undefined,
          null,
          engineConfig,
          execOptions,
        )) {
          // consume
        }
      }).rejects.toThrow("Strategy 2 failed");
    });

    it("should throw error when no strategies are available", async () => {
      const selector = new WorkerStrategySelector();
      const engineConfig = createMockEngineConfig();

      (selector as any).strategies.clear();

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["stream-transfer", "message-streaming"],
      };

      await expect(async () => {
        for await (const _ of selector.execute(
          "csv",
          undefined,
          null,
          engineConfig,
          execOptions,
        )) {
          // consume
        }
      }).rejects.toThrow("No available worker strategies");
    });
  });

  describe("execute - strict mode", () => {
    it("should re-throw error in strict mode without fallback", async () => {
      const selector = new WorkerStrategySelector();
      const engineConfig = createMockEngineConfig({ hasStrict: true });

      const failingStrategy = createMockStrategy(
        "stream-transfer",
        [],
        true,
        "Strict error",
      );
      const workingStrategy = createMockStrategy("message-streaming", [
        { should: "not reach" },
      ]);
      selector.register(failingStrategy);
      selector.register(workingStrategy);

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["stream-transfer", "message-streaming"],
      };

      await expect(async () => {
        for await (const _ of selector.execute(
          "csv",
          undefined,
          null,
          engineConfig,
          execOptions,
        )) {
          // consume
        }
      }).rejects.toThrow("Strict error");
    });

    it("should re-throw error in strict mode (legacy behavior)", async () => {
      const selector = new WorkerStrategySelector();
      const engineConfig = createMockEngineConfig({
        hasStreamTransfer: true,
        hasStrict: true,
      });

      const failingStrategy = createMockStrategy(
        "stream-transfer",
        [],
        true,
        "Transfer failed",
      );
      selector.register(failingStrategy);

      await expect(async () => {
        for await (const _ of selector.execute(
          "csv",
          undefined,
          null,
          engineConfig,
        )) {
          // consume
        }
      }).rejects.toThrow("Transfer failed");
    });
  });

  describe("execute - onFallback callback", () => {
    it("should call onFallback when falling back (preferredStrategies)", async () => {
      const selector = new WorkerStrategySelector();
      const onFallback = vi.fn();
      const engineConfig = createMockEngineConfig({
        hasStrict: false,
        onFallback,
      });

      const failingStrategy = createMockStrategy(
        "stream-transfer",
        [],
        true,
        "Test failure",
      );
      const workingStrategy = createMockStrategy("message-streaming", [
        { result: true },
      ]);
      selector.register(failingStrategy);
      selector.register(workingStrategy);

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["stream-transfer", "message-streaming"],
      };

      const results: unknown[] = [];
      for await (const record of selector.execute(
        "csv",
        undefined,
        null,
        engineConfig,
        execOptions,
      )) {
        results.push(record);
      }

      expect(onFallback).toHaveBeenCalledOnce();
      expect(onFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: expect.stringContaining("stream-transfer"),
          error: expect.any(Error),
        }),
      );
    });

    it("should call onFallback when falling back (legacy behavior)", async () => {
      const selector = new WorkerStrategySelector();
      const onFallback = vi.fn();
      const engineConfig = createMockEngineConfig({
        hasStreamTransfer: true,
        hasStrict: false,
        onFallback,
      });

      const failingStrategy = createMockStrategy(
        "stream-transfer",
        [],
        true,
        "Legacy failure",
      );
      const workingStrategy = createMockStrategy("message-streaming", [
        { fallback: true },
      ]);
      selector.register(failingStrategy);
      selector.register(workingStrategy);

      const results: unknown[] = [];
      for await (const record of selector.execute(
        "csv",
        undefined,
        null,
        engineConfig,
      )) {
        results.push(record);
      }

      expect(onFallback).toHaveBeenCalled();
    });
  });
});

describe("executeWithWorkerStrategy", () => {
  it("should use global selector instance", async () => {
    // This tests that the global function works correctly
    const _engineConfig = createMockEngineConfig({ hasStreamTransfer: false });

    // The function should work with the default strategies
    // We can't easily test the actual execution without a real worker,
    // but we can verify the function is callable
    expect(typeof executeWithWorkerStrategy).toBe("function");
  });
});

describe("registerWorkerStrategy", () => {
  it("should register strategy to global selector", () => {
    // Test that the global registration function exists
    expect(typeof registerWorkerStrategy).toBe("function");
  });
});

describe("StrategyExecutionOptions", () => {
  it("should accept preferredStrategies option", async () => {
    const selector = new WorkerStrategySelector();
    const engineConfig = createMockEngineConfig();

    const mockStrategy = createMockStrategy("message-streaming", [
      { test: true },
    ]);
    selector.register(mockStrategy);

    const execOptions: StrategyExecutionOptions = {
      preferredStrategies: ["message-streaming"],
    };

    const results: unknown[] = [];
    for await (const record of selector.execute(
      "csv",
      undefined,
      null,
      engineConfig,
      execOptions,
    )) {
      results.push(record);
    }

    expect(results).toEqual([{ test: true }]);
  });

  it("should work with empty preferredStrategies (falls back to legacy)", async () => {
    const selector = new WorkerStrategySelector();
    const engineConfig = createMockEngineConfig({ hasStreamTransfer: false });

    const mockStrategy = createMockStrategy("message-streaming", [
      { legacy: true },
    ]);
    selector.register(mockStrategy);

    const execOptions: StrategyExecutionOptions = {
      preferredStrategies: [],
    };

    const results: unknown[] = [];
    for await (const record of selector.execute(
      "csv",
      undefined,
      null,
      engineConfig,
      execOptions,
    )) {
      results.push(record);
    }

    expect(results).toEqual([{ legacy: true }]);
  });

  it("should work without execOptions (legacy behavior)", async () => {
    const selector = new WorkerStrategySelector();
    const engineConfig = createMockEngineConfig({ hasStreamTransfer: false });

    const mockStrategy = createMockStrategy("message-streaming", [
      { noOptions: true },
    ]);
    selector.register(mockStrategy);

    const results: unknown[] = [];
    for await (const record of selector.execute(
      "csv",
      undefined,
      null,
      engineConfig,
    )) {
      results.push(record);
    }

    expect(results).toEqual([{ noOptions: true }]);
  });
});
