import { beforeEach, describe, expect, test } from "vitest";
import { RecordAssembler } from "./RecordAssembler";
import { Field, FieldDelimiter, RecordDelimiter } from "./common/constants";
import type { Token } from "./common/types";

describe("RecordAssembler - Field Count Limit Protection", () => {
  describe("with default field count limit (100000)", () => {
    let assembler: RecordAssembler<string[]>;
    beforeEach(() => {
      assembler = new RecordAssembler();
    });

    test("should not throw error for normal field counts", () => {
      const tokens: Token[] = [
        {
          type: Field,
          value: "a",
          location: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 2, offset: 1 },
            rowNumber: 1,
          },
        },
        {
          type: FieldDelimiter,
          value: ",",
          location: {
            start: { line: 1, column: 2, offset: 1 },
            end: { line: 1, column: 3, offset: 2 },
            rowNumber: 1,
          },
        },
        {
          type: Field,
          value: "b",
          location: {
            start: { line: 1, column: 3, offset: 2 },
            end: { line: 1, column: 4, offset: 3 },
            rowNumber: 1,
          },
        },
        {
          type: RecordDelimiter,
          value: "\n",
          location: {
            start: { line: 1, column: 4, offset: 3 },
            end: { line: 2, column: 1, offset: 4 },
            rowNumber: 1,
          },
        },
      ];

      expect(() => [...assembler.assemble(tokens)]).not.toThrow();
    });

    test("should throw RangeError when field count exceeds limit during header parsing", () => {
      const tokens: Token[] = [];
      const maxFields = 100001;

      // Create header with excessive fields
      for (let i = 0; i < maxFields; i++) {
        tokens.push({
          type: Field,
          value: `field${i}`,
          location: {
            start: { line: 1, column: i * 2 + 1, offset: i * 2 },
            end: { line: 1, column: i * 2 + 2, offset: i * 2 + 1 },
            rowNumber: 1,
          },
        });
        if (i < maxFields - 1) {
          tokens.push({
            type: FieldDelimiter,
            value: ",",
            location: {
              start: { line: 1, column: i * 2 + 2, offset: i * 2 + 1 },
              end: { line: 1, column: i * 2 + 3, offset: i * 2 + 2 },
              rowNumber: 1,
            },
          });
        }
      }
      tokens.push({
        type: RecordDelimiter,
        value: "\n",
        location: {
          start: { line: 1, column: maxFields * 2, offset: maxFields * 2 - 1 },
          end: { line: 2, column: 1, offset: maxFields * 2 },
          rowNumber: 1,
        },
      });

      expect(() => [...assembler.assemble(tokens)]).toThrow(RangeError);
    });

    test("should throw RangeError with proper error details", () => {
      const tokens: Token[] = [];
      const maxFields = 100001;

      for (let i = 0; i < maxFields; i++) {
        tokens.push({
          type: Field,
          value: `f${i}`,
          location: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 2, offset: 1 },
            rowNumber: 1,
          },
        });
        if (i < maxFields - 1) {
          tokens.push({
            type: FieldDelimiter,
            value: ",",
            location: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 2, offset: 1 },
              rowNumber: 1,
            },
          });
        }
      }
      tokens.push({
        type: RecordDelimiter,
        value: "\n",
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 2, column: 1, offset: 1 },
          rowNumber: 1,
        },
      });

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
    test("should respect custom maxFieldCount option", () => {
      const assembler = new RecordAssembler({ maxFieldCount: 10 });
      const tokens: Token[] = [];

      // Create 11 fields (exceeds limit of 10)
      for (let i = 0; i < 11; i++) {
        tokens.push({
          type: Field,
          value: `f${i}`,
          location: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 2, offset: 1 },
            rowNumber: 1,
          },
        });
        if (i < 10) {
          tokens.push({
            type: FieldDelimiter,
            value: ",",
            location: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 2, offset: 1 },
              rowNumber: 1,
            },
          });
        }
      }
      tokens.push({
        type: RecordDelimiter,
        value: "\n",
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 2, column: 1, offset: 1 },
          rowNumber: 1,
        },
      });

      expect(() => [...assembler.assemble(tokens)]).toThrow(RangeError);
    });

    test("should allow Number.POSITIVE_INFINITY as maxFieldCount to disable limit", () => {
      const assembler = new RecordAssembler({
        maxFieldCount: Number.POSITIVE_INFINITY,
      });
      const tokens: Token[] = [];

      // Create 200000 fields (would exceed default limit)
      for (let i = 0; i < 200000; i++) {
        tokens.push({
          type: Field,
          value: `f${i}`,
          location: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 2, offset: 1 },
            rowNumber: 1,
          },
        });
        if (i < 199999) {
          tokens.push({
            type: FieldDelimiter,
            value: ",",
            location: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 2, offset: 1 },
              rowNumber: 1,
            },
          });
        }
      }
      tokens.push({
        type: RecordDelimiter,
        value: "\n",
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 2, column: 1, offset: 1 },
          rowNumber: 1,
        },
      });

      // This should not throw, but will take time and memory
      expect(() => [...assembler.assemble(tokens)]).not.toThrow(RangeError);
    });
  });

  describe("header validation with field count limit", () => {
    test("should throw RangeError when provided header exceeds limit", () => {
      const largeHeader = Array.from({ length: 100001 }, (_, i) => `field${i}`);

      expect(() => new RecordAssembler({ header: largeHeader })).toThrow(
        RangeError,
      );
    });

    test("should accept header within limit", () => {
      const normalHeader = ["field1", "field2", "field3"];

      expect(() => new RecordAssembler({ header: normalHeader })).not.toThrow();
    });
  });

  describe("realistic attack scenarios", () => {
    test("should prevent DoS via CSV with excessive columns", () => {
      const assembler = new RecordAssembler({ maxFieldCount: 1000 });
      const tokens: Token[] = [];

      // Simulate attack with 2000 columns
      for (let i = 0; i < 2000; i++) {
        tokens.push({
          type: Field,
          value: "x",
          location: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 2, offset: 1 },
            rowNumber: 1,
          },
        });
        if (i < 1999) {
          tokens.push({
            type: FieldDelimiter,
            value: ",",
            location: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 2, offset: 1 },
              rowNumber: 1,
            },
          });
        }
      }

      expect(() => [...assembler.assemble(tokens)]).toThrow(RangeError);
    });

    test("should properly handle CSV within field count limits", () => {
      const assembler = new RecordAssembler({ maxFieldCount: 100 });
      const tokens: Token[] = [];

      // Create 50 fields (within limit)
      for (let i = 0; i < 50; i++) {
        tokens.push({
          type: Field,
          value: `field${i}`,
          location: {
            start: { line: 1, column: 1, offset: 0 },
            end: { line: 1, column: 2, offset: 1 },
            rowNumber: 1,
          },
        });
        if (i < 49) {
          tokens.push({
            type: FieldDelimiter,
            value: ",",
            location: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 2, offset: 1 },
              rowNumber: 1,
            },
          });
        }
      }
      tokens.push({
        type: RecordDelimiter,
        value: "\n",
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 2, column: 1, offset: 1 },
          rowNumber: 1,
        },
      });

      // Add data row with same field count
      for (let i = 0; i < 50; i++) {
        tokens.push({
          type: Field,
          value: `data${i}`,
          location: {
            start: { line: 2, column: 1, offset: 0 },
            end: { line: 2, column: 2, offset: 1 },
            rowNumber: 2,
          },
        });
        if (i < 49) {
          tokens.push({
            type: FieldDelimiter,
            value: ",",
            location: {
              start: { line: 2, column: 1, offset: 0 },
              end: { line: 2, column: 2, offset: 1 },
              rowNumber: 2,
            },
          });
        }
      }
      tokens.push({
        type: RecordDelimiter,
        value: "\n",
        location: {
          start: { line: 2, column: 1, offset: 0 },
          end: { line: 3, column: 1, offset: 1 },
          rowNumber: 2,
        },
      });

      const records = [...assembler.assemble(tokens)];
      expect(records).toHaveLength(1);
      expect(Object.keys(records[0] as object)).toHaveLength(50);
    });
  });
});
