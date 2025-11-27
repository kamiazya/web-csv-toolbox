import { describe, expect, it, vi } from "vitest";
import type { CSVRecord } from "@/core/types.ts";
import type { WorkerContext } from "../helpers/worker.shared.ts";
import {
  MainThreadStrategy,
  MessagePortStrategy,
  type OutputStrategy,
  streamRecords,
} from "./outputStrategy.ts";

// Create mock WorkerContext
function createMockWorkerContext(): WorkerContext<readonly string[]> & {
  messages: unknown[];
} {
  const messages: unknown[] = [];
  return {
    postMessage: vi.fn((msg) => messages.push(msg)),
    messages,
  } as unknown as WorkerContext<readonly string[]> & { messages: unknown[] };
}

// Create mock MessagePort
function createMockMessagePort(): MessagePort & { messages: unknown[] } {
  const messages: unknown[] = [];
  return {
    postMessage: vi.fn((msg) => messages.push(msg)),
    start: vi.fn(),
    close: vi.fn(),
    onmessage: null,
    onmessageerror: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    messages,
  } as unknown as MessagePort & { messages: unknown[] };
}

describe("MainThreadStrategy", () => {
  describe("sendRecord", () => {
    it("should send record message with correct format", () => {
      const context = createMockWorkerContext();
      const strategy = new MainThreadStrategy(context, 1);
      const record: CSVRecord = { name: "Alice", age: "30" };

      strategy.sendRecord(record);

      expect(context.postMessage).toHaveBeenCalledOnce();
      expect(context.messages[0]).toEqual({
        id: 1,
        type: "record",
        record: { name: "Alice", age: "30" },
      });
    });

    it("should send multiple records with same request id", () => {
      const context = createMockWorkerContext();
      const strategy = new MainThreadStrategy(context, 42);

      strategy.sendRecord({ name: "Alice" });
      strategy.sendRecord({ name: "Bob" });
      strategy.sendRecord({ name: "Charlie" });

      expect(context.messages).toHaveLength(3);
      expect(context.messages.map((m: any) => m.id)).toEqual([42, 42, 42]);
      expect(context.messages.map((m: any) => m.type)).toEqual([
        "record",
        "record",
        "record",
      ]);
    });

    it("should handle complex record", () => {
      const context = createMockWorkerContext();
      const strategy = new MainThreadStrategy(context, 1);
      const record: CSVRecord = {
        "column with spaces": "value1",
        "column,with,commas": "value2",
        normalColumn: "value3",
      };

      strategy.sendRecord(record);

      expect((context.messages[0] as any).record).toEqual(record);
    });
  });

  describe("sendDone", () => {
    it("should send done message with correct format", () => {
      const context = createMockWorkerContext();
      const strategy = new MainThreadStrategy(context, 1);

      strategy.sendDone();

      expect(context.postMessage).toHaveBeenCalledOnce();
      expect(context.messages[0]).toEqual({
        id: 1,
        type: "done",
      });
    });
  });

  describe("sendError", () => {
    it("should send error message with correct format", () => {
      const context = createMockWorkerContext();
      const strategy = new MainThreadStrategy(context, 1);

      strategy.sendError("Parse error occurred");

      expect(context.postMessage).toHaveBeenCalledOnce();
      expect(context.messages[0]).toEqual({
        id: 1,
        type: "error",
        error: "Parse error occurred",
      });
    });
  });

  describe("Request ID handling", () => {
    it("should use provided request ID for all messages", () => {
      const context = createMockWorkerContext();
      const strategy = new MainThreadStrategy(context, 12345);

      strategy.sendRecord({ name: "test" });
      strategy.sendDone();

      expect(context.messages).toHaveLength(2);
      expect((context.messages[0] as any).id).toBe(12345);
      expect((context.messages[1] as any).id).toBe(12345);
    });

    it("should handle request ID 0", () => {
      const context = createMockWorkerContext();
      const strategy = new MainThreadStrategy(context, 0);

      strategy.sendRecord({ name: "test" });

      expect((context.messages[0] as any).id).toBe(0);
    });
  });
});

describe("MessagePortStrategy", () => {
  describe("sendRecord", () => {
    it("should send record message to port", () => {
      const port = createMockMessagePort();
      const strategy = new MessagePortStrategy(port);
      const record: CSVRecord = { name: "Alice", age: "30" };

      strategy.sendRecord(record);

      expect(port.postMessage).toHaveBeenCalledOnce();
      expect(port.messages[0]).toEqual({
        type: "record",
        record: { name: "Alice", age: "30" },
      });
    });

    it("should send multiple records", () => {
      const port = createMockMessagePort();
      const strategy = new MessagePortStrategy(port);

      strategy.sendRecord({ name: "Alice" });
      strategy.sendRecord({ name: "Bob" });

      expect(port.messages).toHaveLength(2);
      expect(port.messages.map((m: any) => m.record.name)).toEqual([
        "Alice",
        "Bob",
      ]);
    });

    it("should not include request ID (simplified format)", () => {
      const port = createMockMessagePort();
      const strategy = new MessagePortStrategy(port);

      strategy.sendRecord({ name: "test" });

      expect(port.messages[0]).not.toHaveProperty("id");
    });
  });

  describe("sendDone", () => {
    it("should send done message to port", () => {
      const port = createMockMessagePort();
      const strategy = new MessagePortStrategy(port);

      strategy.sendDone();

      expect(port.postMessage).toHaveBeenCalledOnce();
      expect(port.messages[0]).toEqual({ type: "done" });
    });
  });

  describe("sendError", () => {
    it("should send error message to port", () => {
      const port = createMockMessagePort();
      const strategy = new MessagePortStrategy(port);

      strategy.sendError("Connection lost");

      expect(port.postMessage).toHaveBeenCalledOnce();
      expect(port.messages[0]).toEqual({
        type: "error",
        error: "Connection lost",
      });
    });
  });
});

describe("streamRecords", () => {
  // Create mock OutputStrategy
  function createMockStrategy(): OutputStrategy & {
    records: CSVRecord[];
    doneCount: number;
    errors: string[];
  } {
    const records: CSVRecord[] = [];
    const errors: string[] = [];
    let doneCount = 0;

    return {
      sendRecord: vi.fn((record) => records.push(record)),
      sendDone: vi.fn(() => doneCount++),
      sendError: vi.fn((error) => errors.push(error)),
      records,
      get doneCount() {
        return doneCount;
      },
      errors,
    };
  }

  describe("Sync iterable", () => {
    it("should stream records from array", async () => {
      const strategy = createMockStrategy();
      const records: CSVRecord[] = [{ name: "Alice" }, { name: "Bob" }];

      await streamRecords(strategy, records);

      expect(strategy.records).toEqual(records);
      expect(strategy.doneCount).toBe(1);
      expect(strategy.errors).toHaveLength(0);
    });

    it("should call sendDone after all records", async () => {
      const strategy = createMockStrategy();

      await streamRecords(strategy, [{ id: "1" }, { id: "2" }]);

      // Verify call order
      expect(strategy.sendRecord).toHaveBeenCalledTimes(2);
      expect(strategy.sendDone).toHaveBeenCalledTimes(1);
    });

    it("should handle empty array", async () => {
      const strategy = createMockStrategy();

      await streamRecords(strategy, []);

      expect(strategy.records).toHaveLength(0);
      expect(strategy.doneCount).toBe(1);
    });
  });

  describe("Async iterable", () => {
    it("should stream records from async generator", async () => {
      const strategy = createMockStrategy();

      async function* generateRecords(): AsyncIterableIterator<CSVRecord> {
        yield { name: "Alice" };
        yield { name: "Bob" };
        yield { name: "Charlie" };
      }

      await streamRecords(strategy, generateRecords());

      expect(strategy.records).toHaveLength(3);
      expect(strategy.records.map((r) => r.name)).toEqual([
        "Alice",
        "Bob",
        "Charlie",
      ]);
      expect(strategy.doneCount).toBe(1);
    });

    it("should handle async generator that yields no records", async () => {
      const strategy = createMockStrategy();

      async function* emptyGenerator(): AsyncIterableIterator<CSVRecord> {
        // Yields nothing
      }

      await streamRecords(strategy, emptyGenerator());

      expect(strategy.records).toHaveLength(0);
      expect(strategy.doneCount).toBe(1);
    });

    it("should handle delayed yields", async () => {
      const strategy = createMockStrategy();

      async function* delayedGenerator(): AsyncIterableIterator<CSVRecord> {
        yield { id: "1" };
        await new Promise((resolve) => setTimeout(resolve, 10));
        yield { id: "2" };
      }

      await streamRecords(strategy, delayedGenerator());

      expect(strategy.records).toHaveLength(2);
      expect(strategy.doneCount).toBe(1);
    });
  });

  describe("Error handling", () => {
    it("should send error message when iterator throws Error", async () => {
      const strategy = createMockStrategy();

      async function* errorGenerator(): AsyncIterableIterator<CSVRecord> {
        yield { name: "Alice" };
        throw new Error("Parse failed");
      }

      await streamRecords(strategy, errorGenerator());

      expect(strategy.records).toHaveLength(1);
      expect(strategy.doneCount).toBe(0);
      expect(strategy.errors).toEqual(["Parse failed"]);
    });

    it("should convert non-Error to string", async () => {
      const strategy = createMockStrategy();

      async function* errorGenerator(): AsyncIterableIterator<CSVRecord> {
        throw "String error";
      }

      await streamRecords(strategy, errorGenerator());

      expect(strategy.errors).toEqual(["String error"]);
    });

    it("should handle error at start of iteration", async () => {
      const strategy = createMockStrategy();

      async function* immediateError(): AsyncIterableIterator<CSVRecord> {
        throw new Error("Immediate failure");
      }

      await streamRecords(strategy, immediateError());

      expect(strategy.records).toHaveLength(0);
      expect(strategy.errors).toEqual(["Immediate failure"]);
    });
  });

  describe("Integration", () => {
    it("should work with MainThreadStrategy", async () => {
      const context = createMockWorkerContext();
      const strategy = new MainThreadStrategy(context, 1);

      await streamRecords(strategy, [{ a: "1" }, { a: "2" }]);

      expect(context.messages).toHaveLength(3);
      expect((context.messages[0] as any).type).toBe("record");
      expect((context.messages[1] as any).type).toBe("record");
      expect((context.messages[2] as any).type).toBe("done");
    });

    it("should work with MessagePortStrategy", async () => {
      const port = createMockMessagePort();
      const strategy = new MessagePortStrategy(port);

      await streamRecords(strategy, [{ b: "1" }]);

      expect(port.messages).toHaveLength(2);
      expect((port.messages[0] as any).type).toBe("record");
      expect((port.messages[1] as any).type).toBe("done");
    });
  });
});
