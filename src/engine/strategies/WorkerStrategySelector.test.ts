import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InternalEngineConfig } from "@/engine/config/InternalEngineConfig.ts";
import type { WorkerSession } from "@/worker/helpers/WorkerSession.ts";
import type { WorkerStrategy } from "./WorkerStrategy.ts";
import {
  type StrategyExecutionOptions,
  WorkerStrategySelector,
} from "./WorkerStrategySelector.ts";

// Mock strategies for testing
class MockStrategy implements WorkerStrategy {
  constructor(
    public name: string,
    private shouldFail = false,
    private errorMessage = "Mock error",
  ) {}

  async *execute(
    _input: any,
    _options: any,
    _session: any,
    _engineConfig: any,
  ): AsyncIterableIterator<any> {
    if (this.shouldFail) {
      throw new Error(this.errorMessage);
    }
    yield { strategy: this.name, success: true };
  }
}

describe("WorkerStrategySelector", () => {
  let selector: WorkerStrategySelector;
  let mockEngineConfig: InternalEngineConfig;
  let mockSession: WorkerSession | null;
  let onFallbackSpy: Mock;

  beforeEach(() => {
    selector = new WorkerStrategySelector();
    onFallbackSpy = vi.fn();

    // Mock InternalEngineConfig
    mockEngineConfig = {
      hasStreamTransfer: vi.fn(() => true),
      hasStrict: vi.fn(() => false),
      onFallback: onFallbackSpy,
      toConfig: vi.fn(() => ({ worker: true })),
      createWorkerFallbackConfig: vi.fn(() => mockEngineConfig),
    } as any;

    mockSession = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("preferredStrategies execution path", () => {
    it("should execute with first available strategy when all succeed", async () => {
      const strategy1 = new MockStrategy("strategy-1");
      const strategy2 = new MockStrategy("strategy-2");
      selector.register(strategy1);
      selector.register(strategy2);

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["strategy-1", "strategy-2"],
      };

      const records = [];
      for await (const record of selector.execute(
        "input",
        undefined,
        mockSession,
        mockEngineConfig,
        execOptions,
      )) {
        records.push(record);
      }

      expect(records).toEqual([{ strategy: "strategy-1", success: true }]);
      expect(onFallbackSpy).not.toHaveBeenCalled();
    });

    it("should fallback to second strategy when first fails", async () => {
      const strategy1 = new MockStrategy(
        "strategy-1",
        true,
        "Strategy 1 failed",
      );
      const strategy2 = new MockStrategy("strategy-2");
      selector.register(strategy1);
      selector.register(strategy2);

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["strategy-1", "strategy-2"],
      };

      const records = [];
      for await (const record of selector.execute(
        "input",
        undefined,
        mockSession,
        mockEngineConfig,
        execOptions,
      )) {
        records.push(record);
      }

      expect(records).toEqual([{ strategy: "strategy-2", success: true }]);
      expect(onFallbackSpy).toHaveBeenCalledTimes(1);
      expect(onFallbackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedConfig: { worker: true },
          actualConfig: { worker: true },
          reason: 'Strategy "strategy-1" failed: Strategy 1 failed',
          error: expect.any(Error),
        }),
      );
    });

    it("should not notify onFallback for last strategy failure", async () => {
      const strategy1 = new MockStrategy("strategy-1", true);
      const strategy2 = new MockStrategy("strategy-2", true);
      selector.register(strategy1);
      selector.register(strategy2);

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["strategy-1", "strategy-2"],
      };

      await expect(
        (async () => {
          for await (const _record of selector.execute(
            "input",
            undefined,
            mockSession,
            mockEngineConfig,
            execOptions,
          )) {
            // Should not reach here
          }
        })(),
      ).rejects.toThrow("Mock error");

      // Only called once for strategy-1, not for strategy-2 (last)
      expect(onFallbackSpy).toHaveBeenCalledTimes(1);
      expect(onFallbackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'Strategy "strategy-1" failed: Mock error',
        }),
      );
    });

    it("should throw error when all strategies fail", async () => {
      const strategy1 = new MockStrategy("strategy-1", true, "Error 1");
      const strategy2 = new MockStrategy("strategy-2", true, "Error 2");
      const strategy3 = new MockStrategy("strategy-3", true, "Error 3");
      selector.register(strategy1);
      selector.register(strategy2);
      selector.register(strategy3);

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["strategy-1", "strategy-2", "strategy-3"],
      };

      await expect(
        (async () => {
          for await (const _record of selector.execute(
            "input",
            undefined,
            mockSession,
            mockEngineConfig,
            execOptions,
          )) {
            // Should not reach here
          }
        })(),
      ).rejects.toThrow("Error 3");

      // Called for strategy-1 and strategy-2, but not strategy-3 (last)
      expect(onFallbackSpy).toHaveBeenCalledTimes(2);
    });

    it("should skip unavailable strategies", async () => {
      const strategy2 = new MockStrategy("strategy-2");
      selector.register(strategy2);
      // strategy-1 is not registered

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["strategy-1", "strategy-2"],
      };

      const records = [];
      for await (const record of selector.execute(
        "input",
        undefined,
        mockSession,
        mockEngineConfig,
        execOptions,
      )) {
        records.push(record);
      }

      expect(records).toEqual([{ strategy: "strategy-2", success: true }]);
      expect(onFallbackSpy).not.toHaveBeenCalled();
    });

    it("should throw when no strategies are available", async () => {
      // No strategies registered

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["strategy-1", "strategy-2"],
      };

      await expect(
        (async () => {
          for await (const _record of selector.execute(
            "input",
            undefined,
            mockSession,
            mockEngineConfig,
            execOptions,
          )) {
            // Should not reach here
          }
        })(),
      ).rejects.toThrow("No worker strategies available or all failed");

      expect(onFallbackSpy).not.toHaveBeenCalled();
    });

    it("should not call onFallback when callback is not provided", async () => {
      const strategy1 = new MockStrategy("strategy-1", true);
      const strategy2 = new MockStrategy("strategy-2");
      selector.register(strategy1);
      selector.register(strategy2);

      // Config without onFallback
      const configWithoutCallback = {
        ...mockEngineConfig,
        onFallback: undefined,
      };

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["strategy-1", "strategy-2"],
      };

      const records = [];
      for await (const record of selector.execute(
        "input",
        undefined,
        mockSession,
        configWithoutCallback as any,
        execOptions,
      )) {
        records.push(record);
      }

      expect(records).toEqual([{ strategy: "strategy-2", success: true }]);
      expect(onFallbackSpy).not.toHaveBeenCalled();
    });

    it("should preserve error type when strategies fail", async () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "CustomError";
        }
      }

      class FailingStrategy implements WorkerStrategy {
        name = "failing-strategy";

        async *execute(): AsyncIterableIterator<any> {
          // biome-ignore lint/correctness/noConstantCondition: test code needs to satisfy generator requirements
          if (false) yield undefined;
          throw new CustomError("Custom failure");
        }
      }

      const failingStrategy = new FailingStrategy();
      selector.register(failingStrategy);

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["failing-strategy"],
      };

      await expect(
        (async () => {
          for await (const _record of selector.execute(
            "input",
            undefined,
            mockSession,
            mockEngineConfig,
            execOptions,
          )) {
            // Should not reach here
          }
        })(),
      ).rejects.toThrow(CustomError);
    });

    it("should handle non-Error thrown values", async () => {
      class ThrowingStrategy implements WorkerStrategy {
        name = "throwing-strategy";

        async *execute(): AsyncIterableIterator<any> {
          // biome-ignore lint/correctness/noConstantCondition: test code needs to satisfy generator requirements
          if (false) yield undefined;
          throw "String error";
        }
      }

      const throwingStrategy = new ThrowingStrategy();
      const successStrategy = new MockStrategy("success-strategy");
      selector.register(throwingStrategy);
      selector.register(successStrategy);

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["throwing-strategy", "success-strategy"],
      };

      const records = [];
      for await (const record of selector.execute(
        "input",
        undefined,
        mockSession,
        mockEngineConfig,
        execOptions,
      )) {
        records.push(record);
      }

      expect(records).toEqual([
        { strategy: "success-strategy", success: true },
      ]);
      expect(onFallbackSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'Strategy "throwing-strategy" failed: String error',
          error: expect.any(Error),
        }),
      );
    });
  });

  describe("legacy execution path (without preferredStrategies)", () => {
    it("should use legacy path when preferredStrategies is not provided", async () => {
      const streamTransferStrategy = new MockStrategy("stream-transfer");
      selector.register(streamTransferStrategy);

      const records = [];
      for await (const record of selector.execute(
        "input",
        undefined,
        mockSession,
        mockEngineConfig,
        undefined, // No execOptions
      )) {
        records.push(record);
      }

      expect(records).toEqual([{ strategy: "stream-transfer", success: true }]);
    });

    it("should use legacy path when preferredStrategies is empty", async () => {
      const messageStreamingStrategy = new MockStrategy("message-streaming");
      selector.register(messageStreamingStrategy);

      (mockEngineConfig.hasStreamTransfer as Mock).mockReturnValue(false);

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: [], // Empty array
      };

      const records = [];
      for await (const record of selector.execute(
        "input",
        undefined,
        mockSession,
        mockEngineConfig,
        execOptions,
      )) {
        records.push(record);
      }

      expect(records).toEqual([
        { strategy: "message-streaming", success: true },
      ]);
    });
  });

  describe("integration with real strategies", () => {
    it("should work with strategy priority order", async () => {
      const executionOrder: string[] = [];

      class TrackingStrategy implements WorkerStrategy {
        constructor(
          public name: string,
          private shouldFail = false,
        ) {}

        async *execute(): AsyncIterableIterator<any> {
          executionOrder.push(this.name);
          if (this.shouldFail) {
            throw new Error(`${this.name} failed`);
          }
          yield { strategy: this.name };
        }
      }

      const high = new TrackingStrategy("high-priority", true);
      const medium = new TrackingStrategy("medium-priority", true);
      const low = new TrackingStrategy("low-priority", false);

      selector.register(high);
      selector.register(medium);
      selector.register(low);

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: [
          "high-priority",
          "medium-priority",
          "low-priority",
        ],
      };

      const records = [];
      for await (const record of selector.execute(
        "input",
        undefined,
        mockSession,
        mockEngineConfig,
        execOptions,
      )) {
        records.push(record);
      }

      expect(executionOrder).toEqual([
        "high-priority",
        "medium-priority",
        "low-priority",
      ]);
      expect(records).toEqual([{ strategy: "low-priority" }]);
      expect(onFallbackSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("edge cases", () => {
    it("should handle single strategy in preferredStrategies", async () => {
      const singleStrategy = new MockStrategy("single");
      selector.register(singleStrategy);

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["single"],
      };

      const records = [];
      for await (const record of selector.execute(
        "input",
        undefined,
        mockSession,
        mockEngineConfig,
        execOptions,
      )) {
        records.push(record);
      }

      expect(records).toEqual([{ strategy: "single", success: true }]);
    });

    it("should handle duplicate strategies in preferredStrategies", async () => {
      const strategy = new MockStrategy("duplicate");
      selector.register(strategy);

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["duplicate", "duplicate"],
      };

      const records = [];
      for await (const record of selector.execute(
        "input",
        undefined,
        mockSession,
        mockEngineConfig,
        execOptions,
      )) {
        records.push(record);
      }

      // Should succeed on first attempt
      expect(records).toEqual([{ strategy: "duplicate", success: true }]);
    });

    it("should handle mixed valid and invalid strategy names", async () => {
      const validStrategy = new MockStrategy("valid");
      selector.register(validStrategy);

      const execOptions: StrategyExecutionOptions = {
        preferredStrategies: ["invalid-1", "invalid-2", "valid", "invalid-3"],
      };

      const records = [];
      for await (const record of selector.execute(
        "input",
        undefined,
        mockSession,
        mockEngineConfig,
        execOptions,
      )) {
        records.push(record);
      }

      expect(records).toEqual([{ strategy: "valid", success: true }]);
    });
  });
});
