import { assert, beforeEach, describe, expect, test } from "vitest";
import { Delimiter } from "@/core/constants.ts";
import { ParseError } from "@/core/errors.ts";
import { FlexibleStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";

describe("CSVLexer", () => {
  // Use trackLocation: true for tests that verify location tracking
  let lexer: FlexibleStringCSVLexer<",", '"', true>;
  beforeEach(() => {
    lexer = new FlexibleStringCSVLexer({ trackLocation: true });
  });

  test("should parse a field with not escaped", () => {
    const tokens = lexer.lex("field");
    expect([...tokens]).toStrictEqual([
      {
        value: "field",
        delimiter: Delimiter.Record,
        delimiterLength: 0,
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 6, offset: 5 },
          rowNumber: 1,
        },
      },
    ]);
  });

  test("should parse a field with escaped", () => {
    const tokens = lexer.lex('"field"');
    expect([...tokens]).toStrictEqual([
      {
        value: "field",
        delimiter: Delimiter.Record,
        delimiterLength: 0,
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 8, offset: 7 },
          rowNumber: 1,
        },
      },
    ]);
  });

  test("should parse a field with escaped and delimiter", () => {
    const tokens = lexer.lex('"field",next');
    expect([...tokens]).toStrictEqual([
      {
        value: "field",
        delimiter: Delimiter.Field,
        delimiterLength: 1,
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 8, offset: 7 },
          rowNumber: 1,
        },
      },
      {
        value: "next",
        delimiter: Delimiter.Record,
        delimiterLength: 0,
        location: {
          start: { line: 1, column: 9, offset: 8 },
          end: { line: 1, column: 13, offset: 12 },
          rowNumber: 1,
        },
      },
    ]);
  });

  test("should parse a field with escaped and delimiter and record delimiter", () => {
    const tokens = lexer.lex('"fie\nld"\n"Hello\nWorld"');
    expect([...tokens]).toStrictEqual([
      {
        value: "fie\nld",
        delimiter: Delimiter.Record,
        delimiterLength: 1,
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 2, column: 4, offset: 8 },
          rowNumber: 1,
        },
      },
      {
        value: "Hello\nWorld",
        delimiter: Delimiter.Record,
        delimiterLength: 0,
        location: {
          start: { line: 3, column: 1, offset: 9 },
          end: { line: 4, column: 7, offset: 22 },
          rowNumber: 2,
        },
      },
    ]);
  });

  test("should parse a field with escaped and delimiter and record delimiter and EOF(LF)", () => {
    // Trailing newline should not create an extra empty record
    const tokens = lexer.lex('"fie\nld"\nHello World\n');
    expect([...tokens]).toStrictEqual([
      {
        value: "fie\nld",
        delimiter: Delimiter.Record,
        delimiterLength: 1,
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 2, column: 4, offset: 8 },
          rowNumber: 1,
        },
      },
      {
        value: "Hello World",
        delimiter: Delimiter.Record,
        delimiterLength: 1,
        location: {
          start: { line: 3, column: 1, offset: 9 },
          end: { line: 3, column: 12, offset: 20 },
          rowNumber: 2,
        },
      },
    ]);
  });

  test("should parse a field with escaped and delimiter and record delimiter and EOF(RCLF)", () => {
    // Trailing newline should not create an extra empty record
    const tokens = lexer.lex('"fie\r\nld"\r\nHello World\r\n');
    expect([...tokens]).toStrictEqual([
      {
        value: "fie\r\nld",
        delimiter: Delimiter.Record,
        delimiterLength: 2,
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 2, column: 4, offset: 9 },
          rowNumber: 1,
        },
      },
      {
        value: "Hello World",
        delimiter: Delimiter.Record,
        delimiterLength: 2,
        location: {
          start: { line: 3, column: 1, offset: 11 },
          end: { line: 3, column: 12, offset: 22 },
          rowNumber: 2,
        },
      },
    ]);
  });

  test("should utilize buffers for lexical analysis", () => {
    let tokens = lexer.lex("Hello World\nHello ", { stream: true });
    expect([...tokens]).toStrictEqual([
      {
        value: "Hello World",
        delimiter: Delimiter.Record,
        delimiterLength: 1,
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 12, offset: 11 },
          rowNumber: 1,
        },
      },
    ]);
    tokens = lexer.lex("World");

    expect([...tokens]).toStrictEqual([
      {
        value: "Hello World",
        delimiter: Delimiter.Record,
        delimiterLength: 0,
        location: {
          start: { line: 2, column: 1, offset: 12 },
          end: { line: 2, column: 12, offset: 23 },
          rowNumber: 2,
        },
      },
    ]);
  });

  test("should utilize buffers for lexical analysis with escaped", () => {
    let tokens = lexer.lex('"Hello World"\n"Hello"', { stream: true });
    expect([...tokens]).toStrictEqual([
      {
        value: "Hello World",
        delimiter: Delimiter.Record,
        delimiterLength: 1,
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 14, offset: 13 },
          rowNumber: 1,
        },
      },
    ]);
    tokens = lexer.lex('"World"');

    expect([...tokens]).toStrictEqual([
      {
        value: 'Hello"World',
        delimiter: Delimiter.Record,
        delimiterLength: 0,
        location: {
          start: { line: 2, column: 1, offset: 14 },
          end: { line: 2, column: 15, offset: 28 },
          rowNumber: 2,
        },
      },
    ]);
  });

  test("should thorw an error if the field is not closed", () => {
    expect(() => [...lexer.lex('"Hello')]).toThrowErrorMatchingInlineSnapshot(
      "[ParseError: Unexpected EOF while parsing quoted field.]",
    );
  });

  describe("when AbortSignal is provided", () => {
    let controller: AbortController;
    beforeEach(() => {
      controller = new AbortController();
      lexer = new FlexibleStringCSVLexer({
        signal: controller.signal,
        trackLocation: true,
      });
    });

    test("should thorw DOMException named AbortError if the signal is aborted", () => {
      controller.abort();
      try {
        [...lexer.lex('"Hello"')];
        expect.unreachable();
      } catch (error) {
        assert(error instanceof DOMException);
        expect(error.name).toBe("AbortError");
      }
    });

    test("should throw custom error if the signal is aborted with custom reason", () => {
      class MyCustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "MyCustomError";
        }
      }

      controller.abort(new MyCustomError("Custom reason"));

      expect(() => [
        ...lexer.lex('"Hello"'),
      ]).toThrowErrorMatchingInlineSnapshot("[MyCustomError: Custom reason]");
    });
  });

  test("should throw DOMException named TimeoutError if the signal is aborted with timeout", async () => {
    function waitAbort(signal: AbortSignal) {
      return new Promise<void>((resolve) => {
        signal.addEventListener("abort", () => {
          resolve();
        });
      });
    }
    const signal = AbortSignal.timeout(0);
    await waitAbort(signal);

    lexer = new FlexibleStringCSVLexer({ signal, trackLocation: true });
    try {
      [...lexer.lex('"Hello"')];
      expect.unreachable();
    } catch (error) {
      assert(error instanceof DOMException);
      expect(error.name).toBe("TimeoutError");
    }
  });

  describe("error message details with source", () => {
    test("should include source in ParseError when provided", () => {
      const lexerWithSource = new FlexibleStringCSVLexer({
        source: "test.csv",
      });

      try {
        // Unclosed quoted field will throw ParseError
        [...lexerWithSource.lex('"unclosed')];
        expect.unreachable();
      } catch (error) {
        assert(error instanceof Error);
        expect(error.name).toBe("ParseError");
        expect((error as any).source).toBe("test.csv");
      }
    });

    test("should include row number in ParseError", () => {
      // trackLocation: true is required to get rowNumber in errors
      const lexerWithSource = new FlexibleStringCSVLexer({
        trackLocation: true,
      });

      try {
        // Invalid CSV: unclosed quoted field (missing closing quote before EOF)
        [...lexerWithSource.lex('name,age\n"Alice')];
        expect.unreachable();
      } catch (error) {
        assert(error instanceof Error);
        expect(error.name).toBe("ParseError");
        // Should mention row number in error
        expect((error as any).rowNumber).toBeGreaterThan(0);
      }
    });

    test("should include both source and row number in ParseError", () => {
      // trackLocation: true is required to get rowNumber in errors
      const lexerWithSource = new FlexibleStringCSVLexer({
        source: "data.csv",
        trackLocation: true,
      });

      try {
        // Unclosed quoted field
        [...lexerWithSource.lex('"field1","field2"\n"value1","unclosed')];
        expect.unreachable();
      } catch (error) {
        assert(error instanceof Error);
        expect(error.name).toBe("ParseError");
        expect((error as any).source).toBe("data.csv");
        expect((error as any).rowNumber).toBeGreaterThan(0);
      }
    });

    test("should not include source when not provided", () => {
      const lexerWithoutSource = new FlexibleStringCSVLexer();

      try {
        [...lexerWithoutSource.lex('"unclosed')];
        expect.unreachable();
      } catch (error) {
        assert(error instanceof Error);
        expect(error.name).toBe("ParseError");
        expect((error as any).source).toBeUndefined();
      }
    });
  });

  describe("Undefined checks", () => {
    test("should handle empty buffer during quoted field parsing with flush", () => {
      const lexerWithoutLocation = new FlexibleStringCSVLexer();

      // Start a quoted field but don't complete it
      // This should trigger the undefined check when flush is called
      expect(() => {
        const gen = lexerWithoutLocation.lex('"incomplete');
        Array.from(gen);
      }).toThrow(ParseError);
    });

    test("should parse complete quoted field correctly", () => {
      const lexerWithoutLocation = new FlexibleStringCSVLexer();

      // Process a complete quoted field
      const gen = lexerWithoutLocation.lex('"field"');
      const tokens = Array.from(gen);

      // Should successfully parse the complete field
      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.value).toBe("field");
    });

    test("should parse a single unquoted field", () => {
      const lexerWithoutLocation = new FlexibleStringCSVLexer();

      // Normal field parsing should work correctly
      const gen = lexerWithoutLocation.lex("field");
      const tokens = Array.from(gen);

      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.value).toBe("field");
    });
  });

  describe("Buffer Overflow Protection", () => {
    describe("with default buffer size (10M characters)", () => {
      let lexerWithoutLocation: FlexibleStringCSVLexer;
      beforeEach(() => {
        lexerWithoutLocation = new FlexibleStringCSVLexer();
      });

      test("should not throw error for normal-sized input", () => {
        const data = "a,b,c\n".repeat(1000);
        expect(() => [...lexerWithoutLocation.lex(data)]).not.toThrow();
      });

      test("should throw RangeError when buffer exceeds 10M characters", () => {
        // Create a large chunk that exceeds 10M characters
        const largeChunk = "a".repeat(11 * 1024 * 1024); // 11M characters

        expect(() => [...lexerWithoutLocation.lex(largeChunk)]).toThrow(
          RangeError,
        );
      });

      test("should throw RangeError with proper error details", () => {
        const largeChunk = "a".repeat(11 * 1024 * 1024); // 11M characters

        try {
          [...lexerWithoutLocation.lex(largeChunk)];
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
            [...lexerWithoutLocation.lex(smallChunk, { stream: true })]; // buffering = true
          }
        }).toThrow(RangeError);
      });

      test("should throw RangeError on unclosed quoted field", () => {
        // Attack vector: unclosed quoted field that accumulates in buffer
        const unclosedQuote = `"${"a".repeat(11 * 1024 * 1024)}`;

        expect(() => [
          ...lexerWithoutLocation.lex(unclosedQuote, { stream: true }),
        ]).toThrow(RangeError);
      });
    });

    describe("with custom buffer size", () => {
      test("should respect custom maxBufferSize option", () => {
        const lexerWithCustomBuffer = new FlexibleStringCSVLexer({
          maxBufferSize: 1024,
        }); // 1K characters limit
        const largeChunk = "a".repeat(2048); // 2K characters

        expect(() => [...lexerWithCustomBuffer.lex(largeChunk)]).toThrow(
          RangeError,
        );
      });

      test("should allow Infinity as maxBufferSize to disable limit", () => {
        const lexerWithInfiniteBuffer = new FlexibleStringCSVLexer({
          maxBufferSize: Number.POSITIVE_INFINITY,
        });
        const largeChunk = "a".repeat(20 * 1024 * 1024); // 20M characters

        // This should not throw, but may take some time and memory
        // We'll just verify it doesn't throw immediately
        expect(() => [...lexerWithInfiniteBuffer.lex(largeChunk)]).not.toThrow(
          RangeError,
        );
      });
    });

    describe("buffer size check timing", () => {
      test("should check buffer size after each chunk addition", () => {
        const lexerWithSmallBuffer = new FlexibleStringCSVLexer({
          maxBufferSize: 100,
        });

        // First chunk is within limit
        expect(() => [
          ...lexerWithSmallBuffer.lex("a".repeat(50), { stream: true }),
        ]).not.toThrow();

        // Second chunk exceeds limit
        expect(() => [
          ...lexerWithSmallBuffer.lex("a".repeat(60), { stream: true }),
        ]).toThrow(RangeError);
      });

      test("should not check buffer size when chunk is empty", () => {
        const lexerWithTinyBuffer = new FlexibleStringCSVLexer({
          maxBufferSize: 10,
        });
        // Pre-fill buffer to near limit
        [...lexerWithTinyBuffer.lex("a".repeat(8), { stream: true })];

        // Empty chunk should not trigger check
        expect(() => [
          ...lexerWithTinyBuffer.lex("", { stream: true }),
        ]).not.toThrow();

        // Null chunk should not trigger check
        expect(() => [
          ...lexerWithTinyBuffer.lex(undefined, { stream: true }),
        ]).not.toThrow();
      });
    });

    describe("realistic attack scenarios", () => {
      test("should prevent DoS via malformed CSV without delimiters", () => {
        const lexerWithMediumBuffer = new FlexibleStringCSVLexer({
          maxBufferSize: 1024 * 1024,
        }); // 1M characters limit
        // Malformed CSV that doesn't match any token pattern
        const malformedData = "x".repeat(2 * 1024 * 1024); // 2M characters of invalid data

        expect(() => [...lexerWithMediumBuffer.lex(malformedData)]).toThrow(
          RangeError,
        );
      });

      test("should prevent DoS via streaming incomplete quoted fields", () => {
        const lexerWithMediumBuffer = new FlexibleStringCSVLexer({
          maxBufferSize: 512 * 1024,
        }); // 512K characters limit

        expect(() => {
          // Stream chunks of quoted field without closing quote
          for (let i = 0; i < 10; i++) {
            const chunk =
              i === 0
                ? `"${"data".repeat(1024 * 30)}`
                : "data".repeat(1024 * 30);
            [...lexerWithMediumBuffer.lex(chunk, { stream: true })];
          }
        }).toThrow(RangeError);
      });

      test("should prevent infinite loop with escaped quotes in long field", () => {
        const lexerWithMediumBuffer = new FlexibleStringCSVLexer({
          maxBufferSize: 256 * 1024,
        }); // 256K characters limit

        expect(() => {
          // Attack: Field with many escaped quotes that doesn't close
          // This simulates the do-while loop scenario mentioned in the security report
          const chunk = `"${'""'.repeat(150 * 1024)}`;
          [...lexerWithMediumBuffer.lex(chunk, { stream: true })];
        }).toThrow(RangeError);
      });

      test("should handle streaming with escaped quotes that eventually exceeds buffer", () => {
        const lexerWithMediumBuffer = new FlexibleStringCSVLexer({
          maxBufferSize: 128 * 1024,
        }); // 128K characters limit

        expect(() => {
          // Stream multiple chunks with escaped quotes
          for (let i = 0; i < 5; i++) {
            const chunk =
              i === 0 ? `"${'""'.repeat(30 * 1024)}` : '""'.repeat(30 * 1024);
            [...lexerWithMediumBuffer.lex(chunk, { stream: true })];
          }
        }).toThrow(RangeError);
      });

      test("should properly parse valid quoted field with many escaped quotes within limit", () => {
        const lexerWithLargeBuffer = new FlexibleStringCSVLexer({
          maxBufferSize: 1024 * 1024,
        }); // 1M characters limit
        // Valid field with escaped quotes that closes properly
        const validData = `"${'""'.repeat(1000)}"`;

        const tokens = [...lexerWithLargeBuffer.lex(validData)];
        expect(tokens).toHaveLength(1);
        expect(tokens[0]?.delimiter).toBe(Delimiter.Record);
        expect(tokens[0]?.value).toBe('"'.repeat(1000));
      });
    });
  });
});
