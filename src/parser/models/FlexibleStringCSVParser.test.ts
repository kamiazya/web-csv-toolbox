import { assert, beforeEach, describe, expect, test } from "vitest";
import { FlexibleStringCSVParser } from "./FlexibleStringCSVParser.ts";

describe("FlexibleStringCSVParser", () => {
  describe("Object format (default)", () => {
    let parser: FlexibleStringCSVParser<readonly ["name", "age"]>;

    beforeEach(() => {
      parser = new FlexibleStringCSVParser({
        header: ["name", "age"] as const,
      });
    });

    test("should parse CSV string into object records", () => {
      const csv = "Alice,30\nBob,25";
      const records = parser.parse(csv);

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    test("should parse empty string", () => {
      const records = parser.parse("");
      expect(records).toEqual([]);
    });

    test("should parse single record", () => {
      const records = parser.parse("Alice,30");
      expect(records).toEqual([{ name: "Alice", age: "30" }]);
    });

    test("should parse with trailing newline", () => {
      const records = parser.parse("Alice,30\nBob,25\n");
      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    test("should handle quoted fields", () => {
      const records = parser.parse('"Alice Smith",30\n"Bob Jones",25');
      expect(records).toEqual([
        { name: "Alice Smith", age: "30" },
        { name: "Bob Jones", age: "25" },
      ]);
    });

    test("should handle fields with newlines in quotes", () => {
      const records = parser.parse('"Alice\nSmith",30\n"Bob",25');
      expect(records).toEqual([
        { name: "Alice\nSmith", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });
  });

  describe("Array format", () => {
    let parser: FlexibleStringCSVParser<readonly ["name", "age"]>;

    beforeEach(() => {
      parser = new FlexibleStringCSVParser({
        header: ["name", "age"] as const,
        outputFormat: "array",
      });
    });

    test("should parse CSV string into array records", () => {
      const csv = "Alice,30\nBob,25";
      const records = parser.parse(csv);

      expect(records).toEqual([
        ["Alice", "30"],
        ["Bob", "25"],
      ]);
    });

    test("should parse with includeHeader option", () => {
      const parserWithHeader = new FlexibleStringCSVParser({
        header: ["name", "age"] as const,
        outputFormat: "array",
        includeHeader: true,
      });

      const csv = "Alice,30\nBob,25";
      const records = parserWithHeader.parse(csv);

      expect(records).toEqual([
        ["name", "age"],
        ["Alice", "30"],
        ["Bob", "25"],
      ]);
    });

    test("should preserve undefined for missing fields in array format (with pad strategy)", () => {
      // In array format with 'pad' strategy, missing fields are filled with undefined
      const parserWithPad = new FlexibleStringCSVParser({
        header: ["name", "age", "city"] as const,
        outputFormat: "array",
        columnCountStrategy: "pad",
      });

      const records = parserWithPad.parse("Alice,30\nBob");

      expect(records).toEqual([
        ["Alice", "30", undefined],
        ["Bob", undefined, undefined], // Missing fields → undefined (array format behavior)
      ]);
    });

    test("should distinguish empty vs missing in array format", () => {
      const parserWithPad = new FlexibleStringCSVParser({
        header: ["name", "age"] as const,
        outputFormat: "array",
        columnCountStrategy: "pad",
      });

      // "Bob," has an empty age field → ""
      // "Charlie" has a missing age field → undefined
      const records = parserWithPad.parse("Alice,30\nBob,\nCharlie");

      expect(records).toEqual([
        ["Alice", "30"],
        ["Bob", ""],       // empty field → ""
        ["Charlie", undefined], // missing field → undefined (array format preserves undefined)
      ]);
    });
  });

  describe("Streaming mode", () => {
    let parser: FlexibleStringCSVParser<readonly ["name", "age"]>;

    beforeEach(() => {
      parser = new FlexibleStringCSVParser({
        header: ["name", "age"] as const,
      });
    });

    test("should handle incomplete records with stream: true", () => {
      // First chunk with incomplete record
      const records1 = parser.parse("Alice,30\nBob,", { stream: true });
      expect(records1).toEqual([{ name: "Alice", age: "30" }]);

      // Second chunk completes the record
      const records2 = parser.parse("25\nCharlie,35");
      expect(records2).toEqual([
        { name: "Bob", age: "25" },
        { name: "Charlie", age: "35" },
      ]);
    });

    test("should flush incomplete data without stream option", () => {
      const records = parser.parse("Alice,30\nBob");
      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: undefined }, // Missing field remains undefined
      ]);
    });

    test("should distinguish empty field from missing field in object format", () => {
      // In object format, empty fields stay "", missing fields remain undefined
      // "Bob," has an empty age field (present but empty) → ""
      // "Charlie" has a missing age field (row too short) → undefined
      const records = parser.parse("Alice,30\nBob,\nCharlie");
      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "" },      // empty field → ""
        { name: "Charlie", age: undefined },  // missing field → undefined
      ]);
    });
  });

  describe("Options validation", () => {
    test("should accept custom delimiter", () => {
      const parser = new FlexibleStringCSVParser({
        header: ["name", "age"] as const,
        delimiter: "\t" as any,
      });

      const records = parser.parse("Alice\t30\nBob\t25");
      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    test("should accept custom quotation", () => {
      const parser = new FlexibleStringCSVParser({
        header: ["name", "age"] as const,
        quotation: "'" as any,
      });

      const records = parser.parse("'Alice Smith',30\n'Bob',25");
      expect(records).toEqual([
        { name: "Alice Smith", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    test("should handle skipEmptyLines option", () => {
      const parser = new FlexibleStringCSVParser({
        header: ["name", "age"] as const,
        skipEmptyLines: true,
      });

      const records = parser.parse("Alice,30\n\nBob,25\n\n");
      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });
  });

  describe("Column count strategy", () => {
    test("should pad short rows with undefined in object format", () => {
      const parser = new FlexibleStringCSVParser({
        header: ["name", "age", "city"] as const,
        columnCountStrategy: "pad",
      });

      const records = parser.parse("Alice,30\nBob,25,NYC");
      expect(records).toEqual([
        { name: "Alice", age: "30", city: undefined }, // Missing field filled with undefined
        { name: "Bob", age: "25", city: "NYC" },
      ]);
    });

    test("should throw error with 'strict' strategy on mismatch", () => {
      const parser = new FlexibleStringCSVParser({
        header: ["name", "age"] as const,
        columnCountStrategy: "strict",
      });

      expect(() => parser.parse("Alice,30,extra")).toThrow();
    });

    test("should truncate long rows with 'truncate' strategy", () => {
      const parser = new FlexibleStringCSVParser({
        header: ["name", "age"] as const,
        columnCountStrategy: "truncate",
      });

      const records = parser.parse("Alice,30,extra\nBob,25");
      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });
  });

  describe("AbortSignal support", () => {
    let controller: AbortController;

    beforeEach(() => {
      controller = new AbortController();
    });

    test("should throw AbortError when signal is aborted", () => {
      const parser = new FlexibleStringCSVParser({
        header: ["name", "age"] as const,
        signal: controller.signal,
      });

      controller.abort();

      try {
        parser.parse("Alice,30\nBob,25");
        expect.unreachable();
      } catch (error) {
        assert(error instanceof DOMException);
        expect(error.name).toBe("AbortError");
      }
    });

    test("should throw custom error when aborted with reason", () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "CustomError";
        }
      }

      const parser = new FlexibleStringCSVParser({
        header: ["name", "age"] as const,
        signal: controller.signal,
      });

      controller.abort(new CustomError("Custom abort"));

      expect(() => parser.parse("Alice,30")).toThrowErrorMatchingInlineSnapshot(
        `[CustomError: Custom abort]`,
      );
    });
  });

  describe("Error handling", () => {
    test("should handle malformed quoted fields", () => {
      const parser = new FlexibleStringCSVParser({
        header: ["name", "age"] as const,
      });

      expect(() => parser.parse('"Alice,30')).toThrow();
    });
  });
});
