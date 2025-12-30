import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FC } from "@/__tests__/helper.ts";
import { unescapeQuotes } from "./unescapeQuotes";

// Reference implementation (original dynamic RegExp version) - kept for testing
function unescapeQuotes_Reference(value: string, quotation = '"'): string {
  if (value.length < 2) return value;
  if (value.startsWith(quotation) && value.endsWith(quotation)) {
    const escaped = quotation + quotation;
    return value
      .slice(1, -1)
      .replace(
        new RegExp(escaped.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        quotation,
      );
  }
  return value;
}

describe("unescapeQuotes", () => {
  describe("backward compatibility with reference implementation", () => {
    it("should match reference implementation for plain values", () => {
      const testCases = ["plain_value", "value123", "test", "", "a", "ab"];

      testCases.forEach((input) => {
        const optimized = unescapeQuotes(input);
        const reference = unescapeQuotes_Reference(input);
        expect(optimized).toBe(reference);
      });
    });

    it("should match reference implementation for quoted values without escape", () => {
      const testCases = [
        '"quoted_value"',
        '"test"',
        '"a"',
        '""',
        '"hello world"',
        '"multiple words here"',
      ];

      testCases.forEach((input) => {
        const optimized = unescapeQuotes(input);
        const reference = unescapeQuotes_Reference(input);
        expect(optimized).toBe(reference);
      });
    });

    it("should match reference implementation for quoted values with escaped quotes", () => {
      const testCases = [
        '"value_with_""escape"""',
        '"multiple""escaped""quotes"',
        '"""triple"""',
        '"a""b"',
        '"he said ""hello"""',
        '""""""', // 3 escaped quotes
      ];

      testCases.forEach((input) => {
        const optimized = unescapeQuotes(input);
        const reference = unescapeQuotes_Reference(input);
        expect(optimized).toBe(reference);
      });
    });

    it("should match reference implementation for edge cases", () => {
      const testCases = [
        '"', // single character only
        'not"quoted', // quote in the middle
        '"trailing', // trailing quote only
        'leading"', // leading quote only
        '"\n"', // with newline
        '"\t"', // with tab
      ];

      testCases.forEach((input) => {
        const optimized = unescapeQuotes(input);
        const reference = unescapeQuotes_Reference(input);
        expect(optimized).toBe(reference);
      });
    });

    it("should match reference implementation for custom quotation character", () => {
      const testCases = [
        { input: "'single'", quotation: "'" },
        { input: "''escaped''", quotation: "'" },
        { input: "'multi''ple'", quotation: "'" },
        { input: "`backtick`", quotation: "`" },
        { input: "``double``", quotation: "`" },
      ];

      testCases.forEach(({ input, quotation }) => {
        const optimized = unescapeQuotes(input, quotation);
        const reference = unescapeQuotes_Reference(input, quotation);
        expect(optimized).toBe(reference);
      });
    });

    it("should match reference implementation for multi-character quotation", () => {
      // Multi-character quotations are also supported (rare but possible in spec)
      const testCases = [
        { input: "<<hello>>", quotation: "<<>>" },
        { input: "<<a<<>>b>>", quotation: "<<>>" },
      ];

      testCases.forEach(({ input, quotation }) => {
        const optimized = unescapeQuotes(input, quotation);
        const reference = unescapeQuotes_Reference(input, quotation);
        expect(optimized).toBe(reference);
      });
    });
  });

  describe("specific behavior verification", () => {
    it("should remove surrounding quotes and unescape doubled quotes", () => {
      expect(unescapeQuotes('"hello"')).toBe("hello");
      expect(unescapeQuotes('""world""')).toBe('"world"');
      expect(unescapeQuotes('"a""b""c"')).toBe('a"b"c');
    });

    it("should not modify unquoted values", () => {
      expect(unescapeQuotes("plain")).toBe("plain");
      expect(unescapeQuotes("value123")).toBe("value123");
    });

    it("should handle empty and short strings", () => {
      expect(unescapeQuotes("")).toBe("");
      expect(unescapeQuotes("a")).toBe("a");
      expect(unescapeQuotes('"')).toBe('"');
    });

    it("should work with custom quotation characters", () => {
      expect(unescapeQuotes("'test'", "'")).toBe("test");
      expect(unescapeQuotes("'a''b'", "'")).toBe("a'b");
    });
  });

  describe("property-based tests", () => {
    it("should always match reference implementation for any text and quotation", () => {
      fc.assert(
        fc.property(FC.text(), FC.quotation(), (text, quotation) => {
          const optimized = unescapeQuotes(text, quotation);
          const reference = unescapeQuotes_Reference(text, quotation);
          expect(optimized).toBe(reference);
        }),
      );
    });

    it("should correctly unescape quoted fields with escaped quotes", () => {
      fc.assert(
        fc.property(FC.field(), FC.quotation(), (field, quotation) => {
          // Construct a properly escaped field: "field with ""escaped"" quotes"
          const escapedField = field.replaceAll(
            quotation,
            quotation + quotation,
          );
          const quotedValue = `${quotation}${escapedField}${quotation}`;

          const optimized = unescapeQuotes(quotedValue, quotation);
          const reference = unescapeQuotes_Reference(quotedValue, quotation);

          // Both implementations should produce the same result
          expect(optimized).toBe(reference);
        }),
      );
    });

    it("should be idempotent for unquoted values", () => {
      fc.assert(
        fc.property(
          FC.text().filter((t) => t.length < 2),
          FC.quotation(),
          (text, quotation) => {
            const result1 = unescapeQuotes(text, quotation);
            const result2 = unescapeQuotes(result1, quotation);
            expect(result1).toBe(result2);
          },
        ),
      );
    });

    it("should preserve fields that don't start and end with quotation", () => {
      fc.assert(
        fc.property(
          FC.text().filter((t) => t.length >= 2),
          FC.quotation(),
          (text, quotation) => {
            // Skip if text actually starts and ends with quotation
            if (text.startsWith(quotation) && text.endsWith(quotation)) {
              return;
            }

            const result = unescapeQuotes(text, quotation);
            expect(result).toBe(text);
          },
        ),
      );
    });

    it("should handle empty inner content correctly", () => {
      fc.assert(
        fc.property(FC.quotation(), (quotation) => {
          // Empty quoted field: quotation + quotation (e.g., "")
          const emptyQuoted = quotation + quotation;
          const result = unescapeQuotes(emptyQuoted, quotation);

          // For single-character quotations, this should return ""
          // For multi-character quotations, the behavior depends on the spec
          // We test against the reference implementation
          const reference = unescapeQuotes_Reference(emptyQuoted, quotation);
          expect(result).toBe(reference);
        }),
      );
    });

    it("should handle multi-character quotations correctly", () => {
      fc.assert(
        fc.property(
          FC.text(),
          fc.constantFrom("<<>>", "[[]]", "{{}}"),
          (field, quotation) => {
            const optimized = unescapeQuotes(
              `${quotation}${field}${quotation}`,
              quotation,
            );
            const reference = unescapeQuotes_Reference(
              `${quotation}${field}${quotation}`,
              quotation,
            );
            expect(optimized).toBe(reference);
          },
        ),
      );
    });

    it("should correctly handle multiple escaped quotations", () => {
      fc.assert(
        fc.property(FC.quotation(), fc.nat({ max: 10 }), (quotation, count) => {
          // Create a field with exactly 'count' quotation marks
          const field = new Array(count).fill(quotation).join("");
          const escapedField = field.replaceAll(
            quotation,
            quotation + quotation,
          );
          const quotedValue = `${quotation}${escapedField}${quotation}`;

          const optimized = unescapeQuotes(quotedValue, quotation);
          const reference = unescapeQuotes_Reference(quotedValue, quotation);

          // Both implementations should produce the same result
          expect(optimized).toBe(reference);
        }),
      );
    });
  });
});
