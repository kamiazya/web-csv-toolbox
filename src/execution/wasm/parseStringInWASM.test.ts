import { describe, expect, it } from "vitest";
import { parseStringInWASM } from "./parseStringInWASM.ts";
import type { CSVRecord } from "../../common/types.ts";

describe.skip("parseStringInWASM", () => {
  it("should parse simple CSV string", async () => {
    const csv = "name,age\nAlice,30\nBob,25";
    const iterator = await parseStringInWASM(csv);
    const records: CSVRecord<["name", "age"]>[] = [];

    for await (const record of iterator) {
      records.push(record as CSVRecord<["name", "age"]>);
    }

    expect(records).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should handle empty CSV", async () => {
    const csv = "name,age";
    const iterator = await parseStringInWASM(csv);
    const records = [];

    for await (const record of iterator) {
      records.push(record);
    }

    expect(records).toEqual([]);
  });

  it("should respect delimiter option", async () => {
    const csv = "name;age\nAlice;30";
    const iterator = await parseStringInWASM(csv, { delimiter: ";" });
    const records = [];

    for await (const record of iterator) {
      records.push(record);
    }

    expect(records).toEqual([{ name: "Alice", age: "30" }]);
  });

  it("should use provided header", async () => {
    const csv = "Alice,30\nBob,25";
    const iterator = await parseStringInWASM(csv, {
      header: ["name", "age"],
    });
    const records: CSVRecord<["name", "age"]>[] = [];

    for await (const record of iterator) {
      records.push(record as CSVRecord<["name", "age"]>);
    }

    expect(records).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should return async iterable iterator wrapped in Promise", async () => {
    const csv = "name,age\nAlice,30";
    const result = parseStringInWASM(csv);

    expect(result).toBeInstanceOf(Promise);

    const iterator = await result;
    expect(typeof iterator[Symbol.asyncIterator]).toBe("function");
  });

  it("should handle quoted values with default quotation", async () => {
    const csv = 'name,value\n"Alice","test value"';
    const iterator = await parseStringInWASM(csv);
    const records = [];

    for await (const record of iterator) {
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

    const iterator = await parseStringInWASM(csv);
    const records = [];

    for await (const record of iterator) {
      records.push(record);
    }

    expect(records).toHaveLength(100);
    expect(records[0]).toEqual({ name: "Person0", age: "20" });
    expect(records[99]).toEqual({ name: "Person99", age: "119" });
  });
});
