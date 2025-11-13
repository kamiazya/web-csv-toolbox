import fc from "fast-check";
import { describe, expect, it, test } from "vitest";
import { FC } from "../../__tests__/helper.ts";
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
  it("should quote fields containing special characters", () => {
    fc.assert(
      fc.property(
        FC.text().filter((f) => /[\n\r",]/.test(f)),
        FC.quotation(),
        (field, quotation) => {
          const escaped = escapeField(field, { quotation, quote: true });
          expect(escaped.startsWith(quotation)).toBe(true);
          expect(escaped.endsWith(quotation)).toBe(true);

          if (field.includes(quotation)) {
            const inner = escaped.slice(quotation.length, -quotation.length);
            const originalCount = field.split(quotation).length - 1;
            const escapedPattern = quotation.repeat(2);
            const doubledCount = (
              inner.match(
                new RegExp(
                  escapedPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                  "g",
                ),
              ) || []
            ).length;
            expect(doubledCount).toBe(originalCount);
          }
        },
      ),
    );
  });

  it("should always quote when quote=true", () => {
    fc.assert(
      fc.property(FC.text(), FC.quotation(), (field, quotation) => {
        const escaped = escapeField(field, { quote: true, quotation });
        expect(escaped.startsWith(quotation)).toBe(true);
        expect(escaped.endsWith(quotation)).toBe(true);
      }),
    );
  });

  it("should correctly escape internal quotation marks", () => {
    fc.assert(
      fc.property(FC.text(), FC.quotation(), (field, quotation) => {
        if (!field.includes(quotation)) return; // skip if no quotation
        const escaped = escapeField(field, { quote: true, quotation });
        const inner = escaped.slice(quotation.length, -quotation.length);
        const originalCount = field.split(quotation).length - 1;
        const escapedPattern = quotation.repeat(2);
        const doubledCount = (
          inner.match(
            new RegExp(
              escapedPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "g",
            ),
          ) || []
        ).length;
        expect(doubledCount).toBe(originalCount);
      }),
    );
  });

  it("should correctly handle custom quotation characters", () => {
    fc.assert(
      fc.property(FC.text(), FC.quotation(), (field, quotation) => {
        const escaped = escapeField(field, { quote: true, quotation });
        expect(escaped.startsWith(quotation)).toBe(true);
        expect(escaped.endsWith(quotation)).toBe(true);

        if (field.includes(quotation)) {
          const inner = escaped.slice(quotation.length, -quotation.length);
          expect(inner.includes(quotation + quotation)).toBe(true);
        }
      }),
    );
  });

  it("should quote fields when containing custom delimiters", () => {
    fc.assert(
      fc.property(
        FC.text(),
        FC.delimiter(),
        FC.quotation(),
        (field, delimiter, quotation) => {
          const composed = `${field}${delimiter}${field}`;
          const escaped = escapeField(composed, { delimiter, quotation });
          expect(escaped.startsWith(quotation)).toBe(true);
          expect(escaped.endsWith(quotation)).toBe(true);
        },
      ),
    );
  });

  it("should handle multi-character quotations and $ correctly", () => {
    fc.assert(
      fc.property(
        FC.text(),
        fc.constantFrom("cc", "$", "||"),
        (field, quotation) => {
          const escaped = escapeField(field, { quote: true, quotation });
          expect(escaped.startsWith(quotation)).toBe(true);
          expect(escaped.endsWith(quotation)).toBe(true);

          if (field.includes(quotation)) {
            const inner = escaped.slice(quotation.length, -quotation.length);
            const originalCount = field.split(quotation).length - 1;
            const doubledCount = (
              inner.match(
                new RegExp(
                  quotation.repeat(2).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                  "g",
                ),
              ) || []
            ).length;
            expect(doubledCount).toBe(originalCount);
          }
        },
      ),
    );
  });
});
