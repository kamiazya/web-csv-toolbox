import { describe, expect, it } from "vitest";
import type { CSVRecord } from "../common/types.ts";
import { parseString } from "../parseString.ts";

describe("Execution Router", () => {
  const csvData = `name,age
Alice,30
Bob,25`;

  describe("parseString with execution strategies", () => {
    it("should parse CSV in main thread (default)", async () => {
      const records: CSVRecord<["name", "age"]>[] = [];
      for await (const record of parseString(csvData)) {
        records.push(record as CSVRecord<["name", "age"]>);
      }

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({ name: "Alice", age: "30" });
      expect(records[1]).toEqual({ name: "Bob", age: "25" });
    });

    it("should parse CSV in main thread with empty execution array", async () => {
      const records: CSVRecord<["name", "age"]>[] = [];
      for await (const record of parseString(csvData, { execution: [] })) {
        records.push(record as CSVRecord<["name", "age"]>);
      }

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({ name: "Alice", age: "30" });
      expect(records[1]).toEqual({ name: "Bob", age: "25" });
    });

    // Note: Worker and WASM tests require proper environment setup
    // These are integration tests that should be run in appropriate environments
    it.skip("should parse CSV in worker thread", async () => {
      const records: CSVRecord<["name", "age"]>[] = [];
      for await (const record of parseString(csvData, {
        execution: ["worker"],
      })) {
        records.push(record as CSVRecord<["name", "age"]>);
      }

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({ name: "Alice", age: "30" });
      expect(records[1]).toEqual({ name: "Bob", age: "25" });
    });

    it.skip("should parse CSV with WASM in main thread", async () => {
      const records: CSVRecord<["name", "age"]>[] = [];
      for await (const record of parseString(csvData, {
        execution: ["wasm"],
      })) {
        records.push(record as CSVRecord<["name", "age"]>);
      }

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({ name: "Alice", age: "30" });
      expect(records[1]).toEqual({ name: "Bob", age: "25" });
    });

    it.skip("should parse CSV with WASM in worker thread", async () => {
      const records: CSVRecord<["name", "age"]>[] = [];
      for await (const record of parseString(csvData, {
        execution: ["worker", "wasm"],
      })) {
        records.push(record as CSVRecord<["name", "age"]>);
      }

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({ name: "Alice", age: "30" });
      expect(records[1]).toEqual({ name: "Bob", age: "25" });
    });
  });

  describe("backward compatibility", () => {
    it("should maintain backward compatibility with no execution option", async () => {
      const records: CSVRecord<["name", "age"]>[] = [];

      // This should work exactly as before
      for await (const record of parseString(csvData)) {
        records.push(record as CSVRecord<["name", "age"]>);
      }

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({ name: "Alice", age: "30" });
    });

    it("should maintain backward compatibility with other options", async () => {
      const csvDataWithSemicolon = `name;age
Alice;30
Bob;25`;

      const records: CSVRecord<["name", "age"]>[] = [];

      for await (const record of parseString(csvDataWithSemicolon, {
        delimiter: ";",
      })) {
        records.push(record as CSVRecord<["name", "age"]>);
      }

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({ name: "Alice", age: "30" });
    });
  });
});
