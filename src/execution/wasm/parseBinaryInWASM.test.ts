import { describe, expect, it } from "vitest";
import { parseBinaryInWASM } from "./parseBinaryInWASM.ts";
import type { CSVRecord } from "../../common/types.ts";

describe.skip("parseBinaryInWASM", () => {
  const encoder = new TextEncoder();

  describe("Uint8Array input", () => {
    it("should parse Uint8Array CSV", async () => {
      const csv = "name,age\nAlice,30\nBob,25";
      const binary = encoder.encode(csv);
      const records: CSVRecord<["name", "age"]>[] = [];

      for await (const record of parseBinaryInWASM(binary)) {
        records.push(record as CSVRecord<["name", "age"]>);
      }

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("should handle empty Uint8Array CSV", async () => {
      const csv = "name,age";
      const binary = encoder.encode(csv);
      const records = [];

      for await (const record of parseBinaryInWASM(binary)) {
        records.push(record);
      }

      expect(records).toEqual([]);
    });
  });

  describe("ArrayBuffer input", () => {
    it("should parse ArrayBuffer CSV", async () => {
      const csv = "name,age\nAlice,30";
      const buffer = encoder.encode(csv).buffer;
      const records: CSVRecord<["name", "age"]>[] = [];

      for await (const record of parseBinaryInWASM(buffer)) {
        records.push(record as CSVRecord<["name", "age"]>);
      }

      expect(records).toEqual([{ name: "Alice", age: "30" }]);
    });
  });

  describe("Options", () => {
    it("should respect delimiter option", async () => {
      const csv = "name;age\nAlice;30";
      const binary = encoder.encode(csv);
      const records = [];

      for await (const record of parseBinaryInWASM(binary, {
        delimiter: ";",
      })) {
        records.push(record);
      }

      expect(records).toEqual([{ name: "Alice", age: "30" }]);
    });

    it("should respect charset option (utf-8 default)", async () => {
      const csv = "name,age\nAlice,30";
      const binary = encoder.encode(csv);
      const records = [];

      for await (const record of parseBinaryInWASM(binary, {
        charset: "utf-8",
      })) {
        records.push(record);
      }

      expect(records).toEqual([{ name: "Alice", age: "30" }]);
    });

    it("should use provided header", async () => {
      const csv = "Alice,30\nBob,25";
      const binary = encoder.encode(csv);
      const records: CSVRecord<["name", "age"]>[] = [];

      for await (const record of parseBinaryInWASM(binary, {
        header: ["name", "age"],
      })) {
        records.push(record as CSVRecord<["name", "age"]>);
      }

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });
  });

  it("should return async iterable iterator", async () => {
    const csv = "name,age\nAlice,30";
    const binary = encoder.encode(csv);
    const result = parseBinaryInWASM(binary);

    expect(typeof result[Symbol.asyncIterator]).toBe("function");
  });

  it("should handle quoted values", async () => {
    const csv = 'name,value\n"Alice","test value"';
    const binary = encoder.encode(csv);
    const records = [];

    for await (const record of parseBinaryInWASM(binary)) {
      records.push(record);
    }

    expect(records).toEqual([{ name: "Alice", value: "test value" }]);
  });

  it("should handle large binary data", async () => {
    const rows = ["name,age"];
    for (let i = 0; i < 100; i++) {
      rows.push(`Person${i},${20 + i}`);
    }
    const csv = rows.join("\n");
    const binary = encoder.encode(csv);
    const records = [];

    for await (const record of parseBinaryInWASM(binary)) {
      records.push(record);
    }

    expect(records).toHaveLength(100);
    expect(records[0]).toEqual({ name: "Person0", age: "20" });
    expect(records[99]).toEqual({ name: "Person99", age: "119" });
  });
});
