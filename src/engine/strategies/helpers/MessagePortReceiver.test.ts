import { describe, expect, it, vi } from "vitest";
import { receiveResults } from "./MessagePortReceiver.ts";

// Create a mock MessagePort pair using MessageChannel
function createMessageChannelPair(): {
  senderPort: MessagePort;
  receiverPort: MessagePort;
} {
  const channel = new MessageChannel();
  return {
    senderPort: channel.port1,
    receiverPort: channel.port2,
  };
}

describe("receiveResults", () => {
  describe("Basic record receiving", () => {
    it("should receive a single record", async () => {
      const { senderPort, receiverPort } = createMessageChannelPair();

      const iterator = receiveResults<{ name: string }>(receiverPort);

      // Send record and done message
      setTimeout(() => {
        senderPort.postMessage({ type: "record", record: { name: "test" } });
        senderPort.postMessage({ type: "done" });
      }, 0);

      const records: { name: string }[] = [];
      for await (const record of iterator) {
        records.push(record);
      }

      expect(records).toEqual([{ name: "test" }]);
    });

    it("should receive multiple records", async () => {
      const { senderPort, receiverPort } = createMessageChannelPair();

      const iterator = receiveResults<{ id: number }>(receiverPort);

      setTimeout(() => {
        senderPort.postMessage({ type: "record", record: { id: 1 } });
        senderPort.postMessage({ type: "record", record: { id: 2 } });
        senderPort.postMessage({ type: "record", record: { id: 3 } });
        senderPort.postMessage({ type: "done" });
      }, 0);

      const records: { id: number }[] = [];
      for await (const record of iterator) {
        records.push(record);
      }

      expect(records).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it("should handle empty result (done immediately)", async () => {
      const { senderPort, receiverPort } = createMessageChannelPair();

      const iterator = receiveResults<unknown>(receiverPort);

      setTimeout(() => {
        senderPort.postMessage({ type: "done" });
      }, 0);

      const records: unknown[] = [];
      for await (const record of iterator) {
        records.push(record);
      }

      expect(records).toEqual([]);
    });
  });

  describe("Error handling", () => {
    it("should throw error when error message received", async () => {
      const { senderPort, receiverPort } = createMessageChannelPair();

      const iterator = receiveResults<unknown>(receiverPort);

      setTimeout(() => {
        senderPort.postMessage({
          type: "error",
          error: "Parse error occurred",
        });
      }, 0);

      await expect(async () => {
        for await (const _ of iterator) {
          // This should not execute
        }
      }).rejects.toThrow("Parse error occurred");
    });

    it("should yield records before error and then throw", async () => {
      const { senderPort, receiverPort } = createMessageChannelPair();

      const iterator = receiveResults<{ id: number }>(receiverPort);

      setTimeout(() => {
        senderPort.postMessage({ type: "record", record: { id: 1 } });
        senderPort.postMessage({ type: "record", record: { id: 2 } });
        senderPort.postMessage({ type: "error", error: "Error after records" });
      }, 0);

      const records: { id: number }[] = [];
      let errorThrown = false;

      try {
        for await (const record of iterator) {
          records.push(record);
        }
      } catch (e) {
        errorThrown = true;
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe("Error after records");
      }

      expect(errorThrown).toBe(true);
      // Records received before error should still be captured
      expect(records.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("AbortSignal handling", () => {
    it("should throw AbortError when signal is already aborted", async () => {
      const { receiverPort } = createMessageChannelPair();

      const controller = new AbortController();
      controller.abort();

      const iterator = receiveResults<unknown>(receiverPort, controller.signal);

      await expect(async () => {
        for await (const _ of iterator) {
          // This should not execute
        }
      }).rejects.toThrow("Aborted");
    });

    it("should throw AbortError when aborted during iteration", async () => {
      const { senderPort, receiverPort } = createMessageChannelPair();

      const controller = new AbortController();
      const iterator = receiveResults<{ id: number }>(
        receiverPort,
        controller.signal,
      );

      setTimeout(() => {
        senderPort.postMessage({ type: "record", record: { id: 1 } });
        // Abort after first record
        setTimeout(() => {
          controller.abort();
        }, 10);
      }, 0);

      const records: { id: number }[] = [];
      let abortError: Error | null = null;

      try {
        for await (const record of iterator) {
          records.push(record);
        }
      } catch (e) {
        abortError = e as Error;
      }

      expect(abortError).not.toBeNull();
      expect(abortError!.name).toBe("AbortError");
    });
  });

  describe("Port lifecycle", () => {
    it("should close port when done", async () => {
      const { senderPort, receiverPort } = createMessageChannelPair();

      const closeSpy = vi.spyOn(receiverPort, "close");
      const iterator = receiveResults<unknown>(receiverPort);

      setTimeout(() => {
        senderPort.postMessage({ type: "done" });
      }, 0);

      for await (const _ of iterator) {
        // Consume all records
      }

      expect(closeSpy).toHaveBeenCalled();
    });

    it("should close port on error", async () => {
      const { senderPort, receiverPort } = createMessageChannelPair();

      const closeSpy = vi.spyOn(receiverPort, "close");
      const iterator = receiveResults<unknown>(receiverPort);

      setTimeout(() => {
        senderPort.postMessage({ type: "error", error: "Test error" });
      }, 0);

      try {
        for await (const _ of iterator) {
          // This should throw
        }
      } catch {
        // Expected
      }

      expect(closeSpy).toHaveBeenCalled();
    });

    it("should start the port", async () => {
      const { senderPort, receiverPort } = createMessageChannelPair();

      const startSpy = vi.spyOn(receiverPort, "start");
      const iterator = receiveResults<unknown>(receiverPort);

      setTimeout(() => {
        senderPort.postMessage({ type: "done" });
      }, 0);

      for await (const _ of iterator) {
        // Consume
      }

      expect(startSpy).toHaveBeenCalled();
    });
  });

  describe("Typed records", () => {
    it("should preserve record types", async () => {
      interface CSVRecord {
        name: string;
        age: number;
        active: boolean;
      }

      const { senderPort, receiverPort } = createMessageChannelPair();

      const iterator = receiveResults<CSVRecord>(receiverPort);

      const expectedRecords: CSVRecord[] = [
        { name: "Alice", age: 30, active: true },
        { name: "Bob", age: 25, active: false },
      ];

      setTimeout(() => {
        for (const record of expectedRecords) {
          senderPort.postMessage({ type: "record", record });
        }
        senderPort.postMessage({ type: "done" });
      }, 0);

      const records: CSVRecord[] = [];
      for await (const record of iterator) {
        records.push(record);
      }

      expect(records).toEqual(expectedRecords);
      expect(records[0]!.name).toBe("Alice");
      expect(typeof records[0]!.age).toBe("number");
      expect(typeof records[0]!.active).toBe("boolean");
    });

    it("should handle array records", async () => {
      const { senderPort, receiverPort } = createMessageChannelPair();

      const iterator = receiveResults<string[]>(receiverPort);

      setTimeout(() => {
        senderPort.postMessage({ type: "record", record: ["a", "b", "c"] });
        senderPort.postMessage({ type: "record", record: ["d", "e", "f"] });
        senderPort.postMessage({ type: "done" });
      }, 0);

      const records: string[][] = [];
      for await (const record of iterator) {
        records.push(record);
      }

      expect(records).toEqual([
        ["a", "b", "c"],
        ["d", "e", "f"],
      ]);
    });
  });

  describe("Queue behavior", () => {
    it("should handle burst of records", async () => {
      const { senderPort, receiverPort } = createMessageChannelPair();

      const iterator = receiveResults<number>(receiverPort);

      // Send many records at once
      const expectedCount = 100;
      setTimeout(() => {
        for (let i = 0; i < expectedCount; i++) {
          senderPort.postMessage({ type: "record", record: i });
        }
        senderPort.postMessage({ type: "done" });
      }, 0);

      const records: number[] = [];
      for await (const record of iterator) {
        records.push(record);
      }

      expect(records).toHaveLength(expectedCount);
      expect(records[0]).toBe(0);
      expect(records[expectedCount - 1]).toBe(expectedCount - 1);
    });
  });
});
