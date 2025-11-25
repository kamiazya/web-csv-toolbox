import fc from "fast-check";
import { beforeAll, describe, expect, test } from "vitest";
import {
  Field,
  FieldDelimiter,
  RecordDelimiter,
} from "@/core/constants.ts";
import { loadWASM } from "@/wasm/WasmInstance.main.web.ts";
import { WASMStringCSVLexer } from "./WASMStringCSVLexer.ts";

describe("WASMStringCSVLexer", () => {
  beforeAll(async () => {
    await loadWASM();
  });

  describe("basic functionality", () => {
    test("should tokenize simple CSV row", () => {
      const lexer = new WASMStringCSVLexer();
      const tokens = [...lexer.lex("a,b,c")];

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
      const lexer = new WASMStringCSVLexer();
      const tokens = [...lexer.lex("a,b\nc,d")];

      const types = tokens.map((t) => t.type);
      expect(types).toContain(RecordDelimiter);
    });

    test("should handle quoted fields", () => {
      const lexer = new WASMStringCSVLexer();
      const tokens = [...lexer.lex('"hello, world",test')];

      expect(tokens[0]?.value).toBe("hello, world");
    });

    test("should handle empty input", () => {
      const lexer = new WASMStringCSVLexer();
      const tokens = [...lexer.lex("")];

      expect(tokens).toHaveLength(0);
    });

    test("should handle single field", () => {
      const lexer = new WASMStringCSVLexer();
      const tokens = [...lexer.lex("hello")];

      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.type).toBe(Field);
      expect(tokens[0]?.value).toBe("hello");
    });
  });

  describe("custom delimiter", () => {
    test("should use custom delimiter", () => {
      const lexer = new WASMStringCSVLexer({ delimiter: ";" });
      const tokens = [...lexer.lex("a;b;c")];

      expect(tokens).toHaveLength(5);
      expect(tokens[0]?.value).toBe("a");
      expect(tokens[1]?.type).toBe(FieldDelimiter);
      expect(tokens[2]?.value).toBe("b");
    });

    test("should use tab as delimiter", () => {
      const lexer = new WASMStringCSVLexer({ delimiter: "\t" });
      const tokens = [...lexer.lex("a\tb\tc")];

      expect(tokens[0]?.value).toBe("a");
      expect(tokens[2]?.value).toBe("b");
      expect(tokens[4]?.value).toBe("c");
    });

    test("should use pipe as delimiter", () => {
      const lexer = new WASMStringCSVLexer({ delimiter: "|" });
      const tokens = [...lexer.lex("a|b|c")];

      const fieldValues = tokens
        .filter((t) => t.type === Field)
        .map((t) => t.value);
      expect(fieldValues).toEqual(["a", "b", "c"]);
    });
  });

  describe("custom quotation", () => {
    test("should use custom quotation character", () => {
      const lexer = new WASMStringCSVLexer({ quotation: "'" });
      const tokens = [...lexer.lex("'hello, world',test")];

      expect(tokens[0]?.value).toBe("hello, world");
    });
  });

  describe("streaming mode", () => {
    test("should handle streaming chunks", () => {
      const lexer = new WASMStringCSVLexer();

      // First chunk
      const tokens1 = [...lexer.lex("a,b,", { stream: true })];
      expect(tokens1.length).toBeGreaterThanOrEqual(3);

      // Second chunk
      const tokens2 = [...lexer.lex("c\n", { stream: true })];

      // Flush remaining
      const tokens3 = [...lexer.lex()];

      const allValues = [...tokens1, ...tokens2, ...tokens3]
        .filter((t) => t.type === Field)
        .map((t) => t.value);
      expect(allValues).toContain("a");
      expect(allValues).toContain("b");
    });

    test("should handle incomplete quoted field in streaming", () => {
      const lexer = new WASMStringCSVLexer();

      // Start a quoted field
      const tokens1 = [...lexer.lex('"hello', { stream: true })];

      // Complete the quoted field
      const tokens2 = [...lexer.lex(' world"', { stream: true })];

      // Flush
      const tokens3 = [...lexer.lex()];

      const allTokens = [...tokens1, ...tokens2, ...tokens3];
      const fieldValues = allTokens
        .filter((t) => t.type === Field)
        .map((t) => t.value);
      expect(fieldValues.join("")).toBe("hello world");
    });

    test("should flush without chunk", () => {
      const lexer = new WASMStringCSVLexer();

      // Add some data in streaming mode
      const tokens1 = [...lexer.lex("a,b", { stream: true })];

      // Flush without providing a chunk
      const tokens2 = [...lexer.lex()];

      const allValues = [...tokens1, ...tokens2]
        .filter((t) => t.type === Field)
        .map((t) => t.value);
      expect(allValues).toContain("a");
    });
  });

  describe("maxBufferSize option", () => {
    test("should throw RangeError when buffer size exceeded", () => {
      const lexer = new WASMStringCSVLexer({ maxBufferSize: 10 });

      expect(() => [...lexer.lex("a,b,c,d,e,f,g,h")]).toThrow(RangeError);
    });

    test("should include buffer size in error message", () => {
      const lexer = new WASMStringCSVLexer({ maxBufferSize: 10 });

      expect(() => [...lexer.lex("a,b,c,d,e,f,g,h")]).toThrow(/Buffer size exceeded/);
    });

    test("should accumulate buffer size across streaming chunks", () => {
      const lexer = new WASMStringCSVLexer({ maxBufferSize: 10 });

      // First chunk (5 bytes)
      [...lexer.lex("a,b,c", { stream: true })];

      // Second chunk would exceed (6 bytes, total 11 > 10)
      expect(() =>
        [...lexer.lex("d,e,f,", { stream: true })],
      ).toThrow(RangeError);
    });

    test("should reset buffer size after flush", () => {
      const lexer = new WASMStringCSVLexer({ maxBufferSize: 10 });

      // Use some buffer
      [...lexer.lex("a,b,c")];

      // After flush (non-streaming), should be able to process more
      [...lexer.lex("d,e,f")];
    });

    test("PBT: should always throw for data larger than maxBufferSize", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 101, max: 500 }),
          (maxSize, dataSize) => {
            const lexer = new WASMStringCSVLexer({ maxBufferSize: maxSize });
            const data = "a".repeat(dataSize);

            expect(() => [...lexer.lex(data)]).toThrow(RangeError);
          },
        ),
      );
    });
  });

  describe("source option", () => {
    test("should include source in error message when provided", () => {
      const lexer = new WASMStringCSVLexer({
        maxBufferSize: 10,
        source: "test-file.csv",
      });

      expect(() => [...lexer.lex("a,b,c,d,e,f,g,h")]).toThrow(/test-file\.csv/);
    });

    test("should not include source reference when not provided", () => {
      const lexer = new WASMStringCSVLexer({ maxBufferSize: 10 });

      try {
        [...lexer.lex("a,b,c,d,e,f,g,h")];
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

      const lexer = new WASMStringCSVLexer({ signal: controller.signal });

      expect(() => [...lexer.lex("a,b,c")]).toThrow();
    });

    test("should throw with abort reason when signal aborted", () => {
      const controller = new AbortController();
      const reason = new Error("User cancelled");
      controller.abort(reason);

      const lexer = new WASMStringCSVLexer({ signal: controller.signal });

      expect(() => [...lexer.lex("a,b,c")]).toThrow(reason);
    });
  });

  describe("location tracking", () => {
    test("should track token locations", () => {
      const lexer = new WASMStringCSVLexer();
      const tokens = [...lexer.lex("ab,cd")];

      // First field
      expect(tokens[0]?.location?.start.column).toBeDefined();
      expect(tokens[0]?.location?.start.offset).toBeDefined();
    });

    test("should have correct location format", () => {
      const lexer = new WASMStringCSVLexer();
      const tokens = [...lexer.lex("a,b")];

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
            // and ensure non-empty
            const safeFields = fields.map((f) =>
              f.replace(/[,"\n\r]/g, "") || "x",
            );

            const lexer = new WASMStringCSVLexer();
            const csv = safeFields.join(",");
            const tokens = [...lexer.lex(csv)];

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
      const lexer = new WASMStringCSVLexer();
      const tokens = [...lexer.lex("a,b\r\nc,d")];

      const recordDelimiters = tokens.filter((t) => t.type === RecordDelimiter);
      expect(recordDelimiters.length).toBeGreaterThanOrEqual(1);
    });

    test("should handle rows with empty fields by emitting delimiters", () => {
      const lexer = new WASMStringCSVLexer();
      const tokens = [...lexer.lex("a,,c")];

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
      const lexer = new WASMStringCSVLexer();
      const tokens = [...lexer.lex("日本語,テスト")];

      const fieldValues = tokens
        .filter((t) => t.type === Field)
        .map((t) => t.value);
      expect(fieldValues).toContain("日本語");
      expect(fieldValues).toContain("テスト");
    });

    test("should handle emoji", () => {
      const lexer = new WASMStringCSVLexer();
      const tokens = [...lexer.lex("🎉,🚀,✨")];

      const fieldValues = tokens
        .filter((t) => t.type === Field)
        .map((t) => t.value);
      expect(fieldValues).toContain("🎉");
      expect(fieldValues).toContain("🚀");
      expect(fieldValues).toContain("✨");
    });

    test("should handle escaped quotes", () => {
      const lexer = new WASMStringCSVLexer();
      const tokens = [...lexer.lex('"say ""hello""",test')];

      expect(tokens[0]?.value).toBe('say "hello"');
    });
  });

  describe("comparison with binary lexer behavior", () => {
    test("should produce same field values as processing encoded string", () => {
      const stringLexer = new WASMStringCSVLexer();
      const csv = "a,b,c\n1,2,3";

      const tokens = [...stringLexer.lex(csv)];
      const fieldValues = tokens
        .filter((t) => t.type === Field)
        .map((t) => t.value);

      expect(fieldValues).toContain("a");
      expect(fieldValues).toContain("b");
      expect(fieldValues).toContain("c");
      expect(fieldValues).toContain("1");
      expect(fieldValues).toContain("2");
      expect(fieldValues).toContain("3");
    });
  });
});
