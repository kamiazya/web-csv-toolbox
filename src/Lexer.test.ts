import { beforeEach, describe, expect, test } from "vitest";
import { Lexer } from "./Lexer";
import { Field, FieldDelimiter, RecordDelimiter } from "./common/constants";

describe("Lexer", () => {
  let lexer: Lexer;
  beforeEach(() => {
    lexer = new Lexer();
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
          end: { line: 1, column: 7, offset: 7 },
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
          end: { line: 1, column: 7, offset: 7 },
          rowNumber: 1,
        },
      },
      {
        type: FieldDelimiter,
        value: ",",
        location: {
          start: { line: 1, column: 7, offset: 7 },
          end: { line: 1, column: 8, offset: 8 },
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

  test("should parse a field with escaped and delimiter and record delimiter and EOF", () => {
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
    ]);
  });
});
