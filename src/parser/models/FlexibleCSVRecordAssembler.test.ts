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

  describe("record view mode", () => {
    test("should expose both tuple and key access", () => {
      const lexer = new FlexibleStringCSVLexer();
      const assembler = createCSVRecordAssembler({
        outputFormat: "record-view",
      });
      const csv = "name,age\r\nAlice,30\r\n";
      const records = [...assembler.assemble(lexer.lex(csv))];
      expect(Array.isArray(records[0])).toBe(true);
      expect(records[0]![0]).toBe("Alice");
      expect(records[0]!.name).toBe("Alice");
      expect(records[0]!.age).toBe("30");
      expect(Object.keys(records[0]!)).toEqual(["0", "1", "name", "age"]);
    });

    test("should respect strict strategy", () => {
      const lexer = new FlexibleStringCSVLexer();
      const assembler = createCSVRecordAssembler({
        outputFormat: "record-view",
        columnCountStrategy: "strict",
        header: ["name", "age"] as const,
      });
      const csv = "Alice,30\r\n";
      const records = [...assembler.assemble(lexer.lex(csv))];
      expect(records).toHaveLength(1);
      expect(records[0]!.name).toBe("Alice");
    });
  });
});
