import { beforeEach, describe, expect, test } from "vitest";
import { Lexer } from "./Lexer";
import { Field } from "./common/constants";
import { BufferOverflowError } from "./common/errors";

describe("Lexer - Buffer Overflow Protection", () => {
  describe("with default buffer size (10MB)", () => {
    let lexer: Lexer;
    beforeEach(() => {
      lexer = new Lexer();
    });

    test("should not throw error for normal-sized input", () => {
      const data = "a,b,c\n".repeat(1000);
      expect(() => [...lexer.lex(data)]).not.toThrow();
    });

    test("should throw BufferOverflowError when buffer exceeds 10MB", () => {
      // Create a large chunk that exceeds 10MB
      const largeChunk = "a".repeat(11 * 1024 * 1024); // 11MB

      expect(() => [...lexer.lex(largeChunk)]).toThrow(BufferOverflowError);
    });

    test("should throw BufferOverflowError with proper error details", () => {
      const largeChunk = "a".repeat(11 * 1024 * 1024); // 11MB

      try {
        [...lexer.lex(largeChunk)];
        expect.fail("Should have thrown BufferOverflowError");
      } catch (error) {
        expect(error).toBeInstanceOf(BufferOverflowError);
        expect((error as BufferOverflowError).currentSize).toBeGreaterThan(
          10 * 1024 * 1024,
        );
        expect((error as BufferOverflowError).maxSize).toBe(10 * 1024 * 1024);
        expect((error as BufferOverflowError).message).toContain(
          "Buffer size exceeded maximum allowed size",
        );
      }
    });

    test("should throw BufferOverflowError on incremental buffering attack", () => {
      // Simulate streaming attack with many small chunks
      const smallChunk = "a".repeat(1024 * 1024); // 1MB per chunk

      expect(() => {
        for (let i = 0; i < 12; i++) {
          [...lexer.lex(smallChunk, true)]; // buffering = true
        }
      }).toThrow(BufferOverflowError);
    });

    test("should throw BufferOverflowError on unclosed quoted field", () => {
      // Attack vector: unclosed quoted field that accumulates in buffer
      const unclosedQuote = `"${"a".repeat(11 * 1024 * 1024)}`;

      expect(() => [...lexer.lex(unclosedQuote, true)]).toThrow(
        BufferOverflowError,
      );
    });
  });

  describe("with custom buffer size", () => {
    test("should respect custom maxBufferSize option", () => {
      const lexer = new Lexer({ maxBufferSize: 1024 }); // 1KB limit
      const largeChunk = "a".repeat(2048); // 2KB

      expect(() => [...lexer.lex(largeChunk)]).toThrow(BufferOverflowError);
    });

    test("should allow Infinity as maxBufferSize to disable limit", () => {
      const lexer = new Lexer({ maxBufferSize: Number.POSITIVE_INFINITY });
      const largeChunk = "a".repeat(20 * 1024 * 1024); // 20MB

      // This should not throw, but may take some time and memory
      // We'll just verify it doesn't throw immediately
      expect(() => [...lexer.lex(largeChunk)]).not.toThrow(BufferOverflowError);
    });
  });

  describe("buffer size check timing", () => {
    test("should check buffer size after each chunk addition", () => {
      const lexer = new Lexer({ maxBufferSize: 100 });

      // First chunk is within limit
      expect(() => [...lexer.lex("a".repeat(50), true)]).not.toThrow();

      // Second chunk exceeds limit
      expect(() => [...lexer.lex("a".repeat(60), true)]).toThrow(
        BufferOverflowError,
      );
    });

    test("should not check buffer size when chunk is empty", () => {
      const lexer = new Lexer({ maxBufferSize: 10 });
      // Pre-fill buffer to near limit
      [...lexer.lex("a".repeat(8), true)];

      // Empty chunk should not trigger check
      expect(() => [...lexer.lex("", true)]).not.toThrow();

      // Null chunk should not trigger check
      expect(() => [...lexer.lex(null, true)]).not.toThrow();
    });
  });

  describe("realistic attack scenarios", () => {
    test("should prevent DoS via malformed CSV without delimiters", () => {
      const lexer = new Lexer({ maxBufferSize: 1024 * 1024 }); // 1MB limit
      // Malformed CSV that doesn't match any token pattern
      const malformedData = "x".repeat(2 * 1024 * 1024); // 2MB of invalid data

      expect(() => [...lexer.lex(malformedData)]).toThrow(BufferOverflowError);
    });

    test("should prevent DoS via streaming incomplete quoted fields", () => {
      const lexer = new Lexer({ maxBufferSize: 512 * 1024 }); // 512KB limit

      expect(() => {
        // Stream chunks of quoted field without closing quote
        for (let i = 0; i < 10; i++) {
          const chunk =
            i === 0 ? `"${"data".repeat(1024 * 30)}` : "data".repeat(1024 * 30);
          [...lexer.lex(chunk, true)];
        }
      }).toThrow(BufferOverflowError);
    });

    test("should prevent infinite loop with escaped quotes in long field", () => {
      const lexer = new Lexer({ maxBufferSize: 256 * 1024 }); // 256KB limit

      expect(() => {
        // Attack: Field with many escaped quotes that doesn't close
        // This simulates the do-while loop scenario mentioned in the security report
        const chunk = `"${'""'.repeat(150 * 1024)}`;
        [...lexer.lex(chunk, true)];
      }).toThrow(BufferOverflowError);
    });

    test("should handle streaming with escaped quotes that eventually exceeds buffer", () => {
      const lexer = new Lexer({ maxBufferSize: 128 * 1024 }); // 128KB limit

      expect(() => {
        // Stream multiple chunks with escaped quotes
        for (let i = 0; i < 5; i++) {
          const chunk =
            i === 0 ? `"${'""'.repeat(30 * 1024)}` : '""'.repeat(30 * 1024);
          [...lexer.lex(chunk, true)];
        }
      }).toThrow(BufferOverflowError);
    });

    test("should properly parse valid quoted field with many escaped quotes within limit", () => {
      const lexer = new Lexer({ maxBufferSize: 1024 * 1024 }); // 1MB limit
      // Valid field with escaped quotes that closes properly
      const validData = `"${'""'.repeat(1000)}"`;

      const tokens = [...lexer.lex(validData)];
      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.type).toBe(Field);
      expect(tokens[0]?.value).toBe('"'.repeat(1000));
    });
  });
});
