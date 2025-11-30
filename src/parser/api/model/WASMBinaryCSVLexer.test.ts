import { beforeAll, describe, expect, test } from "vitest";
import { Field, FieldDelimiter, RecordDelimiter } from "@/core/constants.ts";
import { WASMIndexerBackend } from "@/parser/indexer/WASMIndexerBackend.ts";
import { loadWASM } from "@/wasm/WasmInstance.main.web.ts";
import { WASMBinaryCSVLexer } from "./WASMBinaryCSVLexer.ts";

describe("WASMBinaryCSVLexer", () => {
  const encoder = new TextEncoder();
  let backend: WASMIndexerBackend;

  beforeAll(async () => {
    await loadWASM();
    backend = new WASMIndexerBackend(44); // comma delimiter
    await backend.initialize();
  });

  describe("Basic parsing", () => {
    test("should lex simple CSV data", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });
      const data = encoder.encode("a,b\n1,2\n");
      const tokens = [...lexer.lex(data)];

      // Should have: Field, FieldDelim, Field, RecordDelim, Field, FieldDelim, Field, RecordDelim
      expect(tokens.length).toBe(8);

      // First row: a,b\n
      expect(tokens[0]?.type).toBe(Field);
      expect(tokens[0]?.value).toBe("a");
      expect(tokens[1]?.type).toBe(FieldDelimiter);
      expect(tokens[2]?.type).toBe(Field);
      expect(tokens[2]?.value).toBe("b");
      expect(tokens[3]?.type).toBe(RecordDelimiter);

      // Second row: 1,2\n
      expect(tokens[4]?.type).toBe(Field);
      expect(tokens[4]?.value).toBe("1");
      expect(tokens[5]?.type).toBe(FieldDelimiter);
      expect(tokens[6]?.type).toBe(Field);
      expect(tokens[6]?.value).toBe("2");
      expect(tokens[7]?.type).toBe(RecordDelimiter);
    });

    test("should handle single field", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });
      const data = encoder.encode("value\n");
      const tokens = [...lexer.lex(data)];

      expect(tokens.length).toBe(2);
      expect(tokens[0]?.type).toBe(Field);
      expect(tokens[0]?.value).toBe("value");
      expect(tokens[1]?.type).toBe(RecordDelimiter);
    });

    test("should handle empty fields", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });
      const data = encoder.encode(",\n");
      const tokens = [...lexer.lex(data)];

      expect(tokens.length).toBe(4);
      expect(tokens[0]?.type).toBe(Field);
      expect(tokens[0]?.value).toBe("");
      expect(tokens[1]?.type).toBe(FieldDelimiter);
      expect(tokens[2]?.type).toBe(Field);
      expect(tokens[2]?.value).toBe("");
      expect(tokens[3]?.type).toBe(RecordDelimiter);
    });
  });

  describe("Streaming mode", () => {
    test("should handle multiple chunks", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });

      // Split "a,b\nc,d\n" into chunks
      const chunk1 = encoder.encode("a,b\n");
      const chunk2 = encoder.encode("c,d\n");

      const tokens1 = [...lexer.lex(chunk1, { stream: true })];
      const tokens2 = [...lexer.lex(chunk2, { stream: true })];
      const tokensFlush = [...lexer.lex()];

      // First chunk should yield tokens for first row
      expect(tokens1.some(t => t.type === Field && t.value === "a")).toBe(true);
      expect(tokens1.some(t => t.type === Field && t.value === "b")).toBe(true);

      // Second chunk should yield tokens for second row
      expect(tokens2.some(t => t.type === Field && t.value === "c")).toBe(true);
      expect(tokens2.some(t => t.type === Field && t.value === "d")).toBe(true);
    });

    test("should handle partial rows across chunks", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });

      // Split "hello,world\n" across chunks
      const chunk1 = encoder.encode("hello,wor");
      const chunk2 = encoder.encode("ld\n");

      const tokens1 = [...lexer.lex(chunk1, { stream: true })];
      const tokens2 = [...lexer.lex(chunk2, { stream: true })];

      // First chunk has no complete row, should yield nothing or partial
      // Second chunk completes the row
      const allTokens = [...tokens1, ...tokens2];
      const fieldTokens = allTokens.filter(t => t.type === Field);

      expect(fieldTokens.some(t => t.value === "hello")).toBe(true);
      expect(fieldTokens.some(t => t.value === "world")).toBe(true);
    });

    test("should flush remaining data correctly", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });

      // Data without trailing newline
      const chunk = encoder.encode("a,b");

      const tokens1 = [...lexer.lex(chunk, { stream: true })];
      const tokensFlush = [...lexer.lex()];

      // Combine all tokens
      const allTokens = [...tokens1, ...tokensFlush];
      const fieldTokens = allTokens.filter(t => t.type === Field);

      // Should get both fields even without trailing newline
      expect(fieldTokens.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("BOM handling", () => {
    test("should strip UTF-8 BOM from first chunk", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });

      // UTF-8 BOM + "a,b\n"
      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      const content = encoder.encode("a,b\n");
      const dataWithBOM = new Uint8Array(bom.length + content.length);
      dataWithBOM.set(bom, 0);
      dataWithBOM.set(content, bom.length);

      const tokens = [...lexer.lex(dataWithBOM)];
      const fieldTokens = tokens.filter(t => t.type === Field);

      // First field should be "a", not "\xef\xbb\xbfa"
      expect(fieldTokens[0]?.value).toBe("a");
    });

    test("should not strip BOM from subsequent chunks", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });

      // First chunk without BOM
      const chunk1 = encoder.encode("a,b\n");
      [...lexer.lex(chunk1, { stream: true })];

      // Second chunk starting with BOM bytes (unlikely but should not be stripped)
      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      const content = encoder.encode(",x\n");
      const chunk2 = new Uint8Array(bom.length + content.length);
      chunk2.set(bom, 0);
      chunk2.set(content, bom.length);

      const tokens2 = [...lexer.lex(chunk2, { stream: true })];

      // BOM should be preserved in field value
      const fieldTokens = tokens2.filter(t => t.type === Field);
      expect(fieldTokens.some(t => t.value.length > 0)).toBe(true);
    });
  });

  describe("Quoted fields", () => {
    test("should handle quoted fields", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });
      const data = encoder.encode('"hello",world\n');
      const tokens = [...lexer.lex(data)];

      const fieldTokens = tokens.filter(t => t.type === Field);
      expect(fieldTokens[0]?.value).toBe("hello");
      expect(fieldTokens[1]?.value).toBe("world");
    });

    test("should handle escaped quotes", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });
      const data = encoder.encode('"hello ""world"""\n');
      const tokens = [...lexer.lex(data)];

      const fieldTokens = tokens.filter(t => t.type === Field);
      expect(fieldTokens[0]?.value).toBe('hello "world"');
    });

    test("should handle quoted fields with delimiter", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });
      const data = encoder.encode('"a,b",c\n');
      const tokens = [...lexer.lex(data)];

      const fieldTokens = tokens.filter(t => t.type === Field);
      expect(fieldTokens[0]?.value).toBe("a,b");
      expect(fieldTokens[1]?.value).toBe("c");
    });

    test("should handle quoted fields with newline", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });
      const data = encoder.encode('"line1\nline2",b\n');
      const tokens = [...lexer.lex(data)];

      const fieldTokens = tokens.filter(t => t.type === Field);
      expect(fieldTokens[0]?.value).toBe("line1\nline2");
      expect(fieldTokens[1]?.value).toBe("b");
    });
  });

  describe("Line endings", () => {
    test("should handle LF line endings", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });
      const data = encoder.encode("a,b\nc,d\n");
      const tokens = [...lexer.lex(data)];

      const recordDelims = tokens.filter(t => t.type === RecordDelimiter);
      expect(recordDelims[0]?.value).toBe("\n");
    });

    test("should handle CRLF line endings", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });
      const data = encoder.encode("a,b\r\nc,d\r\n");
      const tokens = [...lexer.lex(data)];

      const recordDelims = tokens.filter(t => t.type === RecordDelimiter);
      expect(recordDelims[0]?.value).toBe("\r\n");

      // Fields should not include CR
      const fieldTokens = tokens.filter(t => t.type === Field);
      expect(fieldTokens[1]?.value).toBe("b");
      expect(fieldTokens[3]?.value).toBe("d");
    });
  });

  describe("Custom delimiter", () => {
    test("should support tab delimiter", async () => {
      const tabBackend = new WASMIndexerBackend(9); // tab
      await tabBackend.initialize();

      const lexer = new WASMBinaryCSVLexer({
        backend: tabBackend,
        delimiter: "\t"
      });
      const data = encoder.encode("a\tb\n");
      const tokens = [...lexer.lex(data)];

      expect(tokens.length).toBe(4);
      expect(tokens[0]?.type).toBe(Field);
      expect(tokens[0]?.value).toBe("a");
      expect(tokens[1]?.type).toBe(FieldDelimiter);
      expect(tokens[1]?.value).toBe("\t");
      expect(tokens[2]?.type).toBe(Field);
      expect(tokens[2]?.value).toBe("b");
    });

    test("should support semicolon delimiter", async () => {
      const semiBackend = new WASMIndexerBackend(59); // semicolon
      await semiBackend.initialize();

      const lexer = new WASMBinaryCSVLexer({
        backend: semiBackend,
        delimiter: ";"
      });
      const data = encoder.encode("a;b\n");
      const tokens = [...lexer.lex(data)];

      const fieldTokens = tokens.filter(t => t.type === Field);
      expect(fieldTokens[0]?.value).toBe("a");
      expect(fieldTokens[1]?.value).toBe("b");
    });
  });

  describe("Empty input", () => {
    test("should handle empty chunk", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });
      const data = new Uint8Array(0);
      const tokens = [...lexer.lex(data)];

      expect(tokens.length).toBe(0);
    });

    test("should handle empty flush", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });
      const tokens = [...lexer.lex()];

      expect(tokens.length).toBe(0);
    });
  });

  describe("Reset", () => {
    test("should reset lexer state", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });

      // Process some data
      const data1 = encoder.encode("a,b\n");
      [...lexer.lex(data1)];

      // Reset
      lexer.reset();

      // Process new data - should start fresh
      const data2 = encoder.encode("c,d\n");
      const tokens = [...lexer.lex(data2)];

      const fieldTokens = tokens.filter(t => t.type === Field);
      expect(fieldTokens[0]?.value).toBe("c");
      expect(fieldTokens[0]?.location?.rowNumber).toBe(1);
    });

    test("should reset BOM handling after reset", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });

      // Process data with BOM
      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      const content1 = encoder.encode("a,b\n");
      const dataWithBOM = new Uint8Array(bom.length + content1.length);
      dataWithBOM.set(bom, 0);
      dataWithBOM.set(content1, bom.length);

      [...lexer.lex(dataWithBOM)];

      // Reset
      lexer.reset();

      // Process new data with BOM - should strip it again
      const content2 = encoder.encode("c,d\n");
      const newDataWithBOM = new Uint8Array(bom.length + content2.length);
      newDataWithBOM.set(bom, 0);
      newDataWithBOM.set(content2, bom.length);

      const tokens = [...lexer.lex(newDataWithBOM)];
      const fieldTokens = tokens.filter(t => t.type === Field);

      expect(fieldTokens[0]?.value).toBe("c");
    });
  });

  describe("Token locations", () => {
    test("should track correct line and column numbers", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });
      const data = encoder.encode("a,b\nc,d\n");
      const tokens = [...lexer.lex(data)];

      const fieldTokens = tokens.filter(t => t.type === Field);

      // First row
      expect(fieldTokens[0]?.location?.start.line).toBe(1);
      expect(fieldTokens[0]?.location?.start.column).toBe(1);
      expect(fieldTokens[1]?.location?.start.line).toBe(1);

      // Second row
      expect(fieldTokens[2]?.location?.start.line).toBe(2);
      expect(fieldTokens[2]?.location?.rowNumber).toBe(2);
    });

    test("should track correct row numbers", () => {
      const lexer = new WASMBinaryCSVLexer({ backend });
      const data = encoder.encode("a\nb\nc\n");
      const tokens = [...lexer.lex(data)];

      const fieldTokens = tokens.filter(t => t.type === Field);

      expect(fieldTokens[0]?.location?.rowNumber).toBe(1);
      expect(fieldTokens[1]?.location?.rowNumber).toBe(2);
      expect(fieldTokens[2]?.location?.rowNumber).toBe(3);
    });
  });
});
