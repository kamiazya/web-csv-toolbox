import { describe, expect, it } from "vitest";
import { parseStringInMain } from "./parseStringInMain.ts";
import type { CSVRecord } from "../../common/types.ts";

describe("parseStringInMain", () => {
  it("should parse simple CSV string", async () => {
    const csv = "name,age\nAlice,30\nBob,25";
    const records: CSVRecord<["name", "age"]>[] = [];

    for await (const record of parseStringInMain(csv)) {
      records.push(record as CSVRecord<["name", "age"]>);
    }

    expect(records).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should handle empty CSV", async () => {
    const csv = "name,age";
    const records = [];

    for await (const record of parseStringInMain(csv)) {
      records.push(record);
    }

    expect(records).toEqual([]);
  });

  it("should respect delimiter option", async () => {
    const csv = "name;age\nAlice;30";
    const records = [];

    for await (const record of parseStringInMain(csv, { delimiter: ";" })) {
      records.push(record);
    }

    expect(records).toEqual([{ name: "Alice", age: "30" }]);
  });

  it("should respect quotation option", async () => {
    const csv = "name,value\n'Alice','test'";
    const records = [];

    for await (const record of parseStringInMain(csv, { quotation: "'" })) {
      records.push(record);
    }

    expect(records).toEqual([{ name: "Alice", value: "test" }]);
  });

  it("should use provided header", async () => {
    const csv = "Alice,30\nBob,25";
    const records: CSVRecord<["name", "age"]>[] = [];

    for await (const record of parseStringInMain(csv, {
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
    const result = parseStringInMain(csv);

    expect(typeof result[Symbol.asyncIterator]).toBe("function");
  });
});
