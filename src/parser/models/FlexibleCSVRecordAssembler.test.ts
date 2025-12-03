import { assert, beforeEach, describe, expect, test } from "vitest";
import { Delimiter } from "@/core/constants.ts";
import type { AnyToken, CSVRecordAssembler } from "@/core/types.ts";
import { createCSVRecordAssembler } from "@/parser/api/model/createCSVRecordAssembler.ts";
import { FlexibleStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";

describe("CSVRecordAssembler", () => {
  describe("constructor validation", () => {
    test("should throw RangeError if maxFieldCount is negative", () => {
      expect(() => createCSVRecordAssembler({ maxFieldCount: -1 })).toThrow(
        RangeError,
      );
    });

    test("should throw RangeError if maxFieldCount is zero", () => {
      expect(() => createCSVRecordAssembler({ maxFieldCount: 0 })).toThrow(
        RangeError,
      );
    });

    test("should throw RangeError if maxFieldCount is not an integer", () => {
      expect(() => createCSVRecordAssembler({ maxFieldCount: 1.5 })).toThrow(
        RangeError,
      );
    });

    test("should throw RangeError if maxFieldCount is NaN", () => {
      expect(() =>
        createCSVRecordAssembler({ maxFieldCount: Number.NaN }),
      ).toThrow(RangeError);
    });

    test("should accept Number.POSITIVE_INFINITY as maxFieldCount", () => {
      expect(() =>
        createCSVRecordAssembler({
          maxFieldCount: Number.POSITIVE_INFINITY,
        }),
      ).not.toThrow();
    });
  });

  describe("when AbortSignal is provided", () => {
    let assembler: CSVRecordAssembler<readonly string[]>;
    let controller: AbortController;

    beforeEach(() => {
      controller = new AbortController();
      assembler = createCSVRecordAssembler({
        signal: controller.signal,
      });
    });
    test("should throw DOMException named AbortError if the signal is aborted", () => {
      controller.abort();
      const tokens: AnyToken[] = [
        {
          value: "",
          delimiter: Delimiter.Record,
          delimiterLength: 0,
          location: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 1, offset: 0 },
            rowNumber: 1,
          },
        },
      ];
      try {
        [...assembler.assemble(tokens)];
        expect.unreachable();
      } catch (error) {
        assert(error instanceof DOMException);
        expect(error.name).toBe("AbortError");
      }
    });

    test("should throw custom error if the signal is aborted with custom reason", () => {
      class MyCustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "MyCustomError";
        }
      }

      controller.abort(new MyCustomError("Custom reason"));

      const tokens: AnyToken[] = [
        {
          value: "",
          delimiter: Delimiter.Record,
          delimiterLength: 0,
          location: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 1, offset: 0 },
            rowNumber: 1,
          },
        },
      ];
      expect(() => {
        [...assembler.assemble(tokens)];
      }).toThrowErrorMatchingInlineSnapshot(`[MyCustomError: Custom reason]`);
    });
  });

  test("should throw DOMException named TimeoutError if the signal is aborted with timeout", async () => {
    function waitAbort(signal: AbortSignal) {
      return new Promise<void>((resolve) => {
        signal.addEventListener("abort", () => {
          resolve();
        });
      });
    }
    const signal = AbortSignal.timeout(0);
    await waitAbort(signal);
    const assembler = createCSVRecordAssembler({ signal });
    const tokens: AnyToken[] = [
      {
        value: "",
        delimiter: Delimiter.Record,
        delimiterLength: 0,
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 1, offset: 0 },
          rowNumber: 1,
        },
      },
    ];
    try {
      [...assembler.assemble(tokens)];
      expect.unreachable();
    } catch (error) {
      assert(error instanceof DOMException);
      expect(error.name).toBe("TimeoutError");
    }
  });

  describe("flush with filtered headers", () => {
    test("should correctly map row values when header has trailing empty field", () => {
      // This test verifies that flush preserves original header indices
      // even after filtering out empty header fields
      const lexer = new FlexibleStringCSVLexer();
      const assembler = createCSVRecordAssembler();

      // CSV with trailing comma in header (creates empty field):
      // name,age,
      // Alice,30,extra
      // Bob,25,extra2
      const csv = "name,age,\r\nAlice,30,extra\r\nBob,25,extra2";

      const tokens = lexer.lex(csv);
      const records = [...assembler.assemble(tokens)];

      // Should correctly map to non-empty headers
      // Bug would cause last record (flushed): { name: 'Alice', age: '30' } (wrong index mapping)
      // Expected: { name: 'Alice', age: '30' } and { name: 'Bob', age: '25' }
      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({ name: "Alice", age: "30" });
      expect(records[1]).toEqual({ name: "Bob", age: "25" });
    });

    test("should correctly map row values when header has leading empty field", () => {
      const lexer = new FlexibleStringCSVLexer();
      const assembler = createCSVRecordAssembler();

      // CSV with leading comma in header (creates empty field):
      // ,name,age
      // skip,Alice,30
      // skip2,Bob,25
      const csv = ",name,age\r\nskip,Alice,30\r\nskip2,Bob,25";

      const tokens = lexer.lex(csv);
      const records = [...assembler.assemble(tokens)];

      // Should correctly map to non-empty headers
      // Bug would cause: { name: 'skip', age: 'Alice' } and { name: 'skip2', age: 'Bob' }
      // Expected: { name: 'Alice', age: '30' } and { name: 'Bob', age: '25' }
      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({ name: "Alice", age: "30" });
      expect(records[1]).toEqual({ name: "Bob", age: "25" });
    });
  });

  describe("Array Output Format", () => {
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

    describe("columnCountStrategy for array output", () => {
      describe("keep strategy", () => {
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

      describe("fill strategy", () => {
        test("should fill short rows with empty string", () => {
          const csv = `Alice,30
Bob,25,LA`;

          const lexer = new FlexibleStringCSVLexer();
          const tokens = lexer.lex(csv);

          const assembler = createCSVRecordAssembler({
            header: ["name", "age", "city"] as const,
            outputFormat: "array",
            columnCountStrategy: "fill",
          });

          const records = [...assembler.assemble(tokens)];

          expect(records).toHaveLength(2);
          expect(records[0]).toEqual(["Alice", "30", ""]); // Filled with empty string
          expect(records[1]).toEqual(["Bob", "25", "LA"]); // Exact match
        });

        test("should fill second row with empty string (regression test)", () => {
          const csv = `Alice,30,NY
Bob,25`;

          const lexer = new FlexibleStringCSVLexer();
          const tokens = lexer.lex(csv);

          const assembler = createCSVRecordAssembler({
            header: ["name", "age", "city"] as const,
            outputFormat: "array",
            columnCountStrategy: "fill",
          });

          const records = [...assembler.assemble(tokens)];

          expect(records).toHaveLength(2);
          expect(records[0]).toEqual(["Alice", "30", "NY"]); // Exact match
          expect(records[1]).toEqual(["Bob", "25", ""]); // Filled with empty string
        });

        test("should truncate long rows to match header length", () => {
          const csv = `Alice,30,NY,Extra1,Extra2`;

          const lexer = new FlexibleStringCSVLexer();
          const tokens = lexer.lex(csv);

          const assembler = createCSVRecordAssembler({
            header: ["name", "age", "city"] as const,
            outputFormat: "array",
            columnCountStrategy: "fill",
          });

          const records = [...assembler.assemble(tokens)];

          expect(records).toHaveLength(1);
          expect(records[0]).toEqual(["Alice", "30", "NY"]); // Truncated
        });
      });

      describe("sparse strategy", () => {
        test("should fill short rows with undefined", () => {
          const csv = `Alice,30
Bob,25,LA`;

          const lexer = new FlexibleStringCSVLexer();
          const tokens = lexer.lex(csv);

          const assembler = createCSVRecordAssembler({
            header: ["name", "age", "city"] as const,
            outputFormat: "array",
            columnCountStrategy: "sparse",
          });

          const records = [...assembler.assemble(tokens)];

          expect(records).toHaveLength(2);
          expect(records[0]).toEqual(["Alice", "30", undefined]); // Sparse - undefined
          expect(records[1]).toEqual(["Bob", "25", "LA"]); // Exact match
        });

        test("should fill second row with undefined (regression test)", () => {
          const csv = `Alice,30,NY
Bob,25`;

          const lexer = new FlexibleStringCSVLexer();
          const tokens = lexer.lex(csv);

          const assembler = createCSVRecordAssembler({
            header: ["name", "age", "city"] as const,
            outputFormat: "array",
            columnCountStrategy: "sparse",
          });

          const records = [...assembler.assemble(tokens)];

          expect(records).toHaveLength(2);
          expect(records[0]).toEqual(["Alice", "30", "NY"]); // Exact match
          expect(records[1]).toEqual(["Bob", "25", undefined]); // Sparse - undefined
        });

        test("should truncate long rows to match header length", () => {
          const csv = `Alice,30,NY,Extra1,Extra2`;

          const lexer = new FlexibleStringCSVLexer();
          const tokens = lexer.lex(csv);

          const assembler = createCSVRecordAssembler({
            header: ["name", "age", "city"] as const,
            outputFormat: "array",
            columnCountStrategy: "sparse",
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
            columnCountStrategy: "sparse",
          });
        }).toThrow("columnCountStrategy 'sparse' requires header option");
      });
    });

    describe("variable-length CSV (with keep strategy)", () => {
      test("should handle variable-length rows with keep strategy", () => {
        const csv = `Alice,30
Bob,25,LA
Charlie,35,SF,Extra`;

        const lexer = new FlexibleStringCSVLexer();
        const tokens = lexer.lex(csv);

        const assembler = createCSVRecordAssembler({
          outputFormat: "array",
          columnCountStrategy: "keep", // Required for variable-length output
        });

        const records = [...assembler.assemble(tokens)];

        // First row becomes header, subsequent rows keep their variable length
        expect(records).toHaveLength(2);
        expect(records[0]).toEqual(["Bob", "25", "LA"]);
        expect(records[1]).toEqual(["Charlie", "35", "SF", "Extra"]);
      });
    });

    describe("Headerless mode (header: [])", () => {
      describe("Valid configurations", () => {
        test("should treat all rows as data when header is empty array", () => {
          const csv = `Alice,30,NY
Bob,25,LA
Charlie,35,SF`;

          const lexer = new FlexibleStringCSVLexer();
          const tokens = lexer.lex(csv);

          const assembler = createCSVRecordAssembler({
            header: [] as const,
            outputFormat: "array",
          });

          const records = [...assembler.assemble(tokens)];

          // All three rows should be treated as data (no header inference)
          expect(records).toHaveLength(3);
          expect(records[0]).toEqual(["Alice", "30", "NY"]);
          expect(records[1]).toEqual(["Bob", "25", "LA"]);
          expect(records[2]).toEqual(["Charlie", "35", "SF"]);
        });

        test("should work with single row CSV in headerless mode", () => {
          const csv = `Alice,30,NY`;

          const lexer = new FlexibleStringCSVLexer();
          const tokens = lexer.lex(csv);

          const assembler = createCSVRecordAssembler({
            header: [] as const,
            outputFormat: "array",
          });

          const records = [...assembler.assemble(tokens)];

          expect(records).toHaveLength(1);
          expect(records[0]).toEqual(["Alice", "30", "NY"]);
        });

        test("should work with empty CSV in headerless mode", () => {
          const csv = ``;

          const lexer = new FlexibleStringCSVLexer();
          const tokens = lexer.lex(csv);

          const assembler = createCSVRecordAssembler({
            header: [] as const,
            outputFormat: "array",
          });

          const records = [...assembler.assemble(tokens)];

          expect(records).toHaveLength(0);
        });

        test("should support varying column counts in headerless mode with columnCountStrategy: keep", () => {
          const csv = `Alice,30
Bob,25,LA
Charlie,35,SF,Extra`;

          const lexer = new FlexibleStringCSVLexer();
          const tokens = lexer.lex(csv);

          const assembler = createCSVRecordAssembler({
            header: [] as const,
            outputFormat: "array",
            columnCountStrategy: "keep",
          });

          const records = [...assembler.assemble(tokens)];

          expect(records).toHaveLength(3);
          expect(records[0]).toEqual(["Alice", "30"]);
          expect(records[1]).toEqual(["Bob", "25", "LA"]);
          expect(records[2]).toEqual(["Charlie", "35", "SF", "Extra"]);
        });
      });

      describe("Runtime validation errors", () => {
        test("should throw error when header: [] with columnCountStrategy: 'fill'", () => {
          expect(() =>
            createCSVRecordAssembler({
              header: [] as const,
              outputFormat: "array",
              columnCountStrategy: "fill",
            }),
          ).toThrow(
            /Headerless mode \(header: \[\]\) only supports columnCountStrategy: 'keep'/,
          );
        });

        test("should throw error when header: [] with columnCountStrategy: 'sparse'", () => {
          expect(() =>
            createCSVRecordAssembler({
              header: [] as const,
              outputFormat: "array",
              columnCountStrategy: "sparse",
            }),
          ).toThrow(
            /Headerless mode \(header: \[\]\) only supports columnCountStrategy: 'keep'/,
          );
        });

        test("should throw error when header: [] with columnCountStrategy: 'strict'", () => {
          expect(() =>
            createCSVRecordAssembler({
              header: [] as const,
              outputFormat: "array",
              columnCountStrategy: "strict",
            }),
          ).toThrow(
            /Headerless mode \(header: \[\]\) only supports columnCountStrategy: 'keep'/,
          );
        });

        test("should throw error when header: [] with columnCountStrategy: 'truncate'", () => {
          expect(() =>
            createCSVRecordAssembler({
              header: [] as const,
              outputFormat: "array",
              columnCountStrategy: "truncate",
            }),
          ).toThrow(
            /Headerless mode \(header: \[\]\) only supports columnCountStrategy: 'keep'/,
          );
        });

        test("should throw error when header: [] with outputFormat: 'object'", () => {
          expect(() =>
            createCSVRecordAssembler({
              header: [] as const,
              outputFormat: "object",
            }),
          ).toThrow(
            /Headerless mode \(header: \[\]\) is not supported for outputFormat: 'object'/,
          );
        });
      });
    });
  });

  describe("Object Output Format", () => {
    describe("columnCountStrategy for object output", () => {
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
        test("should throw error because truncate is not allowed for object format", () => {
          expect(() => {
            createCSVRecordAssembler({
              header: ["name", "age", "city"] as const,
              outputFormat: "object",
              columnCountStrategy: "truncate",
            });
          }).toThrowError(
            /columnCountStrategy 'truncate' is not allowed for object format/,
          );
        });
      });

      describe("keep strategy", () => {
        test("should throw error because keep is not allowed for object format", () => {
          expect(() => {
            createCSVRecordAssembler({
              header: ["name", "age", "city"] as const,
              outputFormat: "object",
              columnCountStrategy: "keep",
            });
          }).toThrowError(
            /columnCountStrategy 'keep' is not allowed for object format/,
          );
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

  describe("Prototype Pollution Safety (Regression)", () => {
    test("should not pollute Object.prototype when __proto__ is used as CSV header", () => {
      const lexer = new FlexibleStringCSVLexer();
      const assembler = createCSVRecordAssembler();

      // CSV with __proto__ as a header
      const csv = "__proto__,name,age\r\nmalicious_value,Alice,30";

      const tokens = lexer.lex(csv);
      const records = [...assembler.assemble(tokens)];

      // Verify the record has __proto__ as its own property
      expect(records).toHaveLength(1);
      expect(records[0]!).toHaveProperty("__proto__");
      expect(records[0]!.__proto__).toBe("malicious_value");
      expect(records[0]!.name).toBe("Alice");
      expect(records[0]!.age).toBe("30");

      // CRITICAL: Verify that Object.prototype was NOT polluted
      // If prototype pollution occurred, all new objects would have this property
      const testObject = {};
      expect(testObject).not.toHaveProperty("malicious_value");
      expect((testObject as any).malicious_value).toBeUndefined();

      // Verify __proto__ is an own property of the record, not inherited
      expect(Object.hasOwn(records[0]!, "__proto__")).toBe(true);
    });

    test("should not pollute when constructor is used as CSV header", () => {
      const lexer = new FlexibleStringCSVLexer();
      const assembler = createCSVRecordAssembler();

      const csv = "constructor,name\r\nmalicious_value,Alice";

      const tokens = lexer.lex(csv);
      const records = [...assembler.assemble(tokens)];

      expect(records).toHaveLength(1);
      expect(records[0]!.constructor).toBe("malicious_value");
      expect(records[0]!.name).toBe("Alice");

      // Verify the constructor property is a string (own property), not the Function constructor
      expect(typeof records[0]!.constructor).toBe("string");

      // Verify constructor is an own property
      expect(Object.hasOwn(records[0]!, "constructor")).toBe(true);

      // Verify Object.constructor is not affected
      const testObject = {};
      expect(typeof testObject.constructor).toBe("function");
    });

    test("should not pollute when prototype is used as CSV header", () => {
      const lexer = new FlexibleStringCSVLexer();
      const assembler = createCSVRecordAssembler();

      const csv = "prototype,name\r\nmalicious_value,Alice";

      const tokens = lexer.lex(csv);
      const records = [...assembler.assemble(tokens)];

      expect(records).toHaveLength(1);
      expect(records[0]!.prototype).toBe("malicious_value");
      expect(records[0]!.name).toBe("Alice");

      // Verify prototype is an own property
      expect(Object.hasOwn(records[0]!, "prototype")).toBe(true);
    });

    test("should handle multiple dangerous property names together", () => {
      const lexer = new FlexibleStringCSVLexer();
      const assembler = createCSVRecordAssembler();

      // Multiple potentially dangerous headers in one CSV
      const csv =
        "__proto__,constructor,prototype,toString,valueOf,hasOwnProperty\r\nv1,v2,v3,v4,v5,v6";

      const tokens = lexer.lex(csv);
      const records = [...assembler.assemble(tokens)];

      expect(records).toHaveLength(1);
      const record = records[0]!;

      // All values should be strings (own properties)
      expect(record.__proto__).toBe("v1");
      expect(record.constructor).toBe("v2");
      expect(record.prototype).toBe("v3");
      expect(record.toString).toBe("v4");
      expect(record.valueOf).toBe("v5");
      expect(record.hasOwnProperty).toBe("v6");

      expect(typeof record.__proto__).toBe("string");
      expect(typeof record.constructor).toBe("string");
      expect(typeof record.prototype).toBe("string");
      expect(typeof record.toString).toBe("string");
      expect(typeof record.valueOf).toBe("string");
      expect(typeof record.hasOwnProperty).toBe("string");

      // Verify no prototype pollution occurred
      const testObject = {};
      expect((testObject as any).v1).toBeUndefined();
      expect((testObject as any).v2).toBeUndefined();
      expect((testObject as any).v3).toBeUndefined();
      expect((testObject as any).v4).not.toBe("v4"); // Should be the native function
      expect((testObject as any).v5).not.toBe("v5"); // Should be the native function
      expect((testObject as any).v6).not.toBe("v6"); // Should be the native function
    });

    test("should handle multiple records with __proto__ header without pollution", () => {
      const lexer = new FlexibleStringCSVLexer();
      const assembler = createCSVRecordAssembler();

      const csv =
        "__proto__,name\r\nvalue1,Alice\r\nvalue2,Bob\r\nvalue3,Charlie";

      const tokens = lexer.lex(csv);
      const records = [...assembler.assemble(tokens)];

      expect(records).toHaveLength(3);

      // Each record should have its own __proto__ value
      expect(records[0]!.__proto__).toBe("value1");
      expect(records[1]!.__proto__).toBe("value2");
      expect(records[2]!.__proto__).toBe("value3");

      // Verify no global pollution after processing multiple records
      const testObject = {};
      expect((testObject as any).value1).toBeUndefined();
      expect((testObject as any).value2).toBeUndefined();
      expect((testObject as any).value3).toBeUndefined();
    });

    test("should verify Object.fromEntries behavior is safe (baseline test)", () => {
      // This test documents the safe behavior of Object.fromEntries()
      // which is used internally by CSVRecordAssembler

      const dangerousEntries: Array<[string, string]> = [
        ["__proto__", "polluted"],
        ["constructor", "malicious"],
        ["name", "test"],
      ];

      const obj = Object.fromEntries(dangerousEntries);

      // Verify properties are set as own properties
      expect(Object.hasOwn(obj, "__proto__")).toBe(true);
      expect(Object.hasOwn(obj, "constructor")).toBe(true);
      expect(obj.__proto__!).toBe("polluted");
      expect(obj.constructor!).toBe("malicious");

      // CRITICAL: Verify no prototype pollution occurred
      const testObject = {};
      expect((testObject as any).__proto__).not.toBe("polluted");
      expect((testObject as any).polluted).toBeUndefined();
      expect(typeof testObject.constructor).toBe("function"); // Should be the native Function constructor
    });

    test("should handle edge case with object-like notation in quoted values", () => {
      const lexer = new FlexibleStringCSVLexer();
      const assembler = createCSVRecordAssembler();

      // Object-like syntax must be quoted to be treated as a single field
      const csv = '__proto__,name\r\n"{""polluted"":true}",Alice';

      const tokens = lexer.lex(csv);
      const records = [...assembler.assemble(tokens)];

      expect(records).toHaveLength(1);
      // The value should be treated as a plain string
      expect(records[0]!.__proto__).toBe('{"polluted":true}');
      expect(records[0]!.name).toBe("Alice");

      // Verify no pollution
      const testObject = {};
      expect((testObject as any).polluted).toBeUndefined();
    });

    test("should maintain safety with quoted fields containing dangerous names", () => {
      const lexer = new FlexibleStringCSVLexer();
      const assembler = createCSVRecordAssembler();

      // Using quoted fields with dangerous property names
      const csv = '"__proto__","constructor"\r\n"evil1","evil2"';

      const tokens = lexer.lex(csv);
      const records = [...assembler.assemble(tokens)];

      expect(records).toHaveLength(1);
      expect(records[0]!.__proto__).toBe("evil1");
      expect(records[0]!.constructor).toBe("evil2");

      // Verify both are strings (own properties)
      expect(typeof records[0]!.__proto__).toBe("string");
      expect(typeof records[0]!.constructor).toBe("string");

      // Verify no pollution
      const testObject = {};
      expect((testObject as any).evil1).toBeUndefined();
      expect((testObject as any).evil2).toBeUndefined();
    });
  });

  describe("Field Count Limit Protection", () => {
    describe("with default field count limit (100000)", () => {
      let assembler: CSVRecordAssembler<string[]>;
      beforeEach(() => {
        assembler = createCSVRecordAssembler();
      });

      test("should not throw error for normal field counts", () => {
        // In the unified token format, each token represents a field with `next` indicating what follows
        const tokens: AnyToken[] = [
          {
            value: "a",
            delimiter: Delimiter.Field,
            delimiterLength: 1,
            location: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 2, offset: 1 },
              rowNumber: 1,
            },
          },
          {
            value: "b",
            delimiter: Delimiter.Record,
            delimiterLength: 1,
            location: {
              start: { line: 1, column: 3, offset: 2 },
              end: { line: 1, column: 4, offset: 3 },
              rowNumber: 1,
            },
          },
        ];

        expect(() => [...assembler.assemble(tokens)]).not.toThrow();
      });

      test("should throw RangeError when field count exceeds limit during header parsing", () => {
        const tokens: AnyToken[] = [];
        const maxFields = 100001;

        // Create header with excessive fields using unified token format
        for (let i = 0; i < maxFields; i++) {
          tokens.push({
            value: `field${i}`,
            delimiter: i < maxFields - 1 ? Delimiter.Field : Delimiter.Record,
            delimiterLength: 1,
            location: {
              start: { line: 1, column: i * 2 + 1, offset: i * 2 },
              end: { line: 1, column: i * 2 + 2, offset: i * 2 + 1 },
              rowNumber: 1,
            },
          });
        }

        expect(() => [...assembler.assemble(tokens)]).toThrow(RangeError);
      });

      test("should throw RangeError with proper error details", () => {
        const tokens: AnyToken[] = [];
        const maxFields = 100001;

        for (let i = 0; i < maxFields; i++) {
          tokens.push({
            value: `f${i}`,
            delimiter: i < maxFields - 1 ? Delimiter.Field : Delimiter.Record,
            delimiterLength: 1,
            location: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 2, offset: 1 },
              rowNumber: 1,
            },
          });
        }

        try {
          [...assembler.assemble(tokens)];
          expect.fail("Should have thrown RangeError");
        } catch (error) {
          expect(error).toBeInstanceOf(RangeError);
          expect((error as RangeError).message).toContain("Field count");
          expect((error as RangeError).message).toContain(
            "exceeded maximum allowed count",
          );
        }
      });
    });

    describe("with custom field count limit", () => {
      test("should allow exactly N fields when limit is N", () => {
        const assembler = createCSVRecordAssembler({ maxFieldCount: 10 });
        const tokens: AnyToken[] = [];

        // Create exactly 10 fields (at the limit, should succeed)
        for (let i = 0; i < 10; i++) {
          tokens.push({
            value: `field${i}`,
            delimiter: i < 9 ? Delimiter.Field : Delimiter.Record,
            delimiterLength: 1,
            location: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 2, offset: 1 },
              rowNumber: 1,
            },
          });
        }

        // Should not throw - exactly at the limit
        expect(() => [...assembler.assemble(tokens)]).not.toThrow();

        // Verify the record was correctly assembled
        const records = [...assembler.assemble(tokens)];
        expect(records).toHaveLength(1);
        expect(Object.keys(records[0] as object)).toHaveLength(10);
      });

      test("should respect custom maxFieldCount option", () => {
        const assembler = createCSVRecordAssembler({ maxFieldCount: 10 });
        const tokens: AnyToken[] = [];

        // Create 11 fields (exceeds limit of 10)
        for (let i = 0; i < 11; i++) {
          tokens.push({
            value: `f${i}`,
            delimiter: i < 10 ? Delimiter.Field : Delimiter.Record,
            delimiterLength: 1,
            location: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 2, offset: 1 },
              rowNumber: 1,
            },
          });
        }

        expect(() => [...assembler.assemble(tokens)]).toThrow(RangeError);
      });

      test("should allow Number.POSITIVE_INFINITY as maxFieldCount to disable limit", () => {
        const assembler = createCSVRecordAssembler({
          maxFieldCount: Number.POSITIVE_INFINITY,
        });
        const tokens: AnyToken[] = [];

        // Create 200000 fields (would exceed default limit)
        for (let i = 0; i < 200000; i++) {
          tokens.push({
            value: `f${i}`,
            delimiter: i < 199999 ? Delimiter.Field : Delimiter.Record,
            delimiterLength: 1,
            location: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 2, offset: 1 },
              rowNumber: 1,
            },
          });
        }

        // This should not throw, but will take time and memory
        expect(() => [...assembler.assemble(tokens)]).not.toThrow(RangeError);
      });
    });

    describe("header validation with field count limit", () => {
      test("should throw RangeError when provided header exceeds limit", () => {
        const largeHeader = Array.from(
          { length: 100001 },
          (_, i) => `field${i}`,
        );

        expect(() => createCSVRecordAssembler({ header: largeHeader })).toThrow(
          RangeError,
        );
      });

      test("should accept header within limit", () => {
        const normalHeader = ["field1", "field2", "field3"];

        expect(() =>
          createCSVRecordAssembler({ header: normalHeader }),
        ).not.toThrow();
      });
    });

    describe("realistic attack scenarios", () => {
      test("should prevent DoS via CSV with excessive columns", () => {
        const assembler = createCSVRecordAssembler({ maxFieldCount: 1000 });
        const tokens: AnyToken[] = [];

        // Simulate attack with 2000 columns
        for (let i = 0; i < 2000; i++) {
          tokens.push({
            value: "x",
            delimiter: i < 1999 ? Delimiter.Field : Delimiter.Record,
            delimiterLength: 1,
            location: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 2, offset: 1 },
              rowNumber: 1,
            },
          });
        }

        expect(() => [...assembler.assemble(tokens)]).toThrow(RangeError);
      });

      test("should properly handle CSV within field count limits", () => {
        const assembler = createCSVRecordAssembler({ maxFieldCount: 100 });
        const tokens: AnyToken[] = [];

        // Create 50 fields (within limit) - header row
        for (let i = 0; i < 50; i++) {
          tokens.push({
            value: `field${i}`,
            delimiter: i < 49 ? Delimiter.Field : Delimiter.Record,
            delimiterLength: 1,
            location: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 2, offset: 1 },
              rowNumber: 1,
            },
          });
        }

        // Add data row with same field count
        for (let i = 0; i < 50; i++) {
          tokens.push({
            value: `data${i}`,
            delimiter: i < 49 ? Delimiter.Field : Delimiter.Record,
            delimiterLength: 1,
            location: {
              start: { line: 2, column: 1, offset: 0 },
              end: { line: 2, column: 2, offset: 1 },
              rowNumber: 2,
            },
          });
        }

        const records = [...assembler.assemble(tokens)];
        expect(records).toHaveLength(1);
        expect(Object.keys(records[0] as object)).toHaveLength(50);
      });
    });

    describe("error message details", () => {
      test("should include row number in error message", () => {
        const assembler = createCSVRecordAssembler({ maxFieldCount: 5 });
        const tokens: AnyToken[] = [];

        // Create 6 fields (exceeds limit of 5)
        for (let i = 0; i < 6; i++) {
          tokens.push({
            value: `field${i}`,
            delimiter: i < 5 ? Delimiter.Field : Delimiter.Record,
            delimiterLength: 1,
            location: {
              start: { line: 1, column: i * 2 + 1, offset: i * 2 },
              end: { line: 1, column: i * 2 + 2, offset: i * 2 + 1 },
              rowNumber: 3,
            },
          });
        }

        try {
          [...assembler.assemble(tokens)];
          expect.fail("Should have thrown RangeError");
        } catch (error) {
          expect(error).toBeInstanceOf(RangeError);
          expect((error as RangeError).message).toContain("at row 3");
        }
      });

      test("should include source in error message when provided", () => {
        const assembler = createCSVRecordAssembler({
          maxFieldCount: 5,
          source: "data.csv",
        });
        const tokens: AnyToken[] = [];

        // Create 6 fields (exceeds limit of 5)
        for (let i = 0; i < 6; i++) {
          tokens.push({
            value: `field${i}`,
            delimiter: i < 5 ? Delimiter.Field : Delimiter.Record,
            delimiterLength: 1,
            location: {
              start: { line: 1, column: i * 2 + 1, offset: i * 2 },
              end: { line: 1, column: i * 2 + 2, offset: i * 2 + 1 },
              rowNumber: 2,
            },
          });
        }

        try {
          [...assembler.assemble(tokens)];
          expect.fail("Should have thrown RangeError");
        } catch (error) {
          expect(error).toBeInstanceOf(RangeError);
          expect((error as RangeError).message).toContain('in "data.csv"');
        }
      });

      test("should include both row number and source in error message", () => {
        const assembler = createCSVRecordAssembler({
          maxFieldCount: 3,
          source: "users.csv",
        });
        const tokens: AnyToken[] = [];

        // Create 4 fields (exceeds limit of 3)
        for (let i = 0; i < 4; i++) {
          tokens.push({
            value: `col${i}`,
            delimiter: i < 3 ? Delimiter.Field : Delimiter.Record,
            delimiterLength: 1,
            location: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 2, offset: 1 },
              rowNumber: 10,
            },
          });
        }

        try {
          [...assembler.assemble(tokens)];
          expect.fail("Should have thrown RangeError");
        } catch (error) {
          expect(error).toBeInstanceOf(RangeError);
          const message = (error as RangeError).message;
          expect(message).toContain("at row 10");
          expect(message).toContain('in "users.csv"');
          expect(message).toContain(
            "Field count (4) exceeded maximum allowed count of 3",
          );
        }
      });

      test("should only include field count info when source is not provided", () => {
        const assembler = createCSVRecordAssembler({ maxFieldCount: 2 });
        const tokens: AnyToken[] = [];

        // Create 3 fields (exceeds limit of 2)
        for (let i = 0; i < 3; i++) {
          tokens.push({
            value: `f${i}`,
            delimiter: i < 2 ? Delimiter.Field : Delimiter.Record,
            delimiterLength: 1,
            location: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 2, offset: 1 },
              rowNumber: 1,
            },
          });
        }

        try {
          [...assembler.assemble(tokens)];
          expect.fail("Should have thrown RangeError");
        } catch (error) {
          expect(error).toBeInstanceOf(RangeError);
          const message = (error as RangeError).message;
          // Should not include source when not provided
          expect(message).not.toContain('in "');
          // Should include row number
          expect(message).toContain("at row 1");
          expect(message).toContain(
            "Field count (3) exceeded maximum allowed count of 2",
          );
        }
      });
    });
  });
});
