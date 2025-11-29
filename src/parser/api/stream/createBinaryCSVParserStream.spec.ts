import { describe as describe_, expect, it as it_ } from "vitest";
import { transform } from "@/__tests__/helper.ts";
import { createBinaryCSVParserStream } from "@/parser/api/stream/createBinaryCSVParserStream.ts";
import { BinaryCSVParserStream } from "@/parser/stream/BinaryCSVParserStream.ts";

const describe = describe_.concurrent;
const it = it_.concurrent;

const encoder = new TextEncoder();

describe("createBinaryCSVParserStream", () => {
  it("should return a BinaryCSVParserStream instance", () => {
    const stream = createBinaryCSVParserStream();
    expect(stream).toBeInstanceOf(BinaryCSVParserStream);
    expect(stream).toBeInstanceOf(TransformStream);
  });

  it("should parse CSV with header from data", async () => {
    const stream = createBinaryCSVParserStream();
    const chunks = [
      encoder.encode("name,age\r\n"),
      encoder.encode("Alice,30\r\n"),
      encoder.encode("Bob,25\r\n"),
    ];

    const records = await transform(stream, chunks);
    expect(records).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should parse CSV with predefined header", async () => {
    const stream = createBinaryCSVParserStream({
      header: ["name", "age"] as const,
    });
    const chunks = [
      encoder.encode("Alice,30\r\n"),
      encoder.encode("Bob,25\r\n"),
    ];

    const records = await transform(stream, chunks);
    expect(records).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should parse CSV with array output format", async () => {
    const stream = createBinaryCSVParserStream({
      outputFormat: "array",
    });
    const chunks = [
      encoder.encode("name,age\r\n"),
      encoder.encode("Alice,30\r\n"),
      encoder.encode("Bob,25\r\n"),
    ];

    const records = await transform(stream, chunks);
    expect(records).toEqual([
      ["Alice", "30"],
      ["Bob", "25"],
    ]);
  });

  it("should parse TSV with custom delimiter", async () => {
    const stream = createBinaryCSVParserStream({
      delimiter: "\t",
    });
    const chunks = [
      encoder.encode("name\tage\r\n"),
      encoder.encode("Alice\t30\r\n"),
      encoder.encode("Bob\t25\r\n"),
    ];

    const records = await transform(stream, chunks);
    expect(records).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should parse CSV with custom charset", async () => {
    const stream = createBinaryCSVParserStream({
      charset: "utf-8",
    });
    const chunks = [
      encoder.encode("name,age\r\n"),
      encoder.encode("Alice,30\r\n"),
    ];

    const records = await transform(stream, chunks);
    expect(records).toEqual([{ name: "Alice", age: "30" }]);
  });

  it("should accept stream options", () => {
    const stream = createBinaryCSVParserStream(
      {},
      { backpressureCheckInterval: 50 },
    );
    expect(stream).toBeInstanceOf(BinaryCSVParserStream);
  });

  it("should accept custom queuing strategies", () => {
    const writableStrategy = new ByteLengthQueuingStrategy({
      highWaterMark: 131072,
    }) as QueuingStrategy<BufferSource>;
    const readableStrategy = new CountQueuingStrategy({ highWaterMark: 512 });

    const stream = createBinaryCSVParserStream(
      {},
      {},
      writableStrategy,
      readableStrategy,
    );
    expect(stream).toBeInstanceOf(BinaryCSVParserStream);
  });

  it("should handle quoted fields with newlines", async () => {
    const stream = createBinaryCSVParserStream();
    const chunks = [
      encoder.encode('name,description\r\n'),
      encoder.encode('"Alice","Hello\r\nWorld"\r\n'),
    ];

    const records = await transform(stream, chunks);
    expect(records).toEqual([{ name: "Alice", description: "Hello\r\nWorld" }]);
  });

  it("should handle escaped quotes", async () => {
    const stream = createBinaryCSVParserStream();
    const chunks = [
      encoder.encode('name,quote\r\n'),
      encoder.encode('"Alice","She said ""Hello"""\r\n'),
    ];

    const records = await transform(stream, chunks);
    expect(records).toEqual([
      { name: "Alice", quote: 'She said "Hello"' },
    ]);
  });

  it("should accept ArrayBuffer as input", async () => {
    const stream = createBinaryCSVParserStream({
      header: ["name", "age"] as const,
    });
    const data = encoder.encode("Alice,30\r\n");
    const chunks = [data.buffer as ArrayBuffer];

    const records = await transform(stream, chunks);
    expect(records).toEqual([{ name: "Alice", age: "30" }]);
  });
});
