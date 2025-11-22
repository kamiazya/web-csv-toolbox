import { describe, expect, test, vi } from "vitest";
import { createCSVRecordAssembler } from "@/parser/models/createCSVRecordAssembler.ts";
import { FlexibleStringCSVLexer } from "@/parser/models/createStringCSVLexer.ts";

describe("CSVRecordAssembler - Object Output", () => {
  describe("columnCountStrategy option", () => {
    describe("pad strategy (default)", () => {
      test("should pad short rows with undefined", () => {
        const csv = `Alice,30
Bob,25,LA`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "object",
          columnCountStrategy: "pad",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(2);
        expect(records[0]).toEqual({
          name: "Alice",
          age: "30",
          city: undefined,
        }); // Padded
        expect(records[1]).toEqual({ name: "Bob", age: "25", city: "LA" }); // Exact match
      });

      test("should pad second row with undefined (regression test)", () => {
        const csv = `Alice,30,NY
Bob,25`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "object",
          columnCountStrategy: "pad",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(2);
        expect(records[0]).toEqual({ name: "Alice", age: "30", city: "NY" }); // Exact match
        expect(records[1]).toEqual({ name: "Bob", age: "25", city: undefined }); // Padded
      });

      test("should ignore extra fields in long rows", () => {
        const csv = `Alice,30,NY,Extra1,Extra2`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "object",
          columnCountStrategy: "pad",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(1);
        expect(records[0]).toEqual({ name: "Alice", age: "30", city: "NY" }); // Extra fields ignored
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
          outputFormat: "object",
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
          outputFormat: "object",
          columnCountStrategy: "strict",
        });

        expect(() => {
          [...assembler.assemble(tokens)];
        }).toThrow("Expected 3 columns, got 2");
      });

      test("should throw error if row is too long", () => {
        const csv = `Alice,30,NY,Extra`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "object",
          columnCountStrategy: "strict",
        });

        expect(() => {
          [...assembler.assemble(tokens)];
        }).toThrow("Expected 3 columns, got 4");
      });

      test("should not throw error if all rows match header length", () => {
        const csv = `Alice,30,NY
Bob,25,LA`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "object",
          columnCountStrategy: "strict",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(2);
        expect(records[0]).toEqual({ name: "Alice", age: "30", city: "NY" });
        expect(records[1]).toEqual({ name: "Bob", age: "25", city: "LA" });
      });
    });

    describe("truncate strategy", () => {
      test("should truncate long rows to match header length", () => {
        const csv = `Alice,30,NY,Extra`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "object",
          columnCountStrategy: "truncate",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(1);
        expect(records[0]).toEqual({ name: "Alice", age: "30", city: "NY" }); // Truncated
      });

      test("should keep short rows as-is without padding", () => {
        const csv = `Alice,30`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "object",
          columnCountStrategy: "truncate",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(1);
        expect(records[0]).toEqual({
          name: "Alice",
          age: "30",
          city: undefined,
        }); // No padding
      });
    });

    describe("keep strategy", () => {
      test("should warn and fallback to pad strategy", () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const csv = `Alice,30`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "object",
          columnCountStrategy: "keep",
        });

        const records = [...assembler.assemble(tokens)];

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "columnCountStrategy 'keep' has no effect in object format",
          ),
        );
        expect(records).toHaveLength(1);
        expect(records[0]).toEqual({
          name: "Alice",
          age: "30",
          city: undefined,
        }); // Behaves like pad

        warnSpy.mockRestore();
      });
    });

    describe("empty fields vs missing fields", () => {
      test("should distinguish empty fields from missing fields", () => {
        const csv = `,x,`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["a", "b", "c"] as const,
          outputFormat: "object",
          columnCountStrategy: "pad",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(1);
        expect(records[0]).toEqual({ a: "", b: "x", c: "" }); // Empty strings, not undefined
      });

      test("should use undefined for missing fields in short rows", () => {
        const csv = `x`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["a", "b", "c"] as const,
          outputFormat: "object",
          columnCountStrategy: "pad",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(1);
        expect(records[0]).toEqual({ a: "x", b: undefined, c: undefined }); // undefined for missing
      });
    });
  });

  describe("Headerless mode (header: []) - Runtime Validation Errors", () => {
    test("should throw error when header: [] with outputFormat: 'object'", () => {
      // Error should be thrown when creating the assembler (not during assembly)
      // because header is explicitly provided in options
      expect(() =>
        createCSVRecordAssembler({
          header: [] as const,
          outputFormat: "object",
        }),
      ).toThrow(
        /Headerless mode \(header: \[\]\) is not supported for outputFormat: 'object'/,
      );
    });

    test("should throw error when header: [] with object format and columnCountStrategy: 'pad'", () => {
      expect(() =>
        createCSVRecordAssembler({
          header: [] as const,
          outputFormat: "object",
          columnCountStrategy: "pad",
        }),
      ).toThrow(
        /Headerless mode \(header: \[\]\) is not supported for outputFormat: 'object'/,
      );
    });

    test("should throw error when header: [] with object format and columnCountStrategy: 'strict'", () => {
      expect(() =>
        createCSVRecordAssembler({
          header: [] as const,
          outputFormat: "object",
          columnCountStrategy: "strict",
        }),
      ).toThrow(
        /Headerless mode \(header: \[\]\) is not supported for outputFormat: 'object'/,
      );
    });
  });
});
