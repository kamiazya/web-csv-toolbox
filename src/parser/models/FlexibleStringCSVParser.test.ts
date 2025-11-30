import { assert, beforeEach, describe, expect, test } from "vitest";
import { FlexibleStringArrayCSVParser } from "./FlexibleStringArrayCSVParser.ts";
import { FlexibleStringObjectCSVParser } from "./FlexibleStringObjectCSVParser.ts";

describe("FlexibleStringCSVParser (Object and Array)", () => {
  describe("Object format (default)", () => {
    let parser: FlexibleStringObjectCSVParser<readonly ["name", "age"]>;

    beforeEach(() => {
      parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
      });
    });

    test("should parse CSV string into object records", () => {
      const csv = "Alice,30\nBob,25";
      const records = Array.from(parser.parse(csv));

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    test("should parse empty string", () => {
      const records = Array.from(parser.parse(""));
      expect(records).toEqual([]);
    });

    test("should parse single record", () => {
      const records = Array.from(parser.parse("Alice,30"));
      expect(records).toEqual([{ name: "Alice", age: "30" }]);
    });

    test("should parse with trailing newline", () => {
      const records = Array.from(parser.parse("Alice,30\nBob,25\n"));
      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    test("should handle quoted fields", () => {
      const records = Array.from(
        parser.parse('"Alice Smith",30\n"Bob Jones",25'),
      );
      expect(records).toEqual([
        { name: "Alice Smith", age: "30" },
        { name: "Bob Jones", age: "25" },
      ]);
    });

    test("should handle fields with newlines in quotes", () => {
      const records = Array.from(parser.parse('"Alice\nSmith",30\n"Bob",25'));
      expect(records).toEqual([
        { name: "Alice\nSmith", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });
  });

  describe("Array format", () => {
    let parser: FlexibleStringArrayCSVParser<readonly ["name", "age"]>;

    beforeEach(() => {
      parser = new FlexibleStringArrayCSVParser({
        header: ["name", "age"] as const,
      });
    });

    test("should parse CSV string into array records", () => {
      const csv = "Alice,30\nBob,25";
      const records = Array.from(parser.parse(csv));

      expect(records).toEqual([
        ["Alice", "30"],
        ["Bob", "25"],
      ]);
    });

    test("should parse with includeHeader option", () => {
      const parserWithHeader = new FlexibleStringArrayCSVParser({
        header: ["name", "age"] as const,

        includeHeader: true,
      });

      const csv = "Alice,30\nBob,25";
      const records = Array.from(parserWithHeader.parse(csv));

      expect(records).toEqual([
        ["name", "age"],
        ["Alice", "30"],
        ["Bob", "25"],
      ]);
    });

    test("should preserve undefined for missing fields in array format (with sparse strategy)", () => {
      // In array format with 'sparse' strategy, missing fields are filled with undefined
      const parserWithSparse = new FlexibleStringArrayCSVParser({
        header: ["name", "age", "city"] as const,

        columnCountStrategy: "sparse",
      });

      const records = Array.from(parserWithSparse.parse("Alice,30\nBob"));

      expect(records).toEqual([
        ["Alice", "30", undefined],
        ["Bob", undefined, undefined], // Missing fields → undefined (sparse strategy)
      ]);
    });

    test("should distinguish empty vs missing in array format (sparse strategy)", () => {
      const parserWithSparse = new FlexibleStringArrayCSVParser({
        header: ["name", "age"] as const,

        columnCountStrategy: "sparse",
      });

      // "Bob," has an empty age field → ""
      // "Charlie" has a missing age field → undefined
      const records = Array.from(
        parserWithSparse.parse("Alice,30\nBob,\nCharlie"),
      );

      expect(records).toEqual([
        ["Alice", "30"],
        ["Bob", ""], // empty field → ""
        ["Charlie", undefined], // missing field → undefined (sparse strategy preserves undefined)
      ]);
    });
  });

  describe("Streaming mode", () => {
    let parser: FlexibleStringObjectCSVParser<readonly ["name", "age"]>;

    beforeEach(() => {
      parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
      });
    });

    test("should handle incomplete records with stream: true", () => {
      // First chunk with incomplete record
      const records1 = Array.from(
        parser.parse("Alice,30\nBob,", { stream: true }),
      );
      expect(records1).toEqual([{ name: "Alice", age: "30" }]);

      // Second chunk completes the record
      const records2 = Array.from(parser.parse("25\nCharlie,35"));
      expect(records2).toEqual([
        { name: "Bob", age: "25" },
        { name: "Charlie", age: "35" },
      ]);
    });

    test("should flush incomplete data without stream option", () => {
      const records = Array.from(parser.parse("Alice,30\nBob"));
      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "" }, // Missing field filled with "" (fill strategy default)
      ]);
    });

    test("should fill missing field with empty string in object format", () => {
      // In object format with fill strategy (default), both empty and missing fields are ""
      // "Bob," has an empty age field (present but empty) → ""
      // "Charlie" has a missing age field (row too short) → "" (fill strategy)
      const records = Array.from(parser.parse("Alice,30\nBob,\nCharlie"));
      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "" }, // empty field → ""
        { name: "Charlie", age: "" }, // missing field → "" (fill strategy)
      ]);
    });
  });

  describe("Options validation", () => {
    test("should accept custom delimiter", () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
        delimiter: "\t" as any,
      });

      const records = Array.from(parser.parse("Alice\t30\nBob\t25"));
      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    test("should accept custom quotation", () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
        quotation: "'" as any,
      });

      const records = Array.from(parser.parse("'Alice Smith',30\n'Bob',25"));
      expect(records).toEqual([
        { name: "Alice Smith", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    test("should handle skipEmptyLines option", () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
        skipEmptyLines: true,
      });

      const records = Array.from(parser.parse("Alice,30\n\nBob,25\n\n"));
      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });
  });

  describe("Column count strategy", () => {
    test("should fill short rows with empty string in object format", () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age", "city"] as const,
        columnCountStrategy: "fill",
      });

      const records = Array.from(parser.parse("Alice,30\nBob,25,NYC"));
      expect(records).toEqual([
        { name: "Alice", age: "30", city: "" }, // Missing field filled with empty string (fill strategy)
        { name: "Bob", age: "25", city: "NYC" },
      ]);
    });

    test("should throw error with 'strict' strategy on mismatch", () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
        columnCountStrategy: "strict",
      });

      expect(() => Array.from(parser.parse("Alice,30,extra"))).toThrow();
    });

    test("should truncate long rows with 'truncate' strategy", () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
        columnCountStrategy: "truncate",
      });

      const records = Array.from(parser.parse("Alice,30,extra\nBob,25"));
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
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
        signal: controller.signal,
      });

      controller.abort();

      try {
        Array.from(parser.parse("Alice,30\nBob,25"));
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

      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
        signal: controller.signal,
      });

      controller.abort(new CustomError("Custom abort"));

      expect(() =>
        Array.from(parser.parse("Alice,30")),
      ).toThrowErrorMatchingInlineSnapshot(`[CustomError: Custom abort]`);
    });
  });

  describe("Error handling", () => {
    test("should handle malformed quoted fields", () => {
      const parser = new FlexibleStringObjectCSVParser({
        header: ["name", "age"] as const,
      });

      expect(() => Array.from(parser.parse('"Alice,30'))).toThrow();
    });
  });
});
