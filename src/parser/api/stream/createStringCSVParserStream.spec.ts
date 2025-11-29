import { describe as describe_, expect, it as it_ } from "vitest";
import { transform } from "@/__tests__/helper.ts";
import { createStringCSVParserStream } from "@/parser/api/stream/createStringCSVParserStream.ts";
import { StringCSVParserStream } from "@/parser/stream/StringCSVParserStream.ts";

const describe = describe_.concurrent;
const it = it_.concurrent;

describe("createStringCSVParserStream", () => {
  it("should return a StringCSVParserStream instance", () => {
    const stream = createStringCSVParserStream();
    expect(stream).toBeInstanceOf(StringCSVParserStream);
    expect(stream).toBeInstanceOf(TransformStream);
  });

  it("should parse CSV with header from data", async () => {
    const stream = createStringCSVParserStream();
    const chunks = ["name,age\r\n", "Alice,30\r\n", "Bob,25\r\n"];

    const records = await transform(stream, chunks);
    expect(records).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should parse CSV with predefined header", async () => {
    const stream = createStringCSVParserStream({
      header: ["name", "age"] as const,
    });
    const chunks = ["Alice,30\r\n", "Bob,25\r\n"];

    const records = await transform(stream, chunks);
    expect(records).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should parse CSV with array output format", async () => {
    const stream = createStringCSVParserStream({
      outputFormat: "array",
    });
    const chunks = ["name,age\r\n", "Alice,30\r\n", "Bob,25\r\n"];

    const records = await transform(stream, chunks);
    expect(records).toEqual([
      ["Alice", "30"],
      ["Bob", "25"],
    ]);
  });

  it("should parse TSV with custom delimiter", async () => {
    const stream = createStringCSVParserStream({
      delimiter: "\t",
    });
    const chunks = ["name\tage\r\n", "Alice\t30\r\n", "Bob\t25\r\n"];

    const records = await transform(stream, chunks);
    expect(records).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should parse CSV with custom quotation", async () => {
    const stream = createStringCSVParserStream({
      quotation: "'",
    });
    const chunks = ["name,age\r\n", "'Alice',30\r\n", "'Bob',25\r\n"];

    const records = await transform(stream, chunks);
    expect(records).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should accept stream options", () => {
    const stream = createStringCSVParserStream(
      {},
      { backpressureCheckInterval: 50 },
    );
    expect(stream).toBeInstanceOf(StringCSVParserStream);
  });

  it("should accept custom queuing strategies", () => {
    const writableStrategy: QueuingStrategy<string> = {
      highWaterMark: 131072,
      size: (chunk) => chunk.length,
    };
    const readableStrategy = new CountQueuingStrategy({ highWaterMark: 512 });

    const stream = createStringCSVParserStream(
      {},
      {},
      writableStrategy,
      readableStrategy,
    );
    expect(stream).toBeInstanceOf(StringCSVParserStream);
  });

  it("should handle quoted fields with newlines", async () => {
    const stream = createStringCSVParserStream();
    const chunks = ['name,description\r\n', '"Alice","Hello\r\nWorld"\r\n'];

    const records = await transform(stream, chunks);
    expect(records).toEqual([{ name: "Alice", description: "Hello\r\nWorld" }]);
  });

  it("should handle escaped quotes", async () => {
    const stream = createStringCSVParserStream();
    const chunks = ['name,quote\r\n', '"Alice","She said ""Hello"""\r\n'];

    const records = await transform(stream, chunks);
    expect(records).toEqual([
      { name: "Alice", quote: 'She said "Hello"' },
    ]);
  });
});
