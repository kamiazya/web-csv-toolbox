import { assert, beforeEach, describe, expect, test } from "vitest";
import { Lexer } from "./Lexer";
import { Field, FieldDelimiter, RecordDelimiter } from "./common/constants";

describe("Lexer", () => {
  let lexer: Lexer;
  beforeEach(() => {
    lexer = new Lexer();
  });

  test("should parse mixed CRLF and LF record delimiters correctly", () => {
    const csvMixed = "field1,field2\r\nfield3,field4\nfield5,field6";
    const tokens = lexer.lex(csvMixed);

    expect([...tokens]).toStrictEqual([
      // --- Row 1 (Field 1, Delimiter, Field 2) ---
      {
        type: Field,
        value: "field1",
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 7, offset: 6 },
          rowNumber: 1,
        },
      },
      {
        type: FieldDelimiter,
        value: ",",
        location: {
          start: { line: 1, column: 7, offset: 6 },
          end: { line: 1, column: 8, offset: 7 },
          rowNumber: 1,
        },
      },
      {
        type: Field,
        value: "field2",
        location: {
          start: { line: 1, column: 8, offset: 7 },
          end: { line: 1, column: 14, offset: 13 },
          rowNumber: 1,
        },
      },
      // --- Record Delimiter 1 (CRLF) ---
      {
        type: RecordDelimiter,
        value: "\r\n",
        location: {
          start: { line: 1, column: 14, offset: 13 },
          end: { line: 2, column: 1, offset: 15 },
          rowNumber: 1,
        },
      },
      // --- Row 2 (Field 3, Delimiter, Field 4) ---
      {
        type: Field,
        value: "field3",
        location: {
          start: { line: 2, column: 1, offset: 15 },
          end: { line: 2, column: 7, offset: 21 },
          rowNumber: 2,
        },
      },
      {
        type: FieldDelimiter,
        value: ",",
        location: {
          start: { line: 2, column: 7, offset: 21 },
          end: { line: 2, column: 8, offset: 22 },
          rowNumber: 2,
        },
      },
      {
        type: Field,
        value: "field4",
        location: {
          start: { line: 2, column: 8, offset: 22 },
          end: { line: 2, column: 14, offset: 28 },
          rowNumber: 2,
        },
      },
      // --- Record Delimiter 2 (LF) ---
      {
        type: RecordDelimiter,
        value: "\n",
        location: {
          start: { line: 2, column: 14, offset: 28 },
          end: { line: 3, column: 1, offset: 29 },
          rowNumber: 2,
        },
      },
      // --- Row 3 (Field 5, Delimiter, Field 6) ---
      {
        type: Field,
        value: "field5",
        location: {
          start: { line: 3, column: 1, offset: 29 },
          end: { line: 3, column: 7, offset: 35 },
          rowNumber: 3,
        },
      },
      {
        type: FieldDelimiter,
        value: ",",
        location: {
          start: { line: 3, column: 7, offset: 35 },
          end: { line: 3, column: 8, offset: 36 },
          rowNumber: 3,
        },
      },
      {
        type: Field,
        value: "field6",
        location: {
          start: { line: 3, column: 8, offset: 36 },
          end: { line: 3, column: 14, offset: 42 },
          rowNumber: 3,
        },
      },
    ]);
  });

  test("should parse a field with not escaped", () => {
    const tokens = lexer.lex("field");
    expect([...tokens]).toStrictEqual([
      {
        type: Field,
        value: "field",
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
        type: Field,
        value: "field",
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 8, offset: 7 },
          rowNumber: 1,
        },
      },
    ]);
  });

  test("should parse a field with escaped and delimiter", () => {
    const tokens = lexer.lex('"field",');
    expect([...tokens]).toStrictEqual([
      {
        type: Field,
        value: "field",
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 8, offset: 7 },
          rowNumber: 1,
        },
      },
      {
        type: FieldDelimiter,
        value: ",",
        location: {
          start: { line: 1, column: 8, offset: 7 },
          end: { line: 1, column: 9, offset: 8 },
          rowNumber: 1,
        },
      },
    ]);
  });

  test("should parse a field with escaped and delimiter and record delimiter", () => {
    const tokens = lexer.lex('"fie\nld"\n"Hello\nWorld"');
    expect([...tokens]).toStrictEqual([
      {
        type: Field,
        value: "fie\nld",
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 2, column: 4, offset: 8 },
          rowNumber: 1,
        },
      },
      {
        type: RecordDelimiter,
        value: "\n",
        location: {
          start: { line: 2, column: 4, offset: 8 },
          end: { line: 3, column: 1, offset: 9 },
          rowNumber: 1,
        },
      },
      {
        type: Field,
        value: "Hello\nWorld",
        location: {
          start: { line: 3, column: 1, offset: 9 },
          end: { line: 4, column: 7, offset: 22 },
          rowNumber: 2,
        },
      },
    ]);
  });

  test("should parse a field with escaped and delimiter and record delimiter and EOF(LF)", () => {
    const tokens = lexer.lex('"fie\nld"\nHello World\n');
    expect([...tokens]).toStrictEqual([
      {
        type: Field,
        value: "fie\nld",
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 2, column: 4, offset: 8 },
          rowNumber: 1,
        },
      },
      {
        type: RecordDelimiter,
        value: "\n",
        location: {
          start: { line: 2, column: 4, offset: 8 },
          end: { line: 3, column: 1, offset: 9 },
          rowNumber: 1,
        },
      },
      {
        type: Field,
        value: "Hello World",
        location: {
          start: { line: 3, column: 1, offset: 9 },
          end: { line: 3, column: 12, offset: 20 },
          rowNumber: 2,
        },
      },
      {
        type: RecordDelimiter,
        value: "\n",
        location: {
          start: { line: 3, column: 12, offset: 20 },
          end: { line: 4, column: 1, offset: 21 },
          rowNumber: 2,
        },
      },
    ]);
  });

  test("should parse a field with escaped and delimiter and record delimiter and EOF(RCLF)", () => {
    const tokens = lexer.lex('"fie\r\nld"\r\nHello World\r\n');
    expect([...tokens]).toStrictEqual([
      {
        type: Field,
        value: "fie\r\nld",
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 2, column: 4, offset: 9 },
          rowNumber: 1,
        },
      },
      {
        type: RecordDelimiter,
        value: "\r\n",
        location: {
          start: { line: 2, column: 4, offset: 9 },
          end: { line: 3, column: 1, offset: 11 },
          rowNumber: 1,
        },
      },
      {
        type: Field,
        value: "Hello World",
        location: {
          start: { line: 3, column: 1, offset: 11 },
          end: { line: 3, column: 12, offset: 22 },
          rowNumber: 2,
        },
      },
      {
        type: RecordDelimiter,
        value: "\r\n",
        location: {
          start: { line: 3, column: 12, offset: 22 },
          end: { line: 4, column: 1, offset: 24 },
          rowNumber: 2,
        },
      },
    ]);
  });

  test("should utilize buffers for lexical analysis", () => {
    let tokens = lexer.lex("Hello World\nHello ", true);
    expect([...tokens]).toStrictEqual([
      {
        type: Field,
        value: "Hello World",
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 12, offset: 11 },
          rowNumber: 1,
        },
      },
      {
        type: RecordDelimiter,
        value: "\n",
        location: {
          start: { line: 1, column: 12, offset: 11 },
          end: { line: 2, column: 1, offset: 12 },
          rowNumber: 1,
        },
      },
    ]);
    tokens = lexer.lex("World");

    expect([...tokens]).toStrictEqual([
      {
        type: Field,
        value: "Hello World",
        location: {
          start: { line: 2, column: 1, offset: 12 },
          end: { line: 2, column: 12, offset: 23 },
          rowNumber: 2,
        },
      },
    ]);
  });

  test("should utilize buffers for lexical analysis with escaped", () => {
    let tokens = lexer.lex('"Hello World"\n"Hello"', true);
    expect([...tokens]).toStrictEqual([
      {
        type: Field,
        value: "Hello World",
        location: {
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 14, offset: 13 },
          rowNumber: 1,
        },
      },
      {
        type: RecordDelimiter,
        value: "\n",
        location: {
          start: { line: 1, column: 14, offset: 13 },
          end: { line: 2, column: 1, offset: 14 },
          rowNumber: 1,
        },
      },
    ]);
    tokens = lexer.lex('"World"');

    expect([...tokens]).toStrictEqual([
      {
        type: Field,
        value: 'Hello"World',
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
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[ParseError: Unexpected EOF while parsing quoted field.]`,
    );
  });

  describe("when AbortSignal is provided", () => {
    let controller: AbortController;
    beforeEach(() => {
      controller = new AbortController();
      lexer = new Lexer({
        signal: controller.signal,
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
      ]).toThrowErrorMatchingInlineSnapshot(
        // biome-ignore lint/style/noUnusedTemplateLiteral: <explanation>
        `[MyCustomError: Custom reason]`,
      );
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

    lexer = new Lexer({ signal });
    try {
      [...lexer.lex('"Hello"')];
      expect.unreachable();
    } catch (error) {
      assert(error instanceof DOMException);
      expect(error.name).toBe("TimeoutError");
    }
  });
});
