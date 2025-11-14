import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMessageHandler,
  type ParseBinaryRequest,
  type ParseStringRequest,
  type ParseStringStreamRequest,
  type ParseUint8ArrayStreamRequest,
  streamRecordsToMain,
  streamRecordsToPort,
  type WorkerContext,
} from "@/worker/helpers/worker.shared.ts";

describe("worker.shared", () => {
  describe("streamRecordsToMain", () => {
    it("should stream records and send done signal", async () => {
      const messages: any[] = [];
      const mockContext: WorkerContext = {
        postMessage: vi.fn((msg) => messages.push(msg)),
      };

      const records = [
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ];

      await streamRecordsToMain(mockContext, 1, records);

      expect(messages).toHaveLength(3);
      expect(messages[0]).toEqual({
        id: 1,
        type: "record",
        record: { name: "Alice", age: "30" },
      });
      expect(messages[1]).toEqual({
        id: 1,
        type: "record",
        record: { name: "Bob", age: "25" },
      });
      expect(messages[2]).toEqual({
        id: 1,
        type: "done",
      });
    });

    it("should handle errors and send error signal", async () => {
      const messages: any[] = [];
      const mockContext: WorkerContext = {
        postMessage: vi.fn((msg) => messages.push(msg)),
      };

      async function* failingIterator() {
        yield { name: "Alice", age: "30" };
        throw new Error("Parse error");
      }

      await streamRecordsToMain(mockContext, 1, failingIterator());

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({
        id: 1,
        type: "record",
        record: { name: "Alice", age: "30" },
      });
      expect(messages[1]).toEqual({
        id: 1,
        type: "error",
        error: "Parse error",
      });
    });
  });

  describe("streamRecordsToPort", () => {
    it("should stream records to MessagePort and send done signal", async () => {
      const messages: any[] = [];
      const mockPort = {
        postMessage: vi.fn((msg) => messages.push(msg)),
      } as unknown as MessagePort;

      const records = [
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ];

      await streamRecordsToPort(mockPort, records);

      expect(messages).toHaveLength(3);
      expect(messages[0]).toEqual({
        type: "record",
        record: { name: "Alice", age: "30" },
      });
      expect(messages[1]).toEqual({
        type: "record",
        record: { name: "Bob", age: "25" },
      });
      expect(messages[2]).toEqual({
        type: "done",
      });
    });

    it("should handle errors and send error signal", async () => {
      const messages: any[] = [];
      const mockPort = {
        postMessage: vi.fn((msg) => messages.push(msg)),
      } as unknown as MessagePort;

      async function* failingIterator() {
        yield { name: "Alice", age: "30" };
        throw new Error("Parse error");
      }

      await streamRecordsToPort(mockPort, failingIterator());

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({
        type: "record",
        record: { name: "Alice", age: "30" },
      });
      expect(messages[1]).toEqual({
        type: "error",
        error: "Parse error",
      });
    });
  });

  describe("createMessageHandler", () => {
    let messages: any[];
    let mockContext: WorkerContext;

    beforeEach(() => {
      messages = [];
      mockContext = {
        postMessage: vi.fn((msg) => messages.push(msg)),
      };
    });

    describe("parseString", () => {
      it("should handle parseString request", async () => {
        const handler = createMessageHandler(mockContext);

        const request: ParseStringRequest = {
          id: 1,
          type: "parseString",
          data: "name,age\nAlice,30\nBob,25",
          options: { header: ["name", "age"] },
        };

        await handler(request);

        // Should receive records + done signal
        expect(messages.length).toBeGreaterThanOrEqual(3);

        const recordMessages = messages.filter((m) => m.type === "record");
        // CSV has header + 2 data rows = 3 records total
        expect(recordMessages.length).toBeGreaterThanOrEqual(2);

        const doneMessage = messages.find((m) => m.type === "done");
        expect(doneMessage).toEqual({ id: 1, type: "done" });
      });

      it("should handle parseString request with WASM fallback", async () => {
        const handler = createMessageHandler(mockContext);

        const request: ParseStringRequest = {
          id: 1,
          type: "parseString",
          data: "name,age\nAlice,30",
          options: { header: ["name", "age"] },
          useWASM: true,
        };

        await handler(request);

        // Should complete (WASM or fallback)
        const doneMessage = messages.find((m) => m.type === "done");
        expect(doneMessage).toBeDefined();
      });
    });

    describe("parseBinary", () => {
      it("should handle parseBinary request", async () => {
        const handler = createMessageHandler(mockContext);

        const csvData = "name,age\nAlice,30\nBob,25";
        const encoder = new TextEncoder();
        const binary = encoder.encode(csvData);

        const request: ParseBinaryRequest = {
          id: 1,
          type: "parseBinary",
          data: binary,
          options: {
            header: ["name", "age"],
            charset: "utf-8",
          },
        };

        await handler(request);

        // Should receive records + done signal
        expect(messages.length).toBeGreaterThanOrEqual(3);

        const recordMessages = messages.filter((m) => m.type === "record");
        // CSV has header + 2 data rows = 3 records total
        expect(recordMessages.length).toBeGreaterThanOrEqual(2);

        const doneMessage = messages.find((m) => m.type === "done");
        expect(doneMessage).toEqual({ id: 1, type: "done" });
      });

      it("should handle parseBinary request with ArrayBuffer", async () => {
        const handler = createMessageHandler(mockContext);

        const csvData = "name,age\nAlice,30";
        const encoder = new TextEncoder();
        const binary = encoder.encode(csvData).buffer;

        const request: ParseBinaryRequest = {
          id: 1,
          type: "parseBinary",
          data: binary,
          options: {
            header: ["name", "age"],
            charset: "utf-8",
          },
        };

        await handler(request);

        const doneMessage = messages.find((m) => m.type === "done");
        expect(doneMessage).toBeDefined();
      });

      it("should handle ParseBinaryOptions properties", async () => {
        const handler = createMessageHandler(mockContext);

        const csvData = "name,age\nAlice,30";
        const encoder = new TextEncoder();
        const binary = encoder.encode(csvData);

        const request: ParseBinaryRequest = {
          id: 1,
          type: "parseBinary",
          data: binary,
          options: {
            header: ["name", "age"],
            charset: "utf-8",
            fatal: false,
            ignoreBOM: true,
          },
        };

        await handler(request);

        const doneMessage = messages.find((m) => m.type === "done");
        expect(doneMessage).toBeDefined();
      });
    });

    describe("parseStream", () => {
      it("should handle parseStream request", async () => {
        const handler = createMessageHandler(mockContext);

        const csvData = "name,age\nAlice,30\nBob,25";
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(csvData);
            controller.close();
          },
        });

        const request: ParseStringStreamRequest = {
          id: 1,
          type: "parseStream",
          data: stream,
          options: { header: ["name", "age"] },
        };

        await handler(request);

        // Should receive records + done signal
        expect(messages.length).toBeGreaterThanOrEqual(1);

        const doneMessage = messages.find((m) => m.type === "done");
        expect(doneMessage).toEqual({ id: 1, type: "done" });
      });
    });

    describe("parseUint8ArrayStream", () => {
      it("should handle parseUint8ArrayStream request", async () => {
        const handler = createMessageHandler(mockContext);

        const csvData = "name,age\nAlice,30\nBob,25";
        const encoder = new TextEncoder();
        const bytes = encoder.encode(csvData);

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        });

        const request: ParseUint8ArrayStreamRequest = {
          id: 1,
          type: "parseUint8ArrayStream",
          data: stream,
          options: {
            header: ["name", "age"],
            charset: "utf-8",
          },
        };

        await handler(request);

        // Should receive records + done signal
        expect(messages.length).toBeGreaterThanOrEqual(1);

        const doneMessage = messages.find((m) => m.type === "done");
        expect(doneMessage).toEqual({ id: 1, type: "done" });
      });

      it("should handle ParseBinaryOptions in stream", async () => {
        const handler = createMessageHandler(mockContext);

        const csvData = "name,age\nAlice,30";
        const encoder = new TextEncoder();
        const bytes = encoder.encode(csvData);

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        });

        const request: ParseUint8ArrayStreamRequest = {
          id: 1,
          type: "parseUint8ArrayStream",
          data: stream,
          options: {
            header: ["name", "age"],
            charset: "utf-8",
            fatal: false,
            ignoreBOM: true,
          },
        };

        await handler(request);

        const doneMessage = messages.find((m) => m.type === "done");
        expect(doneMessage).toBeDefined();
      });
    });

    describe("TransferableStream strategy", () => {
      it("should handle parseStringStream with resultPort", async () => {
        const handler = createMessageHandler(mockContext);

        const portMessages: any[] = [];
        const mockPort = {
          postMessage: vi.fn((msg) => portMessages.push(msg)),
        } as unknown as MessagePort;

        const csvData = "name,age\nAlice,30";
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(csvData);
            controller.close();
          },
        });

        const request: ParseStringStreamRequest = {
          id: 1,
          type: "parseStringStream",
          stream: stream,
          options: { header: ["name", "age"] },
          resultPort: mockPort,
        };

        await handler(request);

        // Messages should be sent to resultPort, not main context
        expect(portMessages.length).toBeGreaterThanOrEqual(1);

        const doneMessage = portMessages.find((m) => m.type === "done");
        expect(doneMessage).toBeDefined();
      });

      it("should handle parseUint8ArrayStream with resultPort", async () => {
        const handler = createMessageHandler(mockContext);

        const portMessages: any[] = [];
        const mockPort = {
          postMessage: vi.fn((msg) => portMessages.push(msg)),
        } as unknown as MessagePort;

        const csvData = "name,age\nAlice,30";
        const encoder = new TextEncoder();
        const bytes = encoder.encode(csvData);

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        });

        const request: ParseUint8ArrayStreamRequest = {
          id: 1,
          type: "parseUint8ArrayStream",
          stream: stream,
          options: {
            header: ["name", "age"],
            charset: "utf-8",
          },
          resultPort: mockPort,
        };

        await handler(request);

        // Messages should be sent to resultPort
        expect(portMessages.length).toBeGreaterThanOrEqual(1);

        const doneMessage = portMessages.find((m) => m.type === "done");
        expect(doneMessage).toBeDefined();
      });
    });

    describe("Error handling", () => {
      it("should catch and report errors", async () => {
        const handler = createMessageHandler(mockContext);

        const request: ParseStringRequest = {
          id: 1,
          type: "parseString",
          data: '"unclosed quote\nAlice,30',
          options: { header: ["name", "age"] },
        };

        await handler(request);

        const errorMessage = messages.find((m) => m.type === "error");
        expect(errorMessage).toBeDefined();
        expect(errorMessage?.error).toBeDefined();
      });

      it("should handle unsupported parse type", async () => {
        const handler = createMessageHandler(mockContext);

        const request = {
          id: 1,
          type: "unsupportedType",
        } as any;

        await handler(request);

        const errorMessage = messages.find((m) => m.type === "error");
        expect(errorMessage).toBeDefined();
        expect(errorMessage?.error).toContain("Unsupported parse type");
      });
    });
  });
});
