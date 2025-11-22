import { describe, expect, test } from "vitest";
import { FlexibleStringCSVLexer } from "@/parser/models/createStringCSVLexer.ts";
import { createCSVRecordAssembler } from "@/parser/models/createCSVRecordAssembler.ts";

describe("CSVRecordAssembler - Array Output Format", () => {
  describe("outputFormat option", () => {
    test("should output array format when outputFormat is 'array'", () => {
      const csv = `name,age,city
Alice,30,NY
Bob,25,LA`;

      const lexer = new FlexibleStringCSVLexer();
      const tokens = lexer.lex(csv);

      const assembler = createCSVRecordAssembler({
        outputFormat: "array",
      });

      const records = [...assembler.assemble(tokens)];

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual(["Alice", "30", "NY"]);
      expect(records[1]).toEqual(["Bob", "25", "LA"]);
    });

    test("should output object format by default", () => {
      const csv = `name,age
Alice,30`;

      const lexer = new FlexibleStringCSVLexer();
      const tokens = lexer.lex(csv);

      const assembler = createCSVRecordAssembler();

      const records = [...assembler.assemble(tokens)];

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ name: "Alice", age: "30" });
    });

    test("should support named tuple with header", () => {
      const csv = `Alice,30,NY
Bob,25,LA`;

      const lexer = new FlexibleStringCSVLexer();
      const tokens = lexer.lex(csv);

      const assembler = createCSVRecordAssembler({
        header: ["name", "age", "city"] as const,
        outputFormat: "array",
      });

      const records = [...assembler.assemble(tokens)];

      expect(records).toHaveLength(2);
      expect(records[0]).toEqual(["Alice", "30", "NY"]);
      expect(records[1]).toEqual(["Bob", "25", "LA"]);
      // Type should be: readonly [name: string, age: string, city: string]
      if (Array.isArray(records[0])) {
        expect(records[0].length).toBe(3);
      }
    });
  });

  describe("includeHeader option", () => {
    test("should include header row when includeHeader is true", () => {
      const csv = `Alice,30,NY
Bob,25,LA`;

      const lexer = new FlexibleStringCSVLexer();
      const tokens = lexer.lex(csv);

      const assembler = createCSVRecordAssembler({
        header: ["name", "age", "city"] as const,
        outputFormat: "array",
        includeHeader: true,
      });

      const records = [...assembler.assemble(tokens)];

      expect(records).toHaveLength(3);
      expect(records[0]).toEqual(["name", "age", "city"]); // Header row
      expect(records[1]).toEqual(["Alice", "30", "NY"]);
      expect(records[2]).toEqual(["Bob", "25", "LA"]);
    });

    test("should not include header row by default", () => {
      const csv = `Alice,30,NY`;

      const lexer = new FlexibleStringCSVLexer();
      const tokens = lexer.lex(csv);

      const assembler = createCSVRecordAssembler({
        header: ["name", "age", "city"] as const,
        outputFormat: "array",
      });

      const records = [...assembler.assemble(tokens)];

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual(["Alice", "30", "NY"]);
    });

    test("should throw error if includeHeader is used with object format", () => {
      expect(() => {
        createCSVRecordAssembler({
          header: ["name", "age"] as const,
          includeHeader: true,
          outputFormat: "object",
        });
      }).toThrow("includeHeader option is only valid for array format");
    });
  });

  describe("columnCountStrategy option", () => {
    describe("keep strategy (default)", () => {
      test("should keep rows as-is with their actual length", () => {
        const csv = `Alice,30
Bob,25,LA
Charlie,35,SF,Extra`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "array",
          columnCountStrategy: "keep",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(3);
        expect(records[0]).toEqual(["Alice", "30"]); // Short row
        expect(records[1]).toEqual(["Bob", "25", "LA"]); // Exact match
        expect(records[2]).toEqual(["Charlie", "35", "SF", "Extra"]); // Long row
      });
    });

    describe("pad strategy", () => {
      test("should pad short rows with undefined", () => {
        const csv = `Alice,30
Bob,25,LA`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "array",
          columnCountStrategy: "pad",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(2);
        expect(records[0]).toEqual(["Alice", "30", undefined]); // Padded
        expect(records[1]).toEqual(["Bob", "25", "LA"]); // Exact match
      });

      test("should pad second row with undefined (regression test)", () => {
        const csv = `Alice,30,NY
Bob,25`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "array",
          columnCountStrategy: "pad",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(2);
        expect(records[0]).toEqual(["Alice", "30", "NY"]); // Exact match
        expect(records[1]).toEqual(["Bob", "25", undefined]); // Padded
      });

      test("should truncate long rows to match header length", () => {
        const csv = `Alice,30,NY,Extra1,Extra2`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "array",
          columnCountStrategy: "pad",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(1);
        expect(records[0]).toEqual(["Alice", "30", "NY"]); // Truncated
      });
    });

    describe("strict strategy", () => {
      test("should throw error if row length doesn't match header length", () => {
        const csv = `Alice,30
Bob,25,LA`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "array",
          columnCountStrategy: "strict",
        });

        expect(() => {
          [...assembler.assemble(tokens)];
        }).toThrow("Expected 3 columns, got 2");
      });

      test("should throw error if second row is short (regression test)", () => {
        const csv = `Alice,30,NY
Bob,25`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "array",
          columnCountStrategy: "strict",
        });

        expect(() => {
          [...assembler.assemble(tokens)];
        }).toThrow("Expected 3 columns, got 2");
      });

      test("should not throw error if all rows match header length", () => {
        const csv = `Alice,30,NY
Bob,25,LA`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "array",
          columnCountStrategy: "strict",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(2);
        expect(records[0]).toEqual(["Alice", "30", "NY"]);
        expect(records[1]).toEqual(["Bob", "25", "LA"]);
      });
    });

    describe("truncate strategy", () => {
      test("should truncate long rows to match header length", () => {
        const csv = `Alice,30,NY,Extra`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "array",
          columnCountStrategy: "truncate",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(1);
        expect(records[0]).toEqual(["Alice", "30", "NY"]); // Truncated
      });

      test("should keep short rows as-is", () => {
        const csv = `Alice,30`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "array",
          columnCountStrategy: "truncate",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(1);
        expect(records[0]).toEqual(["Alice", "30"]); // Not padded
      });
    });

    test("should throw error if columnCountStrategy is used without header", () => {
      expect(() => {
        createCSVRecordAssembler({
          outputFormat: "array",
          columnCountStrategy: "pad",
        });
      }).toThrow("columnCountStrategy 'pad' requires header option");
    });
  });

  describe("variable-length CSV (headerless)", () => {
    test("should handle variable-length rows without header", () => {
      const csv = `Alice,30
Bob,25,LA
Charlie,35,SF,Extra`;

      const lexer = new FlexibleStringCSVLexer();
      const tokens = lexer.lex(csv);

      const assembler = createCSVRecordAssembler({
        outputFormat: "array",
      });

      const records = [...assembler.assemble(tokens)];

      // First row becomes header
      expect(records).toHaveLength(2);
      expect(records[0]).toEqual(["Bob", "25", "LA"]);
      expect(records[1]).toEqual(["Charlie", "35", "SF", "Extra"]);
    });
  });
});
