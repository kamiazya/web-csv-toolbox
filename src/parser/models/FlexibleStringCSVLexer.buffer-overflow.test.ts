import { beforeEach, describe, expect, test } from "vitest";
import { Delimiter } from "@/core/constants.ts";
import { FlexibleStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";

describe("CSVLexer - Buffer Overflow Protection", () => {
  describe("with default buffer size (10M characters)", () => {
    let lexer: FlexibleStringCSVLexer;
    beforeEach(() => {
      lexer = new FlexibleStringCSVLexer();
    });

    test("should not throw error for normal-sized input", () => {
      const data = "a,b,c\n".repeat(1000);
      expect(() => [...lexer.lex(data)]).not.toThrow();
    });

    test("should throw RangeError when buffer exceeds 10M characters", () => {
      // Create a large chunk that exceeds 10M characters
      const largeChunk = "a".repeat(11 * 1024 * 1024); // 11M characters

      expect(() => [...lexer.lex(largeChunk)]).toThrow(RangeError);
    });

    test("should throw RangeError with proper error details", () => {
      const largeChunk = "a".repeat(11 * 1024 * 1024); // 11M characters

      try {
        [...lexer.lex(largeChunk)];
        expect.fail("Should have thrown RangeError");
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
        expect((error as RangeError).message).toContain("Buffer size");
        expect((error as RangeError).message).toContain("characters");
        expect((error as RangeError).message).toContain(
          "exceeded maximum allowed size",
        );
      }
    });

    test("should throw RangeError on incremental buffering attack", () => {
      // Simulate streaming attack with many small chunks
      const smallChunk = "a".repeat(1024 * 1024); // 1M characters per chunk

      expect(() => {
        for (let i = 0; i < 12; i++) {
          [...lexer.lex(smallChunk, { stream: true })]; // buffering = true
        }
      }).toThrow(RangeError);
    });

    test("should throw RangeError on unclosed quoted field", () => {
      // Attack vector: unclosed quoted field that accumulates in buffer
      const unclosedQuote = `"${"a".repeat(11 * 1024 * 1024)}`;

      expect(() => [...lexer.lex(unclosedQuote, { stream: true })]).toThrow(
        RangeError,
      );
    });
  });

  describe("with custom buffer size", () => {
    test("should respect custom maxBufferSize option", () => {
      const lexer = new FlexibleStringCSVLexer({ maxBufferSize: 1024 }); // 1K characters limit
      const largeChunk = "a".repeat(2048); // 2K characters

      expect(() => [...lexer.lex(largeChunk)]).toThrow(RangeError);
    });

    test("should allow Infinity as maxBufferSize to disable limit", () => {
      const lexer = new FlexibleStringCSVLexer({
        maxBufferSize: Number.POSITIVE_INFINITY,
      });
      const largeChunk = "a".repeat(20 * 1024 * 1024); // 20M characters

      // This should not throw, but may take some time and memory
      // We'll just verify it doesn't throw immediately
      expect(() => [...lexer.lex(largeChunk)]).not.toThrow(RangeError);
    });
  });

  describe("buffer size check timing", () => {
    test("should check buffer size after each chunk addition", () => {
      const lexer = new FlexibleStringCSVLexer({ maxBufferSize: 100 });

      // First chunk is within limit
      expect(() => [
        ...lexer.lex("a".repeat(50), { stream: true }),
      ]).not.toThrow();

      // Second chunk exceeds limit
      expect(() => [...lexer.lex("a".repeat(60), { stream: true })]).toThrow(
        RangeError,
      );
    });

    test("should not check buffer size when chunk is empty", () => {
      const lexer = new FlexibleStringCSVLexer({ maxBufferSize: 10 });
      // Pre-fill buffer to near limit
      [...lexer.lex("a".repeat(8), { stream: true })];

      // Empty chunk should not trigger check
      expect(() => [...lexer.lex("", { stream: true })]).not.toThrow();

      // Null chunk should not trigger check
      expect(() => [...lexer.lex(undefined, { stream: true })]).not.toThrow();
    });
  });

  describe("realistic attack scenarios", () => {
    test("should prevent DoS via malformed CSV without delimiters", () => {
      const lexer = new FlexibleStringCSVLexer({ maxBufferSize: 1024 * 1024 }); // 1M characters limit
      // Malformed CSV that doesn't match any token pattern
      const malformedData = "x".repeat(2 * 1024 * 1024); // 2M characters of invalid data

      expect(() => [...lexer.lex(malformedData)]).toThrow(RangeError);
    });

    test("should prevent DoS via streaming incomplete quoted fields", () => {
      const lexer = new FlexibleStringCSVLexer({ maxBufferSize: 512 * 1024 }); // 512K characters limit

      expect(() => {
        // Stream chunks of quoted field without closing quote
        for (let i = 0; i < 10; i++) {
          const chunk =
            i === 0 ? `"${"data".repeat(1024 * 30)}` : "data".repeat(1024 * 30);
          [...lexer.lex(chunk, { stream: true })];
        }
      }).toThrow(RangeError);
    });

    test("should prevent infinite loop with escaped quotes in long field", () => {
      const lexer = new FlexibleStringCSVLexer({ maxBufferSize: 256 * 1024 }); // 256K characters limit

      expect(() => {
        // Attack: Field with many escaped quotes that doesn't close
        // This simulates the do-while loop scenario mentioned in the security report
        const chunk = `"${'""'.repeat(150 * 1024)}`;
        [...lexer.lex(chunk, { stream: true })];
      }).toThrow(RangeError);
    });

    test("should handle streaming with escaped quotes that eventually exceeds buffer", () => {
      const lexer = new FlexibleStringCSVLexer({ maxBufferSize: 128 * 1024 }); // 128K characters limit

      expect(() => {
        // Stream multiple chunks with escaped quotes
        for (let i = 0; i < 5; i++) {
          const chunk =
            i === 0 ? `"${'""'.repeat(30 * 1024)}` : '""'.repeat(30 * 1024);
          [...lexer.lex(chunk, { stream: true })];
        }
      }).toThrow(RangeError);
    });

    test("should properly parse valid quoted field with many escaped quotes within limit", () => {
      const lexer = new FlexibleStringCSVLexer({ maxBufferSize: 1024 * 1024 }); // 1M characters limit
      // Valid field with escaped quotes that closes properly
      const validData = `"${'""'.repeat(1000)}"`;

      const tokens = [...lexer.lex(validData)];
      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.delimiter).toBe(Delimiter.EOF);
      expect(tokens[0]?.value).toBe('"'.repeat(1000));
    });
  });
});
