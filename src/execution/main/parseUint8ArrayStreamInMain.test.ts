import { describe, expect, it } from "vitest";
import { parseUint8ArrayStreamInMain } from "./parseUint8ArrayStreamInMain.ts";
import type { CSVRecord } from "../../common/types.ts";

// Helper to create ReadableStream from Uint8Array
function createUint8ArrayStream(data: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

describe("parseUint8ArrayStreamInMain", () => {
  const encoder = new TextEncoder();

  it("should parse Uint8Array stream", async () => {
    const csv = "name,age\nAlice,30\nBob,25";
    const binary = encoder.encode(csv);
    const stream = createUint8ArrayStream(binary);
    const records: CSVRecord<["name", "age"]>[] = [];

    for await (const record of parseUint8ArrayStreamInMain(stream)) {
      records.push(record as CSVRecord<["name", "age"]>);
    }

    expect(records).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should handle empty stream", async () => {
    const csv = "name,age";
    const binary = encoder.encode(csv);
    const stream = createUint8ArrayStream(binary);
    const records = [];

    for await (const record of parseUint8ArrayStreamInMain(stream)) {
      records.push(record);
    }

    expect(records).toEqual([]);
  });

  it("should handle chunked stream", async () => {
    const chunks = [
      encoder.encode("name,age\n"),
      encoder.encode("Alice,30\n"),
      encoder.encode("Bob,25"),
    ];

    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const records: CSVRecord<["name", "age"]>[] = [];
    for await (const record of parseUint8ArrayStreamInMain(stream)) {
      records.push(record as CSVRecord<["name", "age"]>);
    }

    expect(records).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should respect delimiter option", async () => {
    const csv = "name;age\nAlice;30";
    const binary = encoder.encode(csv);
    const stream = createUint8ArrayStream(binary);
    const records = [];

    for await (const record of parseUint8ArrayStreamInMain(stream, {
      delimiter: ";",
    })) {
      records.push(record);
    }

    expect(records).toEqual([{ name: "Alice", age: "30" }]);
  });

  it("should respect charset option", async () => {
    const csv = "name,age\nAlice,30";
    const binary = encoder.encode(csv);
    const stream = createUint8ArrayStream(binary);
    const records = [];

    for await (const record of parseUint8ArrayStreamInMain(stream, {
      charset: "utf-8",
    })) {
      records.push(record);
    }

    expect(records).toEqual([{ name: "Alice", age: "30" }]);
  });

  it("should use provided header", async () => {
    const csv = "Alice,30\nBob,25";
    const binary = encoder.encode(csv);
    const stream = createUint8ArrayStream(binary);
    const records: CSVRecord<["name", "age"]>[] = [];

    for await (const record of parseUint8ArrayStreamInMain(stream, {
      header: ["name", "age"],
    })) {
      records.push(record as CSVRecord<["name", "age"]>);
    }

    expect(records).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should return async iterable iterator", async () => {
    const csv = "name,age\nAlice,30";
    const binary = encoder.encode(csv);
    const stream = createUint8ArrayStream(binary);
    const result = parseUint8ArrayStreamInMain(stream);

    expect(typeof result[Symbol.asyncIterator]).toBe("function");
  });
});
