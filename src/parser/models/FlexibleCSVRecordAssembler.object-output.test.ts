import { describe, expect, test, vi } from "vitest";
import { createCSVRecordAssembler } from "@/parser/api/model/createCSVRecordAssembler.ts";
import { FlexibleStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";

describe("CSVRecordAssembler - Object Output", () => {
  describe("columnCountStrategy option", () => {
    describe("fill strategy (default)", () => {
      test("should fill short rows with empty string", () => {
        const csv = `Alice,30
Bob,25,LA`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "object",
          columnCountStrategy: "fill",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(2);
        expect(records[0]).toEqual({
          name: "Alice",
          age: "30",
          city: "",
        }); // Missing field filled with empty string (fill behavior)
        expect(records[1]).toEqual({ name: "Bob", age: "25", city: "LA" }); // Exact match
      });

      test("should fill second row with empty string (regression test)", () => {
        const csv = `Alice,30,NY
Bob,25`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "object",
          columnCountStrategy: "fill",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(2);
        expect(records[0]).toEqual({ name: "Alice", age: "30", city: "NY" }); // Exact match
        expect(records[1]).toEqual({ name: "Bob", age: "25", city: "" }); // Missing field filled with empty string
      });

      test("should ignore extra fields in long rows", () => {
        const csv = `Alice,30,NY,Extra1,Extra2`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["name", "age", "city"] as const,
          outputFormat: "object",
          columnCountStrategy: "fill",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(1);
        expect(records[0]).toEqual({ name: "Alice", age: "30", city: "NY" }); // Extra fields ignored
      });
    });

    describe("sparse strategy", () => {
      test("should throw error because sparse is not allowed for object format", () => {
        expect(() => {
          createCSVRecordAssembler({
            header: ["name", "age", "city"] as const,
            outputFormat: "object",
            columnCountStrategy: "sparse",
          });
        }).toThrow(
          "columnCountStrategy 'sparse' is not allowed for object format",
        );
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

      test("should fill short rows with empty string", () => {
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
          city: "",
        }); // Missing field filled with empty string (object format always fills)
      });
    });

    describe("keep strategy", () => {
      test("should warn and fallback to fill strategy", () => {
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
          city: "",
        }); // Behaves like fill (fills with empty string)

        warnSpy.mockRestore();
      });
    });

    describe("empty fields vs missing fields", () => {
      test("should use empty string for empty fields", () => {
        const csv = `,x,`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["a", "b", "c"] as const,
          outputFormat: "object",
          columnCountStrategy: "fill",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(1);
        expect(records[0]).toEqual({ a: "", b: "x", c: "" }); // Empty fields → ""
      });

      test("should use empty string for missing fields in short rows (object format)", () => {
        const csv = `x`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          header: ["a", "b", "c"] as const,
          outputFormat: "object",
          columnCountStrategy: "fill",
        });

        const records = [...assembler.assemble(tokens)];

        expect(records).toHaveLength(1);
        expect(records[0]).toEqual({ a: "x", b: "", c: "" }); // Missing fields → "" (fill strategy)
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

    test("should throw error when header: [] with object format and columnCountStrategy: 'fill'", () => {
      expect(() =>
        createCSVRecordAssembler({
          header: [] as const,
          outputFormat: "object",
          columnCountStrategy: "fill",
        }),
      ).toThrow(
        /Headerless mode \(header: \[\]\) is not supported for outputFormat: 'object'/,
      );
    });

    test("should throw error when header: [] with object format and columnCountStrategy: 'sparse'", () => {
      expect(() =>
        createCSVRecordAssembler({
          header: [] as const,
          outputFormat: "object",
          columnCountStrategy: "sparse",
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
