import { describe, expect, it } from "vitest";
import type { CSVRecord } from "@/core/types.ts";
import { parseBinaryInMain } from "@/parser/execution/main/parseBinaryInMain.ts";

describe("parseBinaryInMain", () => {
  const encoder = new TextEncoder();

  describe("Uint8Array input", () => {
    it("should parse Uint8Array CSV", async () => {
      const csv = "name,age\nAlice,30\nBob,25";
      const binary = encoder.encode(csv);
      const records: CSVRecord<["name", "age"]>[] = [];

      for await (const record of parseBinaryInMain(binary)) {
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

      for await (const record of parseBinaryInMain(binary)) {
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

      for await (const record of parseBinaryInMain(buffer)) {
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

      for await (const record of parseBinaryInMain(binary, {
        delimiter: ";",
      })) {
        records.push(record);
      }

      expect(records).toEqual([{ name: "Alice", age: "30" }]);
    });

    it("should respect charset option", async () => {
      const csv = "name,age\nAlice,30";
      const binary = encoder.encode(csv);
      const records = [];

      for await (const record of parseBinaryInMain(binary, {
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

      for await (const record of parseBinaryInMain(binary, {
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
    const result = parseBinaryInMain(binary);

    expect(typeof result[Symbol.asyncIterator]).toBe("function");
  });
});
