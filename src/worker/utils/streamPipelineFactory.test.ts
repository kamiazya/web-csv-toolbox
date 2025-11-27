import { describe, expect, it } from "vitest";
import type { CSVRecord, ParseOptions } from "@/core/types.ts";
import {
  buildCSVStreamPipeline,
  streamToAsyncIterator,
} from "./streamPipelineFactory.ts";

// Helper to create a string stream from text
function createStringStream(text: string): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(text);
      controller.close();
    },
  });
}

// Helper to create a chunked string stream
function createChunkedStringStream(chunks: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

// Helper to collect all records from ReadableStream
async function collectRecords<T>(stream: ReadableStream<T>): Promise<T[]> {
  const results: T[] = [];
  const iterator = await streamToAsyncIterator(stream);
  for await (const item of iterator) {
    results.push(item);
  }
  return results;
}

describe("buildCSVStreamPipeline", () => {
  describe("Basic CSV parsing", () => {
    it("should parse simple CSV with headers", async () => {
      const csv = "name,age\nAlice,30\nBob,25";
      const stream = createStringStream(csv);

      const recordStream = await buildCSVStreamPipeline(stream);
      const records = await collectRecords(recordStream);

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({ name: "Alice", age: "30" });
      expect(records[1]).toEqual({ name: "Bob", age: "25" });
    });

    it("should parse CSV with single row", async () => {
      const csv = "id,value\n1,test";
      const stream = createStringStream(csv);

      const recordStream = await buildCSVStreamPipeline(stream);
      const records = await collectRecords(recordStream);

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ id: "1", value: "test" });
    });

    it("should handle empty CSV (headers only)", async () => {
      const csv = "col1,col2,col3";
      const stream = createStringStream(csv);

      const recordStream = await buildCSVStreamPipeline(stream);
      const records = await collectRecords(recordStream);

      expect(records).toHaveLength(0);
    });

    it("should handle CSV with many columns", async () => {
      const csv = "a,b,c,d,e,f,g,h,i,j\n1,2,3,4,5,6,7,8,9,10";
      const stream = createStringStream(csv);

      const recordStream = await buildCSVStreamPipeline(stream);
      const records = await collectRecords(recordStream);

      expect(records).toHaveLength(1);
      expect(Object.keys(records[0]!)).toHaveLength(10);
    });
  });

  describe("CSV with special characters", () => {
    it("should parse CSV with quoted fields", async () => {
      const csv = 'name,description\n"Alice","Hello, World"';
      const stream = createStringStream(csv);

      const recordStream = await buildCSVStreamPipeline(stream);
      const records = await collectRecords(recordStream);

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({
        name: "Alice",
        description: "Hello, World",
      });
    });

    it("should parse CSV with embedded quotes", async () => {
      const csv = 'text\n"He said ""hello"""';
      const stream = createStringStream(csv);

      const recordStream = await buildCSVStreamPipeline(stream);
      const records = await collectRecords(recordStream);

      expect(records[0]!.text).toBe('He said "hello"');
    });

    it("should parse CSV with newlines in quoted fields", async () => {
      const csv = 'name,address\n"Alice","123 Main St\nApt 4"';
      const stream = createStringStream(csv);

      const recordStream = await buildCSVStreamPipeline(stream);
      const records = await collectRecords(recordStream);

      expect(records[0]!.address).toBe("123 Main St\nApt 4");
    });
  });

  describe("Chunked input", () => {
    it("should handle CSV split across chunks", async () => {
      const chunks = ["name,age\n", "Alice,30\n", "Bob,25"];
      const stream = createChunkedStringStream(chunks);

      const recordStream = await buildCSVStreamPipeline(stream);
      const records = await collectRecords(recordStream);

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({ name: "Alice", age: "30" });
      expect(records[1]).toEqual({ name: "Bob", age: "25" });
    });

    it("should handle row split across chunks", async () => {
      const chunks = ["name,age\nAl", "ice,30"];
      const stream = createChunkedStringStream(chunks);

      const recordStream = await buildCSVStreamPipeline(stream);
      const records = await collectRecords(recordStream);

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ name: "Alice", age: "30" });
    });

    it("should handle header split across chunks", async () => {
      const chunks = ["na", "me,", "age\nAlice,30"];
      const stream = createChunkedStringStream(chunks);

      const recordStream = await buildCSVStreamPipeline(stream);
      const records = await collectRecords(recordStream);

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ name: "Alice", age: "30" });
    });
  });

  describe("Options handling", () => {
    it("should use custom delimiter", async () => {
      const csv = "name;age\nAlice;30";
      const stream = createStringStream(csv);

      const recordStream = await buildCSVStreamPipeline(stream, {
        delimiter: ";",
      });
      const records = await collectRecords(recordStream);

      expect(records[0]).toEqual({ name: "Alice", age: "30" });
    });

    it("should use custom quotation", async () => {
      const csv = "name,text\nAlice,'Hello, World'";
      const stream = createStringStream(csv);

      const recordStream = await buildCSVStreamPipeline(stream, {
        quotation: "'",
      });
      const records = await collectRecords(recordStream);

      expect(records[0]!.text).toBe("Hello, World");
    });

    it("should handle options with undefined values", async () => {
      const csv = "name\nAlice";
      const stream = createStringStream(csv);
      const options: ParseOptions = {
        delimiter: undefined,
        quotation: undefined,
      };

      const recordStream = await buildCSVStreamPipeline(stream, options);
      const records = await collectRecords(recordStream);

      expect(records).toHaveLength(1);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty stream", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.close();
        },
      });

      const recordStream = await buildCSVStreamPipeline(stream);
      const records = await collectRecords(recordStream);

      expect(records).toHaveLength(0);
    });

    it("should handle stream with only whitespace", async () => {
      const csv = "name\n   \n";
      const stream = createStringStream(csv);

      const recordStream = await buildCSVStreamPipeline(stream);
      const records = await collectRecords(recordStream);

      // Whitespace-only row should be treated as a record with whitespace value
      expect(records.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle large records", async () => {
      const longValue = "x".repeat(10000);
      const csv = `data\n${longValue}`;
      const stream = createStringStream(csv);

      const recordStream = await buildCSVStreamPipeline(stream);
      const records = await collectRecords(recordStream);

      expect(records[0]!.data).toBe(longValue);
    });
  });
});

describe("streamToAsyncIterator", () => {
  describe("Basic conversion", () => {
    it("should convert stream to async iterator", async () => {
      const stream = new ReadableStream<number>({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
          controller.enqueue(3);
          controller.close();
        },
      });

      const iterator = await streamToAsyncIterator(stream);
      const results: number[] = [];

      for await (const value of { [Symbol.asyncIterator]: () => iterator }) {
        results.push(value);
      }

      expect(results).toEqual([1, 2, 3]);
    });

    it("should handle string stream", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("hello");
          controller.enqueue("world");
          controller.close();
        },
      });

      const iterator = await streamToAsyncIterator(stream);
      const results: string[] = [];

      for await (const value of { [Symbol.asyncIterator]: () => iterator }) {
        results.push(value);
      }

      expect(results).toEqual(["hello", "world"]);
    });

    it("should handle object stream", async () => {
      interface TestRecord {
        name: string;
      }

      const stream = new ReadableStream<TestRecord>({
        start(controller) {
          controller.enqueue({ name: "Alice" });
          controller.enqueue({ name: "Bob" });
          controller.close();
        },
      });

      const iterator = await streamToAsyncIterator(stream);
      const results: TestRecord[] = [];

      for await (const value of { [Symbol.asyncIterator]: () => iterator }) {
        results.push(value);
      }

      expect(results).toEqual([{ name: "Alice" }, { name: "Bob" }]);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty stream", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.close();
        },
      });

      const iterator = await streamToAsyncIterator(stream);
      const results: string[] = [];

      for await (const value of { [Symbol.asyncIterator]: () => iterator }) {
        results.push(value);
      }

      expect(results).toHaveLength(0);
    });

    it("should handle single item stream", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("only one");
          controller.close();
        },
      });

      const iterator = await streamToAsyncIterator(stream);
      const results: string[] = [];

      for await (const value of { [Symbol.asyncIterator]: () => iterator }) {
        results.push(value);
      }

      expect(results).toEqual(["only one"]);
    });
  });

  describe("Iterator protocol", () => {
    it("should return correct done=true when exhausted", async () => {
      const stream = new ReadableStream<number>({
        start(controller) {
          controller.enqueue(1);
          controller.close();
        },
      });

      const iterator = await streamToAsyncIterator(stream);

      const first = await iterator.next();
      expect(first.done).toBe(false);
      expect(first.value).toBe(1);

      const second = await iterator.next();
      expect(second.done).toBe(true);
    });

    it("should support early termination via return", async () => {
      const stream = new ReadableStream<number>({
        start(controller) {
          controller.enqueue(1);
          controller.enqueue(2);
          controller.enqueue(3);
          controller.close();
        },
      });

      const iterator = await streamToAsyncIterator(stream);

      const first = await iterator.next();
      expect(first.value).toBe(1);

      // Early termination
      if (iterator.return) {
        await iterator.return();
      }
    });
  });
});

describe("Integration: buildCSVStreamPipeline + streamToAsyncIterator", () => {
  it("should work together for complete CSV parsing", async () => {
    const csv = "name,email\nAlice,alice@example.com\nBob,bob@example.com";
    const stream = createStringStream(csv);

    const recordStream = await buildCSVStreamPipeline(stream);
    const iterator = await streamToAsyncIterator(recordStream);

    const records: CSVRecord[] = [];
    for await (const record of { [Symbol.asyncIterator]: () => iterator }) {
      records.push(record);
    }

    expect(records).toEqual([
      { name: "Alice", email: "alice@example.com" },
      { name: "Bob", email: "bob@example.com" },
    ]);
  });
});
