import { beforeEach, describe, expect, test } from "vitest";
import { DEFAULT_MAX_FIELD_SIZE, Field } from "@/core/constants.ts";
import type { StringCSVLexer } from "@/core/types.ts";
import { FlexibleStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";

describe("CSVLexer - Buffer Overflow Protection", () => {
  describe("with default buffer size (10M characters)", () => {
    let lexer: StringCSVLexer;
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

    test("should allow Infinity as maxBufferSize to disable buffer limit", () => {
      // Note: maxFieldSize still has a limit (10MB default), so we need to
      // set maxFieldSize to a value larger than our test data
      const lexer = new FlexibleStringCSVLexer({
        maxBufferSize: Number.POSITIVE_INFINITY,
        maxFieldSize: 25 * 1024 * 1024, // 25MB field limit
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
      expect(tokens[0]?.type).toBe(Field);
      expect(tokens[0]?.value).toBe('"'.repeat(1000));
    });
  });
});

describe("CSVLexer - Field Size Limit Protection (maxFieldSize)", () => {
  describe("with default field size limit (10MB)", () => {
    test("should have 10MB as default maxFieldSize", () => {
      expect(DEFAULT_MAX_FIELD_SIZE).toBe(10 * 1024 * 1024);
    });

    test("should not throw error for normal-sized fields", () => {
      const lexer = new FlexibleStringCSVLexer();
      const data = "a,b,c\n1,2,3\n";
      expect(() => [...lexer.lex(data)]).not.toThrow();
    });

    test("should not throw error for field at exactly maxFieldSize", () => {
      const fieldSize = 1024; // Use small size for test speed
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: fieldSize });
      const data = `${"a".repeat(fieldSize)},b\n`;

      expect(() => [...lexer.lex(data)]).not.toThrow();
    });
  });

  describe("with custom maxFieldSize", () => {
    test("should throw RangeError when unquoted field exceeds maxFieldSize", () => {
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: 100 });
      const largeField = "a".repeat(150); // Exceeds 100 byte limit
      const data = `${largeField},b\n`;

      expect(() => [...lexer.lex(data)]).toThrow(RangeError);
    });

    test("should throw RangeError when quoted field exceeds maxFieldSize", () => {
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: 100 });
      const largeField = "a".repeat(150); // Exceeds 100 byte limit
      const data = `"${largeField}",b\n`;

      expect(() => [...lexer.lex(data)]).toThrow(RangeError);
    });

    test("should throw RangeError with descriptive error message", () => {
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: 50 });
      const largeField = "a".repeat(100);
      const data = `${largeField},b\n`;

      try {
        [...lexer.lex(data)];
        expect.fail("Should have thrown RangeError");
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
        expect((error as RangeError).message).toContain("Field size");
        expect((error as RangeError).message).toContain("exceeded");
      }
    });

    test("should allow fields up to exactly maxFieldSize", () => {
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: 100 });
      const exactField = "a".repeat(100); // Exactly 100 bytes
      const data = `${exactField},b\n`;

      const tokens = [...lexer.lex(data)];
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0]?.value).toBe(exactField);
    });

    test("should reject field that is 1 byte over maxFieldSize", () => {
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: 100 });
      const overField = "a".repeat(101); // 1 byte over limit
      const data = `${overField},b\n`;

      expect(() => [...lexer.lex(data)]).toThrow(RangeError);
    });
  });

  describe("streaming scenarios", () => {
    test("should throw RangeError when field spans multiple chunks and exceeds limit", () => {
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: 100 });

      expect(() => {
        // Stream chunks that build up a large field
        [...lexer.lex(`"${"a".repeat(50)}`, { stream: true })]; // Start quoted field
        // Include comma after closing quote to trigger field emission
        [...lexer.lex(`${"a".repeat(60)}",b\n`)]; // Continue, close, and add more (total: 110 chars in field)
      }).toThrow(RangeError);
    });

    test("should allow field that spans chunks but stays within limit", () => {
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: 100 });

      // Stream chunks that build up a field within limit
      [...lexer.lex(`"${"a".repeat(40)}`, { stream: true })]; // Start quoted field
      const tokens = [...lexer.lex(`${"a".repeat(40)}",b\n`)]; // Continue and close (total: 80 chars)

      expect(tokens.length).toBeGreaterThan(0);
    });

    test("should throw RangeError when unquoted field exceeds limit in streaming mode", () => {
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: 100 });

      expect(() => {
        // Unquoted field that exceeds limit
        [...lexer.lex("a".repeat(50), { stream: true })];
        [...lexer.lex(`${"a".repeat(60)},b\n`)]; // Complete field (total: 110 chars)
      }).toThrow(RangeError);
    });
  });

  describe("quoted fields with escapes", () => {
    test("should count escaped quotes correctly toward field size", () => {
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: 10 });
      // Each "" in quoted field becomes single " in output
      // Input: "a""b""c" (8 chars) → Output: a"b"c (5 chars)
      // Field size should be based on output size (5 bytes), not input
      const data = `"a""b""c",next\n`;

      const tokens = [...lexer.lex(data)];
      expect(tokens[0]?.value).toBe('a"b"c');
    });

    test("should throw RangeError when quoted field with escapes exceeds limit", () => {
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: 10 });
      // 20 pairs of "" = 40 chars input, 20 chars output
      const data = `"${'""'.repeat(20)}",next\n`;

      expect(() => [...lexer.lex(data)]).toThrow(RangeError);
    });
  });

  describe("interaction with maxBufferSize", () => {
    test("maxFieldSize and maxBufferSize are independent limits", () => {
      // maxFieldSize = 100, maxBufferSize = 1000
      // A field of 150 bytes should fail on maxFieldSize even if buffer has room
      const lexer = new FlexibleStringCSVLexer({
        maxFieldSize: 100,
        maxBufferSize: 1000,
      });
      const data = `${"a".repeat(150)},b\n`;

      expect(() => [...lexer.lex(data)]).toThrow(RangeError);
    });

    test("maxBufferSize triggers before maxFieldSize for large unclosed quotes", () => {
      // maxFieldSize = 1000, maxBufferSize = 100
      // Unclosed quote accumulates in buffer, should hit buffer limit first
      const lexer = new FlexibleStringCSVLexer({
        maxFieldSize: 1000,
        maxBufferSize: 100,
      });
      const data = `"${"a".repeat(150)}`; // Unclosed quote

      try {
        [...lexer.lex(data, { stream: true })];
        expect.fail("Should have thrown RangeError");
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
        // Should mention buffer, not field
        expect((error as RangeError).message).toContain("Buffer");
      }
    });
  });

  describe("multi-byte character handling", () => {
    test("should count bytes correctly for multi-byte UTF-8 characters", () => {
      // This test documents expected behavior:
      // JavaScript strings are UTF-16, but CSV files are often UTF-8
      // For string input, we measure length in UTF-16 code units
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: 10 });

      // 日本語 = 3 characters, 3 UTF-16 code units
      // In UTF-8 it would be 9 bytes, but we're measuring string length
      const data = "日本語,next\n";

      const tokens = [...lexer.lex(data)];
      expect(tokens[0]?.value).toBe("日本語");
      expect(tokens[0]?.value.length).toBe(3);
    });

    test("should throw when multi-byte field exceeds limit by string length", () => {
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: 5 });
      // 6 characters of 日 (each is 1 UTF-16 code unit)
      const data = "日日日日日日,next\n";

      expect(() => [...lexer.lex(data)]).toThrow(RangeError);
    });
  });

  describe("edge cases", () => {
    test("should handle empty fields correctly", () => {
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: 1 });
      const data = ",,,\n";

      // Empty fields don't emit Field tokens - they're represented by
      // adjacent FieldDelimiter tokens. The RecordAssembler handles this.
      // This test verifies that parsing doesn't throw despite tiny maxFieldSize.
      // Note: trailing newline is stripped when flush=true, so only 3 FieldDelimiters
      expect(() => [...lexer.lex(data)]).not.toThrow();
    });

    test("should handle first field exceeding limit", () => {
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: 10 });
      const data = `${"a".repeat(20)},b\n`;

      expect(() => [...lexer.lex(data)]).toThrow(RangeError);
    });

    test("should handle last field exceeding limit", () => {
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: 10 });
      const data = `a,${"b".repeat(20)}\n`;

      expect(() => [...lexer.lex(data)]).toThrow(RangeError);
    });

    test("should handle middle field exceeding limit", () => {
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: 10 });
      const data = `a,${"b".repeat(20)},c\n`;

      expect(() => [...lexer.lex(data)]).toThrow(RangeError);
    });

    test("should handle field in second row exceeding limit", () => {
      const lexer = new FlexibleStringCSVLexer({ maxFieldSize: 10 });
      const data = `a,b,c\n${"x".repeat(20)},y,z\n`;

      expect(() => [...lexer.lex(data)]).toThrow(RangeError);
    });
  });
});
