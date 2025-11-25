import fc from "fast-check";
import { beforeAll, describe, expect, test } from "vitest";
import {
  Field,
  FieldDelimiter,
  RecordDelimiter,
} from "@/core/constants.ts";
import { loadWASM } from "@/wasm/WasmInstance.main.web.ts";
import { WASMBinaryCSVLexer } from "./WASMBinaryCSVLexer.ts";

const encoder = new TextEncoder();

describe("WASMBinaryCSVLexer", () => {
  beforeAll(async () => {
    await loadWASM();
  });

  describe("basic functionality", () => {
    test("should tokenize simple CSV row", () => {
      const lexer = new WASMBinaryCSVLexer();
      const tokens = [...lexer.lex(encoder.encode("a,b,c"))];

      expect(tokens).toHaveLength(5);
      expect(tokens[0]?.type).toBe(Field);
      expect(tokens[0]?.value).toBe("a");
      expect(tokens[1]?.type).toBe(FieldDelimiter);
      expect(tokens[2]?.type).toBe(Field);
      expect(tokens[2]?.value).toBe("b");
      expect(tokens[3]?.type).toBe(FieldDelimiter);
      expect(tokens[4]?.type).toBe(Field);
      expect(tokens[4]?.value).toBe("c");
    });

    test("should tokenize multiple rows", () => {
      const lexer = new WASMBinaryCSVLexer();
      const tokens = [...lexer.lex(encoder.encode("a,b\nc,d"))];

      const types = tokens.map((t) => t.type);
      expect(types).toContain(RecordDelimiter);
    });

    test("should handle quoted fields", () => {
      const lexer = new WASMBinaryCSVLexer();
      const tokens = [...lexer.lex(encoder.encode('"hello, world",test'))];

      expect(tokens[0]?.value).toBe("hello, world");
    });

    test("should handle empty input", () => {
      const lexer = new WASMBinaryCSVLexer();
      const tokens = [...lexer.lex(encoder.encode(""))];

      expect(tokens).toHaveLength(0);
    });
  });

  describe("custom delimiter", () => {
    test("should use custom delimiter", () => {
      const lexer = new WASMBinaryCSVLexer({ delimiter: ";" });
      const tokens = [...lexer.lex(encoder.encode("a;b;c"))];

      expect(tokens).toHaveLength(5);
      expect(tokens[0]?.value).toBe("a");
      expect(tokens[1]?.type).toBe(FieldDelimiter);
      expect(tokens[2]?.value).toBe("b");
    });

    test("should use tab as delimiter", () => {
      const lexer = new WASMBinaryCSVLexer({ delimiter: "\t" });
      const tokens = [...lexer.lex(encoder.encode("a\tb\tc"))];

      expect(tokens[0]?.value).toBe("a");
      expect(tokens[2]?.value).toBe("b");
      expect(tokens[4]?.value).toBe("c");
    });
  });

  describe("custom quotation", () => {
    test("should use custom quotation character", () => {
      const lexer = new WASMBinaryCSVLexer({ quotation: "'" });
      const tokens = [...lexer.lex(encoder.encode("'hello, world',test"))];

      expect(tokens[0]?.value).toBe("hello, world");
    });
  });

  describe("streaming mode", () => {
    test("should handle streaming chunks", () => {
      const lexer = new WASMBinaryCSVLexer();

      // First chunk
      const tokens1 = [...lexer.lex(encoder.encode("a,b,"), { stream: true })];
      expect(tokens1.length).toBeGreaterThanOrEqual(3);

      // Second chunk
      const tokens2 = [...lexer.lex(encoder.encode("c\n"), { stream: true })];

      // Flush remaining
      const tokens3 = [...lexer.lex()];

      const allValues = [...tokens1, ...tokens2, ...tokens3]
        .filter((t) => t.type === Field)
        .map((t) => t.value);
      expect(allValues).toContain("a");
      expect(allValues).toContain("b");
    });

    test("should handle incomplete quoted field in streaming", () => {
      const lexer = new WASMBinaryCSVLexer();

      // Start a quoted field
      const tokens1 = [...lexer.lex(encoder.encode('"hello'), { stream: true })];

      // Complete the quoted field
      const tokens2 = [...lexer.lex(encoder.encode(' world"'), { stream: true })];

      // Flush
      const tokens3 = [...lexer.lex()];

      const allTokens = [...tokens1, ...tokens2, ...tokens3];
      const fieldValues = allTokens
        .filter((t) => t.type === Field)
        .map((t) => t.value);
      expect(fieldValues.join("")).toBe("hello world");
    });
  });

  describe("maxBufferSize option", () => {
    test("should throw RangeError when buffer size exceeded", () => {
      const lexer = new WASMBinaryCSVLexer({ maxBufferSize: 10 });
      const largeData = encoder.encode("a,b,c,d,e,f,g,h");

      expect(() => [...lexer.lex(largeData)]).toThrow(RangeError);
    });

    test("should include buffer size in error message", () => {
      const lexer = new WASMBinaryCSVLexer({ maxBufferSize: 10 });
      const largeData = encoder.encode("a,b,c,d,e,f,g,h");

      expect(() => [...lexer.lex(largeData)]).toThrow(/Buffer size exceeded/);
    });

    test("should accumulate buffer size across streaming chunks", () => {
      const lexer = new WASMBinaryCSVLexer({ maxBufferSize: 10 });

      // First chunk (5 bytes)
      [...lexer.lex(encoder.encode("a,b,c"), { stream: true })];

      // Second chunk would exceed (6 bytes, total 11 > 10)
      expect(() =>
        [...lexer.lex(encoder.encode("d,e,f,"), { stream: true })],
      ).toThrow(RangeError);
    });

    test("should reset buffer size after flush", () => {
      const lexer = new WASMBinaryCSVLexer({ maxBufferSize: 10 });

      // Use some buffer
      [...lexer.lex(encoder.encode("a,b,c"))];

      // After flush (non-streaming), should be able to process more
      [...lexer.lex(encoder.encode("d,e,f"))];
    });

    test("PBT: should always throw for data larger than maxBufferSize", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 101, max: 500 }),
          (maxSize, dataSize) => {
            const lexer = new WASMBinaryCSVLexer({ maxBufferSize: maxSize });
            const data = encoder.encode("a".repeat(dataSize));

            expect(() => [...lexer.lex(data)]).toThrow(RangeError);
          },
        ),
      );
    });
  });

  describe("source option", () => {
    test("should include source in error message when provided", () => {
      const lexer = new WASMBinaryCSVLexer({
        maxBufferSize: 10,
        source: "test-file.csv",
      });
      const largeData = encoder.encode("a,b,c,d,e,f,g,h");

      expect(() => [...lexer.lex(largeData)]).toThrow(/test-file\.csv/);
    });

    test("should not include source reference when not provided", () => {
      const lexer = new WASMBinaryCSVLexer({ maxBufferSize: 10 });
      const largeData = encoder.encode("a,b,c,d,e,f,g,h");

      try {
        [...lexer.lex(largeData)];
        expect.fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).not.toContain("in ");
      }
    });
  });

  describe("signal option (AbortSignal)", () => {
    test("should throw when signal is already aborted", () => {
      const controller = new AbortController();
      controller.abort();

      const lexer = new WASMBinaryCSVLexer({ signal: controller.signal });

      expect(() => [...lexer.lex(encoder.encode("a,b,c"))]).toThrow();
    });

    test("should throw with abort reason when signal aborted", () => {
      const controller = new AbortController();
      const reason = new Error("User cancelled");
      controller.abort(reason);

      const lexer = new WASMBinaryCSVLexer({ signal: controller.signal });

      expect(() => [...lexer.lex(encoder.encode("a,b,c"))]).toThrow(reason);
    });
  });

  describe("location tracking", () => {
    test("should track token locations", () => {
      const lexer = new WASMBinaryCSVLexer();
      const tokens = [...lexer.lex(encoder.encode("ab,cd"))];

      // First field
      expect(tokens[0]?.location?.start.column).toBeDefined();
      expect(tokens[0]?.location?.start.offset).toBeDefined();
    });

    test("should have correct location format", () => {
      const lexer = new WASMBinaryCSVLexer();
      const tokens = [...lexer.lex(encoder.encode("a,b"))];

      for (const token of tokens) {
        expect(token.location).toBeDefined();
        expect(token.location?.start).toBeDefined();
        expect(token.location?.end).toBeDefined();
        expect(token.location?.start.line).toBeGreaterThanOrEqual(1);
        expect(token.location?.start.column).toBeGreaterThanOrEqual(1);
        expect(token.location?.start.offset).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("PBT: field value preservation", () => {
    test("should preserve non-empty ASCII field values", () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
          (fields) => {
            // Filter out fields that contain commas, quotes, or newlines
            // to avoid CSV quoting complexity, and ensure non-empty
            const safeFields = fields.map((f) =>
              f.replace(/[,"\n\r]/g, "") || "x",
            );

            const lexer = new WASMBinaryCSVLexer();
            const csv = safeFields.join(",");
            const tokens = [...lexer.lex(encoder.encode(csv))];

            const fieldValues = tokens
              .filter((t) => t.type === Field)
              .map((t) => t.value);

            // Check that all expected fields are present
            for (const expected of safeFields) {
              expect(fieldValues).toContain(expected);
            }
          },
        ),
      );
    });
  });

  describe("edge cases", () => {
    test("should handle CRLF line endings", () => {
      const lexer = new WASMBinaryCSVLexer();
      const tokens = [...lexer.lex(encoder.encode("a,b\r\nc,d"))];

      const recordDelimiters = tokens.filter((t) => t.type === RecordDelimiter);
      expect(recordDelimiters.length).toBeGreaterThanOrEqual(1);
    });

    test("should handle rows with empty fields by emitting delimiters", () => {
      // Note: WASM lexer with JS-compatible filtering removes empty field tokens
      // that appear before delimiters, but the delimiter tokens are preserved
      const lexer = new WASMBinaryCSVLexer();
      const tokens = [...lexer.lex(encoder.encode("a,,c"))];

      // We should have field-delimiter tokens preserved
      const delimiterCount = tokens.filter(
        (t) => t.type === FieldDelimiter,
      ).length;
      expect(delimiterCount).toBe(2);

      // And the non-empty fields
      const fieldValues = tokens
        .filter((t) => t.type === Field)
        .map((t) => t.value);
      expect(fieldValues).toContain("a");
      expect(fieldValues).toContain("c");
    });

    test("should handle unicode in fields", () => {
      const lexer = new WASMBinaryCSVLexer();
      const tokens = [...lexer.lex(encoder.encode("日本語,テスト"))];

      const fieldValues = tokens
        .filter((t) => t.type === Field)
        .map((t) => t.value);
      expect(fieldValues).toContain("日本語");
      expect(fieldValues).toContain("テスト");
    });
  });
});
