import fc from "fast-check";
import { describe, expect, it, test } from "vitest";
import { COMMA, DOUBLE_QUOTE } from "./constants.ts";
import { escapeField } from "./escapeField.ts";

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
        for (const field of row) {
          const escaped = escapeField(field);
          if (/[\n\r",]/.test(field)) {
            expect(escaped.startsWith('"') && escaped.endsWith('"')).toBe(true);
          }
        }
      }),
    );
  });

  it("should always quote when quote=true", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), (row) => {
        for (const field of row) {
          const escaped = escapeField(field, { quote: true });
          expect(escaped.startsWith('"') && escaped.endsWith('"')).toBe(true);
        }
      }),
    );
  });

  it("should correctly escape internal quotation marks", () => {
    fc.assert(
      fc.property(fc.array(fc.string()), (row) => {
        for (const field of row) {
          const escaped = escapeField(field, { quote: true });
          if (field.includes('"')) {
            const inner = escaped.slice(1, -1);
            const originalCount = field.split('"').length - 1;
            const doubledCount = (inner.match(/""/g) || []).length;
            expect(doubledCount).toBe(originalCount);
          }
        }
      }),
    );
  });

  it("should work with custom quotation characters", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string()),
        fc.constantFrom("'", "`", "$", "cc"),
        (row, quotation) => {
          for (const field of row) {
            const escaped = escapeField(field, { quotation, quote: true });
            expect(
              escaped.startsWith(quotation) && escaped.endsWith(quotation),
            ).toBe(true);
            const inner = escaped.slice(quotation.length, -quotation.length);
            const occurrences = field.split(quotation).length - 1;
            if (occurrences > 0) {
              const doubledCount = (
                inner.match(
                  new RegExp(
                    (quotation + quotation).replace(
                      /[.*+?^${}()|[\\\]]/g,
                      "\\$&",
                    ),
                    "g",
                  ),
                ) || []
              ).length;
              expect(doubledCount).toBe(occurrences);
            }
          }
        },
      ),
    );
  });

  it("should work with custom delimiters", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.constantFrom("|", "||", ";"),
        (part1, part2, delimiter) => {
          const field = `${part1}${delimiter}${part2}`;
          const escaped = escapeField(field, { delimiter });
          expect(escaped.startsWith(DOUBLE_QUOTE)).toBe(true);
          expect(escaped.endsWith(DOUBLE_QUOTE)).toBe(true);
        },
      ),
    );
  });

  it("should handle multi-character quotations and $ correctly", () => {
    const cases = [
      { field: "ccfield", quotation: "cc" },
      { field: "$field$", quotation: "$" },
      { field: "ab$cd", quotation: "$" },
    ];

    for (const { field, quotation } of cases) {
      const escaped = escapeField(field, { quote: true, quotation });
      expect(escaped.startsWith(quotation) && escaped.endsWith(quotation)).toBe(
        true,
      );
      const inner = escaped.slice(quotation.length, -quotation.length);
      if (field.includes(quotation)) {
        expect(inner.includes(quotation.repeat(2))).toBe(true);
      }
    }
  });
});
