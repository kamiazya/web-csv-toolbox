import { describe, expect, it } from "vitest";
import type { CSVRecord } from "@/core/types.ts";
import { parseStreamInMain } from "@/parser/execution/main/parseStreamInMain.ts";

// Helper to create ReadableStream from string
function createStringStream(str: string): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(str);
      controller.close();
    },
  });
}

describe("parseStreamInMain", () => {
  it("should parse string stream", async () => {
    const csv = "name,age\nAlice,30\nBob,25";
    const stream = createStringStream(csv);
    const records: CSVRecord<["name", "age"]>[] = [];

    for await (const record of parseStreamInMain(stream)) {
      records.push(record as CSVRecord<["name", "age"]>);
    }

    expect(records).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should handle empty stream", async () => {
    const csv = "name,age";
    const stream = createStringStream(csv);
    const records = [];

    for await (const record of parseStreamInMain(stream)) {
      records.push(record);
    }

    expect(records).toEqual([]);
  });

  it("should handle chunked stream", async () => {
    const chunks = ["name,age\n", "Alice,30\n", "Bob,25"];
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const records: CSVRecord<["name", "age"]>[] = [];
    for await (const record of parseStreamInMain(stream)) {
      records.push(record as CSVRecord<["name", "age"]>);
    }

    expect(records).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should respect delimiter option", async () => {
    const csv = "name;age\nAlice;30";
    const stream = createStringStream(csv);
    const records = [];

    for await (const record of parseStreamInMain(stream, { delimiter: ";" })) {
      records.push(record);
    }

    expect(records).toEqual([{ name: "Alice", age: "30" }]);
  });

  it("should respect quotation option", async () => {
    const csv = "name,value\n'Alice','test'";
    const stream = createStringStream(csv);
    const records = [];

    for await (const record of parseStreamInMain(stream, { quotation: "'" })) {
      records.push(record);
    }

    expect(records).toEqual([{ name: "Alice", value: "test" }]);
  });

  it("should use provided header", async () => {
    const csv = "Alice,30\nBob,25";
    const stream = createStringStream(csv);
    const records: CSVRecord<["name", "age"]>[] = [];

    for await (const record of parseStreamInMain(stream, {
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
    const stream = createStringStream(csv);
    const result = parseStreamInMain(stream);

    expect(typeof result[Symbol.asyncIterator]).toBe("function");
  });
});
