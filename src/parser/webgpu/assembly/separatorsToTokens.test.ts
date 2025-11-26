/**
 * Unit tests for separatorsToTokens
 */

import { describe, expect, it } from "vitest";
import { Field, FieldDelimiter, RecordDelimiter } from "@/core/constants.ts";
import { SEP_TYPE_COMMA, SEP_TYPE_LF } from "@/parser/webgpu/indexing/types.ts";
import { packSeparator } from "@/parser/webgpu/utils/separator-utils.ts";
import {
  separatorsToTokens,
  separatorsToTokensGenerator,
} from "./separatorsToTokens.ts";

const encoder = new TextEncoder();

describe("separatorsToTokens", () => {
  describe("basic functionality", () => {
    it("should convert single field", () => {
      // Data: "hello" (no separators)
      const data = encoder.encode("hello");
      const separators = new Uint32Array(0);

      const result = separatorsToTokens(separators, 0, data);

      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0]!.type).toBe(Field);
      expect(result.tokens[0]!.value).toBe("hello");
    });

    it("should convert single row with two fields", () => {
      // Data: "a,b\n"
      const data = encoder.encode("a,b\n");
      const separators = new Uint32Array([
        packSeparator(1, SEP_TYPE_COMMA), // comma at offset 1
        packSeparator(3, SEP_TYPE_LF), // LF at offset 3
      ]);

      const result = separatorsToTokens(separators, 2, data);

      expect(result.tokens).toHaveLength(4); // field, comma, field, LF
      expect(result.tokens[0]!.type).toBe(Field);
      expect(result.tokens[0]!.value).toBe("a");
      expect(result.tokens[1]!.type).toBe(FieldDelimiter);
      expect(result.tokens[2]!.type).toBe(Field);
      expect(result.tokens[2]!.value).toBe("b");
      expect(result.tokens[3]!.type).toBe(RecordDelimiter);
    });

    it("should handle multiple rows", () => {
      // Data: "a,b\nc,d\n"
      const data = encoder.encode("a,b\nc,d\n");
      const separators = new Uint32Array([
        packSeparator(1, SEP_TYPE_COMMA), // comma at offset 1
        packSeparator(3, SEP_TYPE_LF), // LF at offset 3
        packSeparator(5, SEP_TYPE_COMMA), // comma at offset 5
        packSeparator(7, SEP_TYPE_LF), // LF at offset 7
      ]);

      const result = separatorsToTokens(separators, 4, data);

      expect(result.tokens).toHaveLength(8);

      // First row
      expect(result.tokens[0]!.value).toBe("a");
      expect(result.tokens[1]!.type).toBe(FieldDelimiter);
      expect(result.tokens[2]!.value).toBe("b");
      expect(result.tokens[3]!.type).toBe(RecordDelimiter);

      // Second row
      expect(result.tokens[4]!.value).toBe("c");
      expect(result.tokens[5]!.type).toBe(FieldDelimiter);
      expect(result.tokens[6]!.value).toBe("d");
      expect(result.tokens[7]!.type).toBe(RecordDelimiter);
    });
  });

  describe("quoted fields", () => {
    it("should unescape quoted fields", () => {
      // Data: '"hello",' - quoted field followed by comma
      const data = encoder.encode('"hello",');
      const separators = new Uint32Array([
        packSeparator(7, SEP_TYPE_COMMA), // comma at offset 7
      ]);

      const result = separatorsToTokens(separators, 1, data);

      expect(result.tokens[0]!.type).toBe(Field);
      expect(result.tokens[0]!.value).toBe("hello");
    });

    it("should unescape escaped quotes", () => {
      // Data: '"he""llo",' - field with escaped quote
      const data = encoder.encode('"he""llo",');
      const separators = new Uint32Array([
        packSeparator(9, SEP_TYPE_COMMA), // comma at offset 9
      ]);

      const result = separatorsToTokens(separators, 1, data);

      expect(result.tokens[0]!.type).toBe(Field);
      expect(result.tokens[0]!.value).toBe('he"llo');
    });

    it("should handle empty quoted field", () => {
      // Data: '"",' - empty quoted field
      const data = encoder.encode('"",');
      const separators = new Uint32Array([packSeparator(2, SEP_TYPE_COMMA)]);

      const result = separatorsToTokens(separators, 1, data);

      expect(result.tokens[0]!.value).toBe("");
    });
  });

  describe("location tracking", () => {
    it("should track line and column correctly", () => {
      // Data: "a,b\nc,d\n"
      const data = encoder.encode("a,b\nc,d\n");
      const separators = new Uint32Array([
        packSeparator(1, SEP_TYPE_COMMA),
        packSeparator(3, SEP_TYPE_LF),
        packSeparator(5, SEP_TYPE_COMMA),
        packSeparator(7, SEP_TYPE_LF),
      ]);

      const result = separatorsToTokens(separators, 4, data);

      // First field "a"
      expect(result.tokens[0]!.location.start.line).toBe(1);
      expect(result.tokens[0]!.location.start.column).toBe(1);
      expect(result.tokens[0]!.location.rowNumber).toBe(1);

      // Second row, first field "c"
      expect(result.tokens[4]!.location.start.line).toBe(2);
      expect(result.tokens[4]!.location.start.column).toBe(1);
      expect(result.tokens[4]!.location.rowNumber).toBe(2);
    });

    it("should track row numbers correctly", () => {
      const data = encoder.encode("a\nb\nc\n");
      const separators = new Uint32Array([
        packSeparator(1, SEP_TYPE_LF),
        packSeparator(3, SEP_TYPE_LF),
        packSeparator(5, SEP_TYPE_LF),
      ]);

      const result = separatorsToTokens(separators, 3, data);

      // Each row has field + LF
      expect(result.tokens[0]!.location.rowNumber).toBe(1); // "a"
      expect(result.tokens[2]!.location.rowNumber).toBe(2); // "b"
      expect(result.tokens[4]!.location.rowNumber).toBe(3); // "c"
    });

    it("should allow custom starting position", () => {
      const data = encoder.encode("x\n");
      const separators = new Uint32Array([packSeparator(1, SEP_TYPE_LF)]);

      const result = separatorsToTokens(separators, 1, data, {
        rowNumber: 5,
        startLine: 10,
        startColumn: 20,
        startOffset: 100,
      });

      expect(result.tokens[0]!.location.start.line).toBe(10);
      expect(result.tokens[0]!.location.start.column).toBe(20);
      expect(result.tokens[0]!.location.start.offset).toBe(100);
      expect(result.tokens[0]!.location.rowNumber).toBe(5);
    });
  });

  describe("state continuation", () => {
    it("should return correct state for continuation", () => {
      const data = encoder.encode("a,b\n");
      const separators = new Uint32Array([
        packSeparator(1, SEP_TYPE_COMMA),
        packSeparator(3, SEP_TYPE_LF),
      ]);

      const result = separatorsToTokens(separators, 2, data);

      expect(result.state.rowNumber).toBe(2); // Moved to row 2
      expect(result.state.line).toBe(2); // Moved to line 2
      expect(result.state.column).toBe(1); // Start of new line
      expect(result.state.offset).toBe(4); // 4 bytes processed
    });

    it("should work with state continuation", () => {
      // First chunk: "a,b\n"
      const data1 = encoder.encode("a,b\n");
      const sep1 = new Uint32Array([
        packSeparator(1, SEP_TYPE_COMMA),
        packSeparator(3, SEP_TYPE_LF),
      ]);

      const result1 = separatorsToTokens(sep1, 2, data1);

      // Second chunk: "c,d\n" with continuation
      const data2 = encoder.encode("c,d\n");
      const sep2 = new Uint32Array([
        packSeparator(1, SEP_TYPE_COMMA),
        packSeparator(3, SEP_TYPE_LF),
      ]);

      const result2 = separatorsToTokens(sep2, 2, data2, {
        rowNumber: result1.state.rowNumber,
        startLine: result1.state.line,
        startColumn: result1.state.column,
        startOffset: result1.state.offset,
      });

      // Should be row 2
      expect(result2.tokens[0]!.location.rowNumber).toBe(2);
      expect(result2.tokens[0]!.location.start.line).toBe(2);
      expect(result2.tokens[0]!.location.start.offset).toBe(4);
    });
  });

  describe("CRLF handling", () => {
    it("should detect CRLF line endings", () => {
      // Data: "a\r\n" - CRLF line ending
      // Note: LF at offset 2 (the \n in \r\n)
      const data = encoder.encode("a\r\n");
      const separators = new Uint32Array([
        packSeparator(2, SEP_TYPE_LF), // LF at offset 2
      ]);

      const result = separatorsToTokens(separators, 1, data);

      expect(result.tokens[1]!.type).toBe(RecordDelimiter);
      expect(result.tokens[1]!.value).toBe("\r\n");
    });
  });

  describe("trailing field", () => {
    it("should handle data after last separator", () => {
      // Data: "a,b" (no trailing LF)
      const data = encoder.encode("a,b");
      const separators = new Uint32Array([packSeparator(1, SEP_TYPE_COMMA)]);

      const result = separatorsToTokens(separators, 1, data);

      expect(result.tokens).toHaveLength(3); // field, comma, trailing field
      expect(result.tokens[2]!.type).toBe(Field);
      expect(result.tokens[2]!.value).toBe("b");
    });
  });
});

describe("separatorsToTokensGenerator", () => {
  it("should yield tokens one at a time", () => {
    const data = encoder.encode("a,b\n");
    const separators = new Uint32Array([
      packSeparator(1, SEP_TYPE_COMMA),
      packSeparator(3, SEP_TYPE_LF),
    ]);

    const gen = separatorsToTokensGenerator(separators, 2, data);

    const token1 = gen.next();
    expect(token1.done).toBe(false);
    expect((token1.value as { type: symbol }).type).toBe(Field);
    expect((token1.value as { value: string }).value).toBe("a");

    const token2 = gen.next();
    expect(token2.done).toBe(false);
    expect((token2.value as { type: symbol }).type).toBe(FieldDelimiter);

    const token3 = gen.next();
    expect(token3.done).toBe(false);
    expect((token3.value as { type: symbol }).type).toBe(Field);
    expect((token3.value as { value: string }).value).toBe("b");

    const token4 = gen.next();
    expect(token4.done).toBe(false);
    expect((token4.value as { type: symbol }).type).toBe(RecordDelimiter);

    const token5 = gen.next();
    expect(token5.done).toBe(true);
    expect(token5.value).toEqual({
      rowNumber: 2,
      line: 2,
      column: 1,
      offset: 4,
    });
  });

  it("should produce same results as non-generator version", () => {
    const data = encoder.encode("hello,world\nfoo,bar\n");
    const separators = new Uint32Array([
      packSeparator(5, SEP_TYPE_COMMA),
      packSeparator(11, SEP_TYPE_LF),
      packSeparator(15, SEP_TYPE_COMMA),
      packSeparator(19, SEP_TYPE_LF),
    ]);

    const arrayResult = separatorsToTokens(separators, 4, data);
    const genResult: typeof arrayResult.tokens = [];

    const gen = separatorsToTokensGenerator(separators, 4, data);
    let result = gen.next();
    while (!result.done) {
      genResult.push(result.value);
      result = gen.next();
    }

    expect(genResult).toEqual(arrayResult.tokens);
  });
});
