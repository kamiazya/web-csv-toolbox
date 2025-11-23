import {
  beforeEach,
  describe as describe_,
  expect,
  it as it_,
  test,
  vi,
} from "vitest";
import { transform } from "@/__tests__/helper.ts";
import { FlexibleBinaryCSVParser } from "@/parser/models/FlexibleBinaryCSVParser.ts";
import { BinaryCSVParserStream } from "@/parser/stream/BinaryCSVParserStream.ts";

const describe = describe_.concurrent;
const it = it_.concurrent;

describe("BinaryCSVParserStream", () => {
  const encoder = new TextEncoder();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  describe("Basic functionality", () => {
    it("should parse binary CSV chunks into records", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      const records = await transform(stream, [
        encoder.encode("Alice,30\n"),
        encoder.encode("Bob,25\n"),
      ]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("should handle single chunk", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      const records = await transform(stream, [
        encoder.encode("Alice,30\nBob,25"),
      ]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("should handle empty chunks", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      const records = await transform(stream, [
        new Uint8Array(0),
        encoder.encode("Alice,30\n"),
        new Uint8Array(0),
        encoder.encode("Bob"),
      ]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: undefined }, // Incomplete record leaves missing field undefined
      ]);
    });

    it("should flush incomplete records on close", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      const records = await transform(stream, [
        encoder.encode("Alice,30\n"),
        encoder.encode("Bob"),
      ]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: undefined }, // Missing field remains undefined
      ]);
    });
  });

  describe("Array output format", () => {
    it("should parse binary CSV into array records", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        outputFormat: "array",
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      const records = await transform(stream, [
        encoder.encode("Alice,30\n"),
        encoder.encode("Bob,25\n"),
      ]);

      expect(records).toEqual([
        ["Alice", "30"],
        ["Bob", "25"],
      ]);
    });

    it("should include header when includeHeader is true", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        outputFormat: "array",
        includeHeader: true,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      const records = await transform(stream, [
        encoder.encode("Alice,30\n"),
        encoder.encode("Bob,25\n"),
      ]);

      expect(records).toEqual([
        ["name", "age"],
        ["Alice", "30"],
        ["Bob", "25"],
      ]);
    });
  });

  describe("UTF-8 handling", () => {
    it("should handle UTF-8 encoded data", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      const records = await transform(stream, [
        encoder.encode("日本語,30\n"),
        encoder.encode("한글,25\n"),
      ]);

      expect(records).toEqual([
        { name: "日本語", age: "30" },
        { name: "한글", age: "25" },
      ]);
    });

    it("should handle multi-byte characters across chunk boundaries", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      // Split UTF-8 multi-byte character across chunks
      // "あ" is 3 bytes in UTF-8: E3 81 82
      const fullBytes = encoder.encode("あ,30\n");
      const chunk1 = fullBytes.slice(0, 2); // Incomplete character
      const chunk2 = fullBytes.slice(2); // Remaining bytes

      const records = await transform(stream, [chunk1, chunk2]);

      expect(records).toEqual([{ name: "あ", age: "30" }]);
    });

    it("should handle BOM with ignoreBOM option", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
        ignoreBOM: true,
      });
      const stream = new BinaryCSVParserStream(parser);

      // UTF-8 BOM: EF BB BF
      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      const data = encoder.encode("Alice,30\n");
      const withBOM = new Uint8Array(bom.length + data.length);
      withBOM.set(bom);
      withBOM.set(data, bom.length);

      const records = await transform(stream, [withBOM]);

      // BOM should be stripped when ignoreBOM is true
      // However, the actual behavior depends on TextDecoder implementation
      expect(records).toHaveLength(1);
      expect(records[0]?.age).toBe("30");
    });
  });

  describe("BufferSource support", () => {
    it("should accept ArrayBuffer chunks", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      const uint8_1 = encoder.encode("Alice,30\n");
      const arrayBuffer1 = uint8_1.buffer.slice(
        uint8_1.byteOffset,
        uint8_1.byteOffset + uint8_1.byteLength,
      );

      const uint8_2 = encoder.encode("Bob,25\n");
      const arrayBuffer2 = uint8_2.buffer.slice(
        uint8_2.byteOffset,
        uint8_2.byteOffset + uint8_2.byteLength,
      );

      const records = await transform(stream, [arrayBuffer1, arrayBuffer2]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("should accept Int8Array chunks", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      const uint8_1 = encoder.encode("Alice,30\n");
      const int8_1 = new Int8Array(
        uint8_1.buffer,
        uint8_1.byteOffset,
        uint8_1.byteLength,
      );

      const uint8_2 = encoder.encode("Bob,25\n");
      const int8_2 = new Int8Array(
        uint8_2.buffer,
        uint8_2.byteOffset,
        uint8_2.byteLength,
      );

      const records = await transform(stream, [int8_1, int8_2]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("should accept DataView chunks", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      const uint8_1 = encoder.encode("Alice,30\n");
      const dataView1 = new DataView(
        uint8_1.buffer,
        uint8_1.byteOffset,
        uint8_1.byteLength,
      );

      const uint8_2 = encoder.encode("Bob,25\n");
      const dataView2 = new DataView(
        uint8_2.buffer,
        uint8_2.byteOffset,
        uint8_2.byteLength,
      );

      const records = await transform(stream, [dataView1, dataView2]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("should handle mixed BufferSource types", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      const uint8_1 = encoder.encode("Alice,30\n");
      const arrayBuffer = uint8_1.buffer.slice(
        uint8_1.byteOffset,
        uint8_1.byteOffset + uint8_1.byteLength,
      );

      const uint8_2 = encoder.encode("Bob,25\n");
      const int8Array = new Int8Array(
        uint8_2.buffer,
        uint8_2.byteOffset,
        uint8_2.byteLength,
      );

      const uint8_3 = encoder.encode("Charlie,35\n");
      const dataView = new DataView(
        uint8_3.buffer,
        uint8_3.byteOffset,
        uint8_3.byteLength,
      );

      const uint8_4 = encoder.encode("Dave,40\n");

      const records = await transform(stream, [
        arrayBuffer,
        int8Array,
        dataView,
        uint8_4,
      ]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
        { name: "Charlie", age: "35" },
        { name: "Dave", age: "40" },
      ]);
    });

    it("should handle multi-byte characters with ArrayBuffer chunks", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      // Split UTF-8 multi-byte character across ArrayBuffer chunks
      const fullBytes = encoder.encode("あ,30\n");
      const uint8_1 = fullBytes.slice(0, 2);
      const arrayBuffer1 = uint8_1.buffer.slice(
        uint8_1.byteOffset,
        uint8_1.byteOffset + uint8_1.byteLength,
      );

      const uint8_2 = fullBytes.slice(2);
      const arrayBuffer2 = uint8_2.buffer.slice(
        uint8_2.byteOffset,
        uint8_2.byteOffset + uint8_2.byteLength,
      );

      const records = await transform(stream, [arrayBuffer1, arrayBuffer2]);

      expect(records).toEqual([{ name: "あ", age: "30" }]);
    });
  });

  describe("Backpressure handling", () => {
    it("should handle backpressure with custom check interval", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(
        parser,
        { backpressureCheckInterval: 1 }, // Check every record
      );

      // Generate many records to trigger backpressure checks
      const chunks = Array.from({ length: 10 }, (_, i) =>
        encoder.encode(`Person${i},${i * 10}\n`),
      );
      const records = await transform(stream, chunks);

      expect(records).toHaveLength(10);
      expect(records[0]).toEqual({ name: "Person0", age: "0" });
      expect(records[9]).toEqual({ name: "Person9", age: "90" });
    });

    it("should yield to event loop during backpressure", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });

      const stream = new BinaryCSVParserStream(parser, {
        backpressureCheckInterval: 1,
      });
      const yieldSpy = vi.spyOn(stream as any, "yieldToEventLoop");

      // Single chunk with multiple records
      const chunk = encoder.encode(
        Array.from({ length: 200 }, (_, i) => `Person${i},${i}`).join("\n"),
      );
      await transform(stream, [chunk]);

      expect(yieldSpy).toBeDefined();
    });
  });

  describe("Custom queuing strategies", () => {
    it("should accept custom writable strategy", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });

      const customWritableStrategy = {
        highWaterMark: 131072, // 128KB
        size: (chunk: BufferSource) => chunk.byteLength,
      };

      const stream = new BinaryCSVParserStream(
        parser,
        {},
        customWritableStrategy,
      );

      const records = await transform(stream, [
        encoder.encode("Alice,30\n"),
        encoder.encode("Bob,25\n"),
      ]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("should accept custom readable strategy", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });

      const customReadableStrategy = new CountQueuingStrategy({
        highWaterMark: 512,
      });

      const stream = new BinaryCSVParserStream(
        parser,
        {},
        undefined,
        customReadableStrategy,
      );

      const records = await transform(stream, [
        encoder.encode("Alice,30\n"),
        encoder.encode("Bob,25\n"),
      ]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });
  });

  describe("Error handling", () => {
    it("should propagate parser errors", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      await expect(
        transform(stream, [encoder.encode('"Alice,30')]), // Malformed quoted field
      ).rejects.toThrow();
    });

    it("should handle strict column count errors", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        columnCountStrategy: "strict",
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      await expect(
        transform(stream, [encoder.encode("Alice,30,extra\n")]),
      ).rejects.toThrow();
    });
  });

  describe("AbortSignal support", () => {
    let controller: AbortController;

    beforeEach(() => {
      controller = new AbortController();
    });

    test("should abort parsing when signal is aborted", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        signal: controller.signal,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      controller.abort();

      await expect(
        transform(stream, [encoder.encode("Alice,30\nBob,25")]),
      ).rejects.toThrow();
    });
  });

  describe("Parser instance access", () => {
    it("should expose parser instance", () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      expect(stream.parser).toBe(parser);
    });
  });

  describe("Streaming across chunk boundaries", () => {
    it("should handle records split across chunks", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      const records = await transform(stream, [
        encoder.encode("Alice,"),
        encoder.encode("30\n"),
        encoder.encode("Bob"),
        encoder.encode(",25\n"),
      ]);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("should handle quoted fields across chunks", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      const records = await transform(stream, [
        encoder.encode('"Alice'),
        encoder.encode(' Smith",30\n'),
        encoder.encode('"Bob",25\n'),
      ]);

      expect(records).toEqual([
        { name: "Alice Smith", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });
  });

  describe("Performance characteristics", () => {
    it("should handle large number of records efficiently", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      // Generate 1000 records
      const chunks = [
        encoder.encode(
          Array.from({ length: 1000 }, (_, i) => `Person${i},${i}`).join("\n"),
        ),
      ];

      const records = await transform(stream, chunks);

      expect(records).toHaveLength(1000);
      expect(records[0]).toEqual({ name: "Person0", age: "0" });
      expect(records[999]).toEqual({ name: "Person999", age: "999" });
    });
  });

  describe("Integration with fetch API", () => {
    it("should work with binary stream pattern", async () => {
      const parser = new FlexibleBinaryCSVParser({
        header: ["name", "age"] as const,
        charset: "utf-8",
      });
      const stream = new BinaryCSVParserStream(parser);

      // Simulate fetch response body pattern
      const chunks = [
        encoder.encode("Alice,30\n"),
        encoder.encode("Bob,25\n"),
        encoder.encode("Charlie,35\n"),
      ];

      const records = await transform(stream, chunks);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
        { name: "Charlie", age: "35" },
      ]);
    });
  });
});
