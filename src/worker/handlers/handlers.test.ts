import { describe, expect, it, vi } from "vitest";
import type { CSVRecord } from "@/core/types.ts";
import type {
  ParseBinaryRequest,
  ParseStringRequest,
  ParseStringStreamRequest,
  ParseUint8ArrayStreamRequest,
} from "@/worker/helpers/worker.shared.ts";
import type { OutputStrategy } from "@/worker/utils/outputStrategy.ts";
import { parseBinaryHandler } from "./parseBinaryHandler.ts";
import { parseBinaryStreamHandler } from "./parseBinaryStreamHandler.ts";
import { parseStreamHandler } from "./parseStreamHandler.ts";
import { parseStringHandler } from "./parseStringHandler.ts";
import { parseStringStreamHandler } from "./parseStringStreamHandler.ts";
import type { HandlerContext } from "./types.ts";

// Create mock output strategy for testing
function createMockOutputStrategy(): OutputStrategy & {
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

// Create mock worker context
function createMockWorkerContext() {
  return {
    postMessage: vi.fn(),
  };
}

// Create handler context
function createHandlerContext(): HandlerContext & {
  outputStrategy: ReturnType<typeof createMockOutputStrategy>;
} {
  const outputStrategy = createMockOutputStrategy();
  return {
    workerContext: createMockWorkerContext() as any,
    outputStrategy,
  };
}

// Helper to create string stream
function createStringStream(text: string): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(text);
      controller.close();
    },
  });
}

// Helper to create binary stream
function createBinaryStream(data: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

describe("parseStringHandler", () => {
  describe("Basic parsing", () => {
    it("should parse simple CSV string", async () => {
      const context = createHandlerContext();
      const request: ParseStringRequest = {
        id: 1,
        type: "parseString",
        data: "name,age\nAlice,30\nBob,25",
        options: {},
      };

      await parseStringHandler(request, context);

      expect(context.outputStrategy.records).toHaveLength(2);
      expect(context.outputStrategy.records[0]).toEqual({
        name: "Alice",
        age: "30",
      });
      expect(context.outputStrategy.records[1]).toEqual({
        name: "Bob",
        age: "25",
      });
      expect(context.outputStrategy.doneCount).toBe(1);
    });

    it("should handle empty CSV", async () => {
      const context = createHandlerContext();
      const request: ParseStringRequest = {
        id: 1,
        type: "parseString",
        data: "name,age",
        options: {},
      };

      await parseStringHandler(request, context);

      expect(context.outputStrategy.records).toHaveLength(0);
      expect(context.outputStrategy.doneCount).toBe(1);
    });

    it("should handle CSV with quoted fields", async () => {
      const context = createHandlerContext();
      const request: ParseStringRequest = {
        id: 1,
        type: "parseString",
        data: 'name,description\n"Alice","Hello, World"',
        options: {},
      };

      await parseStringHandler(request, context);

      expect(context.outputStrategy.records[0]!.description).toBe(
        "Hello, World",
      );
    });
  });

  describe("Validation", () => {
    it("should throw error for non-string data", async () => {
      const context = createHandlerContext();
      const request: ParseStringRequest = {
        id: 1,
        type: "parseString",
        data: 123 as any,
        options: {},
      };

      await expect(parseStringHandler(request, context)).rejects.toThrow(
        "parseString requires string data",
      );
    });
  });

  describe("Options", () => {
    it("should use custom delimiter", async () => {
      const context = createHandlerContext();
      const request = {
        id: 1,
        type: "parseString" as const,
        data: "name;age\nAlice;30",
        options: { delimiter: ";" },
      };

      await parseStringHandler(request as ParseStringRequest, context);

      expect(context.outputStrategy.records[0]).toEqual({
        name: "Alice",
        age: "30",
      });
    });
  });
});

describe("parseBinaryHandler", () => {
  describe("Basic parsing", () => {
    it("should parse binary CSV data", async () => {
      const context = createHandlerContext();
      const encoder = new TextEncoder();
      const request: ParseBinaryRequest = {
        id: 1,
        type: "parseBinary",
        data: encoder.encode("name,age\nAlice,30"),
        options: {},
      };

      await parseBinaryHandler(request, context);

      expect(context.outputStrategy.records).toHaveLength(1);
      expect(context.outputStrategy.records[0]).toEqual({
        name: "Alice",
        age: "30",
      });
      expect(context.outputStrategy.doneCount).toBe(1);
    });

    it("should handle ArrayBuffer input", async () => {
      const context = createHandlerContext();
      const encoder = new TextEncoder();
      const uint8 = encoder.encode("col1,col2\nval1,val2");
      const request: ParseBinaryRequest = {
        id: 1,
        type: "parseBinary",
        data: uint8.buffer as ArrayBuffer,
        options: {},
      };

      await parseBinaryHandler(request, context);

      expect(context.outputStrategy.records).toHaveLength(1);
      expect(context.outputStrategy.records[0]).toEqual({
        col1: "val1",
        col2: "val2",
      });
    });
  });

  describe("Options", () => {
    it("should handle charset option", async () => {
      const context = createHandlerContext();
      const encoder = new TextEncoder();
      const request: ParseBinaryRequest = {
        id: 1,
        type: "parseBinary",
        data: encoder.encode("name\nテスト"),
        options: { charset: "utf-8" },
      };

      await parseBinaryHandler(request, context);

      expect(context.outputStrategy.records[0]!.name).toBe("テスト");
    });
  });
});

describe("parseStreamHandler", () => {
  describe("Basic parsing", () => {
    it("should parse string stream", async () => {
      const context = createHandlerContext();
      const request: ParseStringStreamRequest = {
        id: 1,
        type: "parseStream",
        data: createStringStream("name,age\nAlice,30\nBob,25"),
        options: {},
      };

      await parseStreamHandler(request, context);

      expect(context.outputStrategy.records).toHaveLength(2);
      expect(context.outputStrategy.records[0]).toEqual({
        name: "Alice",
        age: "30",
      });
      expect(context.outputStrategy.records[1]).toEqual({
        name: "Bob",
        age: "25",
      });
    });
  });

  describe("Validation", () => {
    it("should throw error for non-stream data", async () => {
      const context = createHandlerContext();
      const request: ParseStringStreamRequest = {
        id: 1,
        type: "parseStream",
        data: "not a stream" as any,
        options: {},
      };

      await expect(parseStreamHandler(request, context)).rejects.toThrow(
        "parseStream requires ReadableStream data",
      );
    });
  });
});

describe("parseStringStreamHandler", () => {
  describe("Basic parsing", () => {
    it("should parse string stream from data property", async () => {
      const context = createHandlerContext();
      const request: ParseStringStreamRequest = {
        id: 1,
        type: "parseStringStream",
        data: createStringStream("name,age\nAlice,30"),
        options: {},
      };

      await parseStringStreamHandler(request, context);

      expect(context.outputStrategy.records).toHaveLength(1);
      expect(context.outputStrategy.records[0]).toEqual({
        name: "Alice",
        age: "30",
      });
    });

    it("should parse string stream from stream property", async () => {
      const context = createHandlerContext();
      const request = {
        id: 1,
        type: "parseStringStream",
        stream: createStringStream("name,value\ntest,123"),
        options: {},
      } as ParseStringStreamRequest;

      await parseStringStreamHandler(request, context);

      expect(context.outputStrategy.records[0]).toEqual({
        name: "test",
        value: "123",
      });
    });
  });

  describe("Validation", () => {
    it("should throw error with helpful message for non-stream data", async () => {
      const context = createHandlerContext();
      const request: ParseStringStreamRequest = {
        id: 1,
        type: "parseStringStream",
        data: { invalid: "data" } as any,
        options: {},
      };

      await expect(parseStringStreamHandler(request, context)).rejects.toThrow(
        "parseStringStream requires 'stream' or 'data' property as ReadableStream",
      );
    });
  });
});

describe("parseBinaryStreamHandler", () => {
  describe("CPU parsing", () => {
    it("should parse binary stream", async () => {
      const context = createHandlerContext();
      const encoder = new TextEncoder();
      const request: ParseUint8ArrayStreamRequest = {
        id: 1,
        type: "parseBinaryStream",
        data: createBinaryStream(encoder.encode("name,age\nAlice,30")),
        options: {},
      };

      await parseBinaryStreamHandler(request, context);

      expect(context.outputStrategy.records).toHaveLength(1);
      expect(context.outputStrategy.records[0]).toEqual({
        name: "Alice",
        age: "30",
      });
    });

    it("should parse binary stream from stream property", async () => {
      const context = createHandlerContext();
      const encoder = new TextEncoder();
      const request = {
        id: 1,
        type: "parseBinaryStream",
        stream: createBinaryStream(encoder.encode("col\ndata")),
        options: {},
      } as ParseUint8ArrayStreamRequest;

      await parseBinaryStreamHandler(request, context);

      expect(context.outputStrategy.records[0]).toEqual({ col: "data" });
    });

    it("should handle charset option", async () => {
      const context = createHandlerContext();
      const encoder = new TextEncoder();
      const request: ParseUint8ArrayStreamRequest = {
        id: 1,
        type: "parseBinaryStream",
        data: createBinaryStream(encoder.encode("name\n日本語")),
        options: { charset: "utf-8" },
      };

      await parseBinaryStreamHandler(request, context);

      expect(context.outputStrategy.records[0]!.name).toBe("日本語");
    });
  });

  describe("Validation", () => {
    it("should throw error with helpful message for non-stream data", async () => {
      const context = createHandlerContext();
      const request: ParseUint8ArrayStreamRequest = {
        id: 1,
        type: "parseBinaryStream",
        data: new Uint8Array([1, 2, 3]) as any,
        options: {},
      };

      await expect(parseBinaryStreamHandler(request, context)).rejects.toThrow(
        "parseBinaryStream requires 'stream' or 'data' property as ReadableStream",
      );
    });
  });

  describe("GPU fallback", () => {
    it("should fall back to CPU when WebGPU is unavailable", async () => {
      const context = createHandlerContext();
      const encoder = new TextEncoder();
      const request: ParseUint8ArrayStreamRequest = {
        id: 1,
        type: "parseBinaryStream",
        data: createBinaryStream(encoder.encode("name,value\ntest,123")),
        options: {},
        useGPU: true, // Request GPU but WebGPU is not available in Node.js
      };

      // Should fall back to CPU and still work
      await parseBinaryStreamHandler(request, context);

      expect(context.outputStrategy.records).toHaveLength(1);
      expect(context.outputStrategy.records[0]).toEqual({
        name: "test",
        value: "123",
      });
    });

    it("should fall back to CPU for non-UTF-8 charset even when GPU requested", async () => {
      const context = createHandlerContext();
      const encoder = new TextEncoder();
      const request: ParseUint8ArrayStreamRequest = {
        id: 1,
        type: "parseBinaryStream",
        data: createBinaryStream(encoder.encode("name\ntest")),
        options: { charset: "iso-8859-1" },
        useGPU: true, // GPU doesn't support non-UTF-8
      };

      // Should use CPU path due to charset
      await parseBinaryStreamHandler(request, context);

      expect(context.outputStrategy.records).toHaveLength(1);
    });
  });
});

describe("Handler types", () => {
  describe("HandlerContext", () => {
    it("should have required properties", () => {
      const context = createHandlerContext();
      expect(context.workerContext).toBeDefined();
      expect(context.outputStrategy).toBeDefined();
      expect(typeof context.outputStrategy.sendRecord).toBe("function");
      expect(typeof context.outputStrategy.sendDone).toBe("function");
      expect(typeof context.outputStrategy.sendError).toBe("function");
    });
  });
});
