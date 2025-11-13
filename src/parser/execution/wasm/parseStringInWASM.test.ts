import { beforeAll, describe, expect, it } from "vitest";
import type { CSVRecord } from "../../../core/types.ts";
import { loadWASM } from "../../../wasm/loadWASM.ts";
import { parseStringInWASM } from "./parseStringInWASM.ts";

describe("parseStringInWASM", () => {
  beforeAll(async () => {
    await loadWASM();
  });
  it("should parse simple CSV string", async () => {
    const csv = "name,age\nAlice,30\nBob,25";
    const records: CSVRecord<["name", "age"]>[] = [];

    for await (const record of parseStringInWASM(csv)) {
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

    for await (const record of parseStringInWASM(csv)) {
      records.push(record);
    }

    expect(records).toEqual([]);
  });

  it("should respect delimiter option", async () => {
    const csv = "name;age\nAlice;30";
    const records = [];

    for await (const record of parseStringInWASM(csv, { delimiter: ";" })) {
      records.push(record);
    }

    expect(records).toEqual([{ name: "Alice", age: "30" }]);
  });

  it("should use provided header", async () => {
    const csv = "Alice,30\nBob,25";
    const records: CSVRecord<["name", "age"]>[] = [];

    for await (const record of parseStringInWASM(csv, {
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
    const result = parseStringInWASM(csv);

    expect(typeof result[Symbol.asyncIterator]).toBe("function");
  });

  it("should handle quoted values with default quotation", async () => {
    const csv = 'name,value\n"Alice","test value"';
    const records = [];

    for await (const record of parseStringInWASM(csv)) {
      records.push(record);
    }

    expect(records).toEqual([{ name: "Alice", value: "test value" }]);
  });

  it("should handle large CSV", async () => {
    const rows = ["name,age"];
    for (let i = 0; i < 100; i++) {
      rows.push(`Person${i},${20 + i}`);
    }
    const csv = rows.join("\n");
    const records = [];

    for await (const record of parseStringInWASM(csv)) {
      records.push(record);
    }

    expect(records).toHaveLength(100);
    expect(records[0]).toEqual({ name: "Person0", age: "20" });
    expect(records[99]).toEqual({ name: "Person99", age: "119" });
  });
});
