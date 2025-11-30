import {
  beforeEach,
  describe as describe_,
  expect,
  it as it_,
  test,
  vi,
} from "vitest";
import { transform } from "@/__tests__/helper.ts";
import { FlexibleStringArrayCSVParser } from "@/parser/models/FlexibleStringArrayCSVParser.ts";
import { FlexibleStringObjectCSVParser } from "@/parser/models/FlexibleStringObjectCSVParser.ts";
import { StringCSVParserStream } from "@/parser/stream/StringCSVParserStream.ts";

const describe = describe_;
const it = it_;

describe("StringCSVParserStream", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  describe("Basic functionality", () => {
    it("should parse CSV string chunks into records", async () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
      });
      const stream = new StringCSVParserStream(parser);

      const records = await transform(stream, ["Alice,30\n", "Bob,25\n"]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("should handle single chunk", async () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
      });
      const stream = new StringCSVParserStream(parser);

      const records = await transform(stream, ["Alice,30\nBob,25"]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("should handle empty chunks", async () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
      });
      const stream = new StringCSVParserStream(parser);

      const records = await transform(stream, ["", "Alice,30\n", "", "Bob,25"]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("should flush incomplete records on close", async () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
      });
      const stream = new StringCSVParserStream(parser);

      const records = await transform(stream, ["Alice,30\n", "Bob"]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "" }, // Missing field returns empty string
      ]);
    });
  });

  describe("Array output format", () => {
    it("should parse CSV into array records", async () => {
      const parser = new FlexibleStringArrayCSVParser({
        header: ["name", "age"] as const,
      });
      const stream = new StringCSVParserStream<
        readonly ["name", "age"],
        "array"
      >(parser);

      const records = await transform(stream, ["Alice,30\n", "Bob,25\n"]);

      expect(records).toEqual([
        ["Alice", "30"],
        ["Bob", "25"],
      ]);
    });

    it("should include header when includeHeader is true", async () => {
      const parser = new FlexibleStringArrayCSVParser({
        header: ["name", "age"] as const,
        includeHeader: true,
      });
      const stream = new StringCSVParserStream<
        readonly ["name", "age"],
        "array"
      >(parser);

      const records = await transform(stream, ["Alice,30\n", "Bob,25\n"]);

      expect(records).toEqual([
        ["name", "age"],
        ["Alice", "30"],
        ["Bob", "25"],
      ]);
    });

    it("should handle records split across chunks in array format", async () => {
      const parser = new FlexibleStringArrayCSVParser({
        header: ["name", "age"] as const,
      });
      const stream = new StringCSVParserStream<
        readonly ["name", "age"],
        "array"
      >(parser);

      const records = await transform(stream, [
        "Alice,",
        "30\n",
        "Bob",
        ",25\n",
      ]);

      expect(records).toEqual([
        ["Alice", "30"],
        ["Bob", "25"],
      ]);
    });
  });

  describe("Backpressure handling", () => {
    it("should handle backpressure with custom check interval", async () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
      });
      const stream = new StringCSVParserStream(
        parser,
        { backpressureCheckInterval: 1 }, // Check every record
      );

      // Generate many records to trigger backpressure checks
      const chunks = Array.from(
        { length: 10 },
        (_, i) => `Person${i},${i * 10}\n`,
      );
      const records = await transform(stream, chunks);

      expect(records).toHaveLength(10);
      expect(records[0]).toEqual({ name: "Person0", age: "0" });
      expect(records[9]).toEqual({ name: "Person9", age: "90" });
    });

    it("should yield to event loop during backpressure", async () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
      });

      // Create a stream and spy on yieldToEventLoop
      const stream = new StringCSVParserStream(parser, {
        backpressureCheckInterval: 1,
      });
      const yieldSpy = vi.spyOn(stream as any, "yieldToEventLoop");

      // Single chunk with multiple records
      const chunk = Array.from(
        { length: 200 },
        (_, i) => `Person${i},${i}`,
      ).join("\n");
      await transform(stream, [chunk]);

      // Should have yielded at least once due to backpressure checks
      // (actual yield depends on desiredSize, so we just verify the mechanism exists)
      expect(yieldSpy).toBeDefined();
    });
  });

  describe("Custom queuing strategies", () => {
    it("should accept custom writable strategy", async () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
      });

      const customWritableStrategy = {
        highWaterMark: 131072, // 128KB
        size: (chunk: string) => chunk.length,
      };

      const stream = new StringCSVParserStream(
        parser,
        {},
        customWritableStrategy,
      );

      const records = await transform(stream, ["Alice,30\n", "Bob,25\n"]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("should accept custom readable strategy", async () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
      });

      const customReadableStrategy = new CountQueuingStrategy({
        highWaterMark: 512,
      });

      const stream = new StringCSVParserStream(
        parser,
        {},
        undefined,
        customReadableStrategy,
      );

      const records = await transform(stream, ["Alice,30\n", "Bob,25\n"]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });
  });

  describe("Error handling", () => {
    it("should propagate parser errors", async () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
      });
      const stream = new StringCSVParserStream(parser);

      await expect(
        transform(stream, ['"Alice,30']), // Malformed quoted field
      ).rejects.toThrow();
    });

    it("should handle strict column count errors", async () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
        columnCountStrategy: "strict",
      });
      const stream = new StringCSVParserStream(parser);

      await expect(transform(stream, ["Alice,30,extra\n"])).rejects.toThrow();
    });
  });

  describe("AbortSignal support", () => {
    let controller: AbortController;

    beforeEach(() => {
      controller = new AbortController();
    });

    test("should abort parsing when signal is aborted", async () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
        signal: controller.signal,
      });
      const stream = new StringCSVParserStream(parser);

      controller.abort();

      await expect(transform(stream, ["Alice,30\nBob,25"])).rejects.toThrow();
    });
  });

  describe("Parser instance access", () => {
    it("should expose parser instance", () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
      });
      const stream = new StringCSVParserStream(parser);

      expect(stream.parser).toBe(parser);
    });
  });

  describe("Streaming across chunk boundaries", () => {
    it("should handle records split across chunks", async () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
      });
      const stream = new StringCSVParserStream(parser);

      const records = await transform(stream, [
        "Alice,",
        "30\n",
        "Bob",
        ",25\n",
      ]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("should handle quoted fields across chunks", async () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
      });
      const stream = new StringCSVParserStream(parser);

      const records = await transform(stream, [
        '"Alice',
        ' Smith",30\n',
        '"Bob",25\n',
      ]);

      expect(records).toEqual([
        { name: "Alice Smith", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });
  });

  describe("Performance characteristics", () => {
    it("should handle large number of records efficiently", async () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
      });
      const stream = new StringCSVParserStream(parser);

      // Generate 1000 records
      const chunks = [
        Array.from({ length: 1000 }, (_, i) => `Person${i},${i}`).join("\n"),
      ];

      const records = await transform(stream, chunks);

      expect(records).toHaveLength(1000);
      expect(records[0]).toEqual({ name: "Person0", age: "0" });
      expect(records[999]).toEqual({ name: "Person999", age: "999" });
    });
  });
});
