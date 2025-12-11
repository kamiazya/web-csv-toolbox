import { describe, expect, it } from "vitest";
import type { ContextType } from "@/execution/ExecutionPlan.ts";
import {
  contextsToPreferredStrategies,
  type WorkerStrategyName,
} from "@/execution/utils/contextToStrategy.ts";

describe("contextsToPreferredStrategies", () => {
  it("should convert worker-stream-transfer to stream-transfer", () => {
    const contexts: ContextType[] = ["worker-stream-transfer"];
    const result = contextsToPreferredStrategies(contexts);
    expect(result).toEqual(["stream-transfer"]);
  });

  it("should convert worker-message to message-streaming", () => {
    const contexts: ContextType[] = ["worker-message"];
    const result = contextsToPreferredStrategies(contexts);
    expect(result).toEqual(["message-streaming"]);
  });

  it("should filter out main context", () => {
    const contexts: ContextType[] = ["main", "worker-stream-transfer"];
    const result = contextsToPreferredStrategies(contexts);
    expect(result).toEqual(["stream-transfer"]);
  });

  it("should preserve order after filtering and mapping", () => {
    const contexts: ContextType[] = [
      "worker-stream-transfer",
      "worker-message",
      "main",
    ];
    const result = contextsToPreferredStrategies(contexts);
    expect(result).toEqual(["stream-transfer", "message-streaming"]);
  });

  it("should return empty array for main-only contexts", () => {
    const contexts: ContextType[] = ["main"];
    const result = contextsToPreferredStrategies(contexts);
    expect(result).toEqual([]);
  });

  it("should return empty array for empty input", () => {
    const contexts: ContextType[] = [];
    const result = contextsToPreferredStrategies(contexts);
    expect(result).toEqual([]);
  });

  it("should handle all context types", () => {
    const contexts: ContextType[] = [
      "main",
      "worker-stream-transfer",
      "worker-message",
    ];
    const result = contextsToPreferredStrategies(contexts);
    expect(result).toHaveLength(2);
    expect(result).toContain("stream-transfer");
    expect(result).toContain("message-streaming");
  });

  it("should return correct type", () => {
    const contexts: ContextType[] = ["worker-stream-transfer"];
    const result: WorkerStrategyName[] =
      contextsToPreferredStrategies(contexts);
    expect(result).toBeDefined();
  });
});
