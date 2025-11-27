import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendWorkerMessage, type WorkerMessage } from "./messageHandler.ts";

// Mock worker utilities
vi.mock("@/worker/utils/workerUtils.ts", () => ({
  addListener: vi.fn((target, type, handler) => {
    target.addEventListener(type, handler);
  }),
  removeListener: vi.fn((target, type, handler) => {
    target.removeEventListener(type, handler);
  }),
}));

// Mock ErrorEvent for Node.js environment
class MockErrorEvent extends Event {
  message: string;
  constructor(type: string, options: { message: string }) {
    super(type);
    this.message = options.message;
  }
}

// Create mock worker with event simulation
function createMockWorker(): Worker & {
  postMessage: ReturnType<typeof vi.fn>;
  simulateMessage: (data: unknown) => void;
  simulateError: (message: string) => void;
} {
  const handlers: Map<string, Set<EventListener>> = new Map();

  const worker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener(type: string, handler: EventListener) {
      if (!handlers.has(type)) {
        handlers.set(type, new Set());
      }
      handlers.get(type)!.add(handler);
    },
    removeEventListener(type: string, handler: EventListener) {
      handlers.get(type)?.delete(handler);
    },
    dispatchEvent: vi.fn(),
    onmessage: null,
    onmessageerror: null,
    onerror: null,
    simulateMessage(data: unknown) {
      const event = new MessageEvent("message", { data });
      handlers.get("message")?.forEach((h) => h(event));
    },
    simulateError(message: string) {
      const event = new MockErrorEvent("error", { message });
      handlers.get("error")?.forEach((h) => h(event as any));
    },
  };

  return worker as any;
}

describe("sendWorkerMessage", () => {
  let worker: ReturnType<typeof createMockWorker>;

  beforeEach(() => {
    worker = createMockWorker();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic message sending", () => {
    it("should send message to worker", async () => {
      const message: WorkerMessage = {
        id: 1,
        type: "parseString",
        data: "test",
      };

      const iterator = sendWorkerMessage(worker, message);

      // Start iteration (this triggers the postMessage)
      const resultPromise = iterator.next();

      // Simulate response
      setTimeout(() => {
        worker.simulateMessage({ id: 1, type: "done" });
      }, 0);

      await resultPromise;

      expect(worker.postMessage).toHaveBeenCalledWith(message);
    });

    it("should send message with transfer list", async () => {
      const message: WorkerMessage = {
        id: 1,
        type: "parseStream",
        data: "test",
      };
      const transfer: Transferable[] = [new ArrayBuffer(8)];

      const iterator = sendWorkerMessage(worker, message, undefined, transfer);
      const resultPromise = iterator.next();

      setTimeout(() => {
        worker.simulateMessage({ id: 1, type: "done" });
      }, 0);

      await resultPromise;

      expect(worker.postMessage).toHaveBeenCalledWith(message, transfer);
    });
  });

  describe("Record receiving", () => {
    it("should yield single record", async () => {
      const message: WorkerMessage = {
        id: 1,
        type: "parseString",
        data: "test",
      };

      const iterator = sendWorkerMessage<{ name: string }>(worker, message);

      setTimeout(() => {
        worker.simulateMessage({
          id: 1,
          type: "record",
          record: { name: "Alice" },
        });
        worker.simulateMessage({ id: 1, type: "done" });
      }, 0);

      const records: { name: string }[] = [];
      for await (const record of { [Symbol.asyncIterator]: () => iterator }) {
        records.push(record);
      }

      expect(records).toEqual([{ name: "Alice" }]);
    });

    it("should yield multiple records", async () => {
      const message: WorkerMessage = {
        id: 1,
        type: "parseString",
        data: "test",
      };

      const iterator = sendWorkerMessage<{ id: number }>(worker, message);

      setTimeout(() => {
        worker.simulateMessage({ id: 1, type: "record", record: { id: 1 } });
        setTimeout(() => {
          worker.simulateMessage({ id: 1, type: "record", record: { id: 2 } });
          setTimeout(() => {
            worker.simulateMessage({
              id: 1,
              type: "record",
              record: { id: 3 },
            });
            worker.simulateMessage({ id: 1, type: "done" });
          }, 0);
        }, 0);
      }, 0);

      const records: { id: number }[] = [];
      for await (const record of { [Symbol.asyncIterator]: () => iterator }) {
        records.push(record);
      }

      expect(records).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it("should handle empty result (done immediately)", async () => {
      const message: WorkerMessage = {
        id: 1,
        type: "parseString",
        data: "",
      };

      const iterator = sendWorkerMessage(worker, message);

      setTimeout(() => {
        worker.simulateMessage({ id: 1, type: "done" });
      }, 0);

      const records: unknown[] = [];
      for await (const record of { [Symbol.asyncIterator]: () => iterator }) {
        records.push(record);
      }

      expect(records).toHaveLength(0);
    });
  });

  describe("Request ID filtering", () => {
    it("should ignore messages with different ID", async () => {
      const message: WorkerMessage = {
        id: 42,
        type: "parseString",
        data: "test",
      };

      const iterator = sendWorkerMessage<{ name: string }>(worker, message);

      setTimeout(() => {
        // Wrong ID - should be ignored
        worker.simulateMessage({
          id: 99,
          type: "record",
          record: { name: "Wrong" },
        });
        // Correct ID
        worker.simulateMessage({
          id: 42,
          type: "record",
          record: { name: "Right" },
        });
        worker.simulateMessage({ id: 42, type: "done" });
      }, 0);

      const records: { name: string }[] = [];
      for await (const record of { [Symbol.asyncIterator]: () => iterator }) {
        records.push(record);
      }

      expect(records).toEqual([{ name: "Right" }]);
    });
  });

  describe("Error handling", () => {
    it("should throw error when error message received", async () => {
      const message: WorkerMessage = {
        id: 1,
        type: "parseString",
        data: "test",
      };

      const iterator = sendWorkerMessage(worker, message);

      setTimeout(() => {
        worker.simulateMessage({ id: 1, type: "error", error: "Parse failed" });
      }, 0);

      await expect(async () => {
        for await (const _ of { [Symbol.asyncIterator]: () => iterator }) {
          // This should throw
        }
      }).rejects.toThrow("Parse failed");
    });

    it("should throw error on worker error event", async () => {
      const message: WorkerMessage = {
        id: 1,
        type: "parseString",
        data: "test",
      };

      const iterator = sendWorkerMessage(worker, message);

      setTimeout(() => {
        worker.simulateError("Worker crashed");
      }, 0);

      await expect(async () => {
        for await (const _ of { [Symbol.asyncIterator]: () => iterator }) {
          // This should throw
        }
      }).rejects.toThrow("Worker crashed");
    });
  });

  describe("AbortSignal handling", () => {
    it("should throw AbortError when signal is already aborted", async () => {
      const message: WorkerMessage = {
        id: 1,
        type: "parseString",
        data: "test",
      };

      const controller = new AbortController();
      controller.abort();

      const iterator = sendWorkerMessage(worker, message, {
        signal: controller.signal,
      });

      await expect(async () => {
        for await (const _ of { [Symbol.asyncIterator]: () => iterator }) {
          // This should throw immediately
        }
      }).rejects.toThrow("Aborted");
    });

    it("should throw AbortError when aborted during iteration", async () => {
      const message: WorkerMessage = {
        id: 1,
        type: "parseString",
        data: "test",
      };

      const controller = new AbortController();
      const iterator = sendWorkerMessage<{ name: string }>(worker, message, {
        signal: controller.signal,
      });

      setTimeout(() => {
        worker.simulateMessage({
          id: 1,
          type: "record",
          record: { name: "Alice" },
        });
        // Abort after first record
        setTimeout(() => {
          controller.abort();
        }, 5);
      }, 0);

      const records: { name: string }[] = [];
      let abortError: Error | null = null;

      try {
        for await (const record of { [Symbol.asyncIterator]: () => iterator }) {
          records.push(record);
        }
      } catch (e) {
        abortError = e as Error;
      }

      expect(abortError).not.toBeNull();
      expect(abortError!.name).toBe("AbortError");
    });

    it("should send abort message to worker when aborted", async () => {
      const message: WorkerMessage = {
        id: 42,
        type: "parseString",
        data: "test",
      };

      const controller = new AbortController();
      const iterator = sendWorkerMessage(worker, message, {
        signal: controller.signal,
      });

      // Start iteration
      const nextPromise = iterator.next();

      // Abort after a short delay
      setTimeout(() => {
        controller.abort();
      }, 10);

      // Wait for result
      await nextPromise.catch(() => {}); // Ignore AbortError

      // Check that abort message was sent
      expect(worker.postMessage).toHaveBeenCalledWith({
        id: 42,
        type: "abort",
      });
    });
  });

  describe("Cleanup", () => {
    it("should clean up listeners on completion", async () => {
      const { removeListener } = await import("@/worker/utils/workerUtils.ts");
      const mockRemoveListener = vi.mocked(removeListener);

      const message: WorkerMessage = {
        id: 1,
        type: "parseString",
        data: "test",
      };

      const iterator = sendWorkerMessage(worker, message);

      setTimeout(() => {
        worker.simulateMessage({ id: 1, type: "done" });
      }, 0);

      for await (const _ of { [Symbol.asyncIterator]: () => iterator }) {
        // Consume
      }

      expect(mockRemoveListener).toHaveBeenCalled();
    });

    it("should clean up listeners on error", async () => {
      const { removeListener } = await import("@/worker/utils/workerUtils.ts");
      const mockRemoveListener = vi.mocked(removeListener);

      const message: WorkerMessage = {
        id: 1,
        type: "parseString",
        data: "test",
      };

      const iterator = sendWorkerMessage(worker, message);

      setTimeout(() => {
        worker.simulateMessage({ id: 1, type: "error", error: "Test error" });
      }, 0);

      try {
        for await (const _ of { [Symbol.asyncIterator]: () => iterator }) {
          // Should throw
        }
      } catch {
        // Expected
      }

      expect(mockRemoveListener).toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("should handle postMessage throwing error", async () => {
      const message: WorkerMessage = {
        id: 1,
        type: "parseString",
        data: "test",
      };

      worker.postMessage.mockImplementation(() => {
        throw new Error("Failed to post message");
      });

      const iterator = sendWorkerMessage(worker, message);

      await expect(async () => {
        for await (const _ of { [Symbol.asyncIterator]: () => iterator }) {
          // Should throw
        }
      }).rejects.toThrow("Failed to post message");
    });

    it("should handle multiple iterations being forbidden", async () => {
      const message: WorkerMessage = {
        id: 1,
        type: "parseString",
        data: "test",
      };

      const iterator = sendWorkerMessage<{ name: string }>(worker, message);

      setTimeout(() => {
        worker.simulateMessage({
          id: 1,
          type: "record",
          record: { name: "Alice" },
        });
        worker.simulateMessage({ id: 1, type: "done" });
      }, 0);

      // First iteration
      const records: { name: string }[] = [];
      for await (const record of { [Symbol.asyncIterator]: () => iterator }) {
        records.push(record);
      }

      expect(records).toHaveLength(1);
    });
  });
});
