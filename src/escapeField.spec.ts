import fc from "fast-check";
import { describe, expect, it, test } from "vitest";
import { FC } from "./__tests__/helper.ts";
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
            expect(
              escaped
                .slice(quotation.length, -quotation.length)
                .includes(quotation + quotation),
            ).toBe(true);
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
      fc.property(
        FC.text().filter((f) => f.includes('"')),
        (field) => {
          const escaped = escapeField(field, { quote: true });
          const inner = escaped.slice(1, -1);
          const originalCount = (field.match(/"/g) || []).length;
          const doubledCount = (inner.match(/""/g) || []).length;
          expect(doubledCount).toBe(originalCount);
        },
      ),
    );
  });

  it("should correctly handle custom quotation characters", () => {
    fc.assert(
      fc.property(FC.text(), FC.quotation(), (field, quotation) => {
        const escaped = escapeField(field, { quote: true, quotation });
        expect(escaped.startsWith(quotation)).toBe(true);
        expect(escaped.endsWith(quotation)).toBe(true);

        if (field.includes(quotation)) {
          expect(
            escaped
              .slice(quotation.length, -quotation.length)
              .includes(quotation + quotation),
          ).toBe(true);
        }
      }),
    );
  });

  it("should quote fields when containing custom delimiters", () => {
    fc.assert(
      fc.property(FC.text(), FC.delimiter(), (field, delimiter) => {
        const composed = `${field}${delimiter}${field}`;
        const escaped = escapeField(composed, { delimiter });
        expect(escaped.startsWith(DOUBLE_QUOTE)).toBe(true);
        expect(escaped.endsWith(DOUBLE_QUOTE)).toBe(true);
      }),
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

      if (field.includes(quotation)) {
        expect(
          escaped
            .slice(quotation.length, -quotation.length)
            .includes(quotation.repeat(2)),
        ).toBe(true);
      }
    }
  });
});
