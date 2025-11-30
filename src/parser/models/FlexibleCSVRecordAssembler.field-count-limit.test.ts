import { beforeEach, describe, expect, test } from "vitest";
import { Delimiter } from "@/core/constants.ts";
import type { AnyToken, CSVRecordAssembler } from "@/core/types.ts";
import { createCSVRecordAssembler } from "@/parser/api/model/createCSVRecordAssembler.ts";

describe("CSVRecordAssembler - Field Count Limit Protection", () => {
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
      const largeHeader = Array.from({ length: 100001 }, (_, i) => `field${i}`);

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
