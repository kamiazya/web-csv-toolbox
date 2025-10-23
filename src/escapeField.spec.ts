import fc from "fast-check";
import { describe, expect, test, it } from "vitest";
import { escapeField } from "./escapeField.ts";
import { FC } from "./__tests__/helper.ts";
import { COMMA, DOUBLE_QUOTE } from "./constants.ts";

const LOCATION_SHAPE = {
  start: {
    line: expect.any(Number),
    column: expect.any(Number),
    offset: expect.any(Number),
  },
  end: {
    line: expect.any(Number),
    column: expect.any(Number),
    offset: expect.any(Number),
  },
  rowNumber: expect.any(Number),
};

describe("escapeField function", () => {
  test("should escape quotation and special cases", () => {
    expect(escapeField("aa")).toBe("aa");
    expect(escapeField('"')).toBe('""""');
    expect(escapeField("a\na")).toBe('"a\na"');
    expect(escapeField("c21", { quotation: "c" })).toBe("ccc21c");
    expect(escapeField("$", { quotation: "$" })).toBe("$$$$");
    expect(escapeField("|", { delimiter: "||" })).toBe('"|"');
    expect(escapeField("b7ccced", { quotation: "cc", quote: true })).toBe(
      "ccb7cccccedcc",
    );
  });
});

describe("escapeField property-based tests", () => {
  it("should quote fields with special characters or delimiters", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), (row) => {
        row.forEach((field) => {
          const escaped = escapeField(field);
          if (field.includes("\n") || field.includes("\r") || field.includes(COMMA) || field.includes('"')) {
            expect(escaped.startsWith('"') && escaped.endsWith('"')).toBe(true);
          }
        });
      })
    );
  });

  it("should always quote when quote=true", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), (row) => {
        row.forEach((field) => {
          const escaped = escapeField(field, { quote: true });
          expect(escaped.startsWith('"') && escaped.endsWith('"')).toBe(true);
        });
      })
    );
  });

  it("should correctly escape internal quotation marks", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), (row) => {
        row.forEach((field) => {
          const escaped = escapeField(field, { quote: true });
          if (field.includes('"')) {
            const inner = escaped.slice(1, -1); // remove outer quotes
            expect(inner.includes('""')).toBe(true);
          }
        });
      })
    );
  });

  it("should work with custom quotation characters", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string()), // row
        fc.constantFrom("'", "`", "$", "cc"), // quotation
        (row, quotation) => {
          row.forEach((field) => {
            const escaped = escapeField(field, { quotation, quote: true });
            // outer quotes present
            expect(escaped.startsWith(quotation) && escaped.endsWith(quotation)).toBe(true);
            const inner = escaped.slice(quotation.length, -quotation.length);
            // all internal quotation characters are doubled
            const occurrences = field.split(quotation).length - 1;
            if (occurrences > 0) {
              const doubledCount = (inner.match(new RegExp(quotation + quotation, "g")) || []).length;
              expect(doubledCount).toBe(occurrences);
            }
          });
        }
      )
    );
  });

  it("should work with custom delimiters", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string()), // row
        fc.constantFrom("|", "||", ";"), // delimiter
        (row, delimiter) => {
          row.forEach((field, idx) => {
            const escaped = escapeField(field, { delimiter, quote: true });
            // outer quotes are present if quote=true
            expect(escaped.startsWith('"') && escaped.endsWith('"')).toBe(true);
          });
        }
      )
    );
  });

  it("should handle multi-character quotations and $ correctly", () => {
    const cases = [
      { field: 'ccfield', quotation: 'cc' },
      { field: '$field$', quotation: '$' },
      { field: 'ab$cd', quotation: '$' },
    ];

    cases.forEach(({ field, quotation }) => {
      const escaped = escapeField(field, { quote: true, quotation });
      expect(escaped.startsWith(quotation) && escaped.endsWith(quotation)).toBe(true);
      const inner = escaped.slice(quotation.length, -quotation.length);
      // all original internal quotation sequences should appear doubled
      if (field.includes(quotation)) {
        expect(inner.includes(quotation.repeat(2))).toBe(true);
      }
    });
  });
});
