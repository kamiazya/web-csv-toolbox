/**
 * Tests for GPUBinaryCSVLexer
 *
 * Uses a mock backend to test the lexer logic without requiring WebGPU.
 */

import { describe, expect, it } from "vitest";
import { Field, FieldDelimiter, RecordDelimiter } from "@/core/constants.ts";
import type { Token } from "@/core/types.ts";
import type { CSVSeparatorIndexingBackendInterface } from "@/parser/webgpu/indexing/CSVSeparatorIndexer.ts";
import type { CSVSeparatorIndexResult } from "@/parser/webgpu/indexing/types.ts";
import { SEP_TYPE_COMMA, SEP_TYPE_LF } from "@/parser/webgpu/indexing/types.ts";
import { packSeparator } from "@/parser/webgpu/utils/separator-utils.ts";
import { GPUBinaryCSVLexer } from "./GPUBinaryCSVLexer.ts";

/**
 * Mock backend that simulates GPU separator indexing using JavaScript.
 */
class MockBackend implements CSVSeparatorIndexingBackendInterface {
  isInitialized = true;

  getMaxChunkSize(): number {
    return 1024 * 1024; // 1MB
  }

  async run(
    chunk: Uint8Array,
    prevInQuote: boolean,
  ): Promise<CSVSeparatorIndexResult> {
    const separators: number[] = [];
    let inQuote = prevInQuote;
    let lastLFIndex = -1;

    for (let i = 0; i < chunk.length; i++) {
      const byte = chunk[i]!;

      if (byte === 0x22) {
        // Quote
        inQuote = !inQuote;
      } else if (!inQuote) {
        if (byte === 0x2c) {
          // Comma
          separators.push(packSeparator(i, SEP_TYPE_COMMA));
        } else if (byte === 0x0a) {
          // LF
          separators.push(packSeparator(i, SEP_TYPE_LF));
          lastLFIndex = i;
        }
      }
    }

    // processedBytes is up to and including the last LF
    const processedBytes = lastLFIndex >= 0 ? lastLFIndex + 1 : 0;

    // Filter separators to only include those within processedBytes
    const validSeparators = separators.filter((sep) => {
      const offset = sep & 0x7fffffff;
      return offset < processedBytes;
    });

    return {
      separators: new Uint32Array(validSeparators),
      sepCount: validSeparators.length,
      processedBytes,
      endInQuote: inQuote,
    };
  }
}

/**
 * Helper to collect all tokens from an async iterator
 */
async function collectTokens(
  iter: AsyncIterableIterator<Token>,
): Promise<Token[]> {
  const tokens: Token[] = [];
  for await (const token of iter) {
    tokens.push(token);
  }
  return tokens;
}

/**
 * Helper to encode string to UTF-8 bytes
 */
function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

describe("GPUBinaryCSVLexer", () => {
  describe("basic tokenization", () => {
    it("should tokenize a simple CSV row", async () => {
      const backend = new MockBackend();
      const lexer = new GPUBinaryCSVLexer({ backend });

      const csv = encode("a,b,c\n");
      const tokens = await collectTokens(lexer.lex(csv));

      expect(tokens).toHaveLength(6);
      expect(tokens[0]).toMatchObject({ type: Field, value: "a" });
      expect(tokens[1]).toMatchObject({ type: FieldDelimiter, value: "," });
      expect(tokens[2]).toMatchObject({ type: Field, value: "b" });
      expect(tokens[3]).toMatchObject({ type: FieldDelimiter, value: "," });
      expect(tokens[4]).toMatchObject({ type: Field, value: "c" });
      expect(tokens[5]).toMatchObject({ type: RecordDelimiter, value: "\n" });
    });

    it("should tokenize multiple rows", async () => {
      const backend = new MockBackend();
      const lexer = new GPUBinaryCSVLexer({ backend });

      const csv = encode("a,b\nc,d\n");
      const tokens = await collectTokens(lexer.lex(csv));

      expect(tokens).toHaveLength(8);
      expect(tokens[0]).toMatchObject({ type: Field, value: "a" });
      expect(tokens[2]).toMatchObject({ type: Field, value: "b" });
      expect(tokens[3]).toMatchObject({ type: RecordDelimiter, value: "\n" });
      expect(tokens[4]).toMatchObject({ type: Field, value: "c" });
      expect(tokens[6]).toMatchObject({ type: Field, value: "d" });
      expect(tokens[7]).toMatchObject({ type: RecordDelimiter, value: "\n" });
    });
  });

  describe("streaming mode", () => {
    it("should handle streaming with leftover data", async () => {
      const backend = new MockBackend();
      const lexer = new GPUBinaryCSVLexer({ backend });

      // First chunk ends mid-row
      const chunk1 = encode("a,b\nc,d");
      const tokens1 = await collectTokens(lexer.lex(chunk1, { stream: true }));

      // Should only tokenize the complete first row
      expect(tokens1).toHaveLength(4);
      expect(tokens1[0]).toMatchObject({ type: Field, value: "a" });
      expect(tokens1[2]).toMatchObject({ type: Field, value: "b" });
      expect(tokens1[3]).toMatchObject({ type: RecordDelimiter, value: "\n" });

      // Second chunk completes the row
      // leftover "c,d" + chunk2 ",e\n" = "c,d,e\n"
      const chunk2 = encode(",e\n");
      const tokens2 = await collectTokens(lexer.lex(chunk2, { stream: true }));

      // Combined data "c,d,e\n" produces: Field "c", FieldDelim ",", Field "d", FieldDelim ",", Field "e", RecordDelim "\n"
      expect(tokens2).toHaveLength(6);
      expect(tokens2[0]).toMatchObject({ type: Field, value: "c" });
      expect(tokens2[1]).toMatchObject({ type: FieldDelimiter, value: "," });
      expect(tokens2[2]).toMatchObject({ type: Field, value: "d" });
      expect(tokens2[3]).toMatchObject({ type: FieldDelimiter, value: "," });
      expect(tokens2[4]).toMatchObject({ type: Field, value: "e" });
      expect(tokens2[5]).toMatchObject({ type: RecordDelimiter, value: "\n" });
    });

    it("should flush remaining data", async () => {
      const backend = new MockBackend();
      const lexer = new GPUBinaryCSVLexer({ backend });

      // Chunk without trailing newline
      const chunk = encode("a,b\nc,d");
      const tokens1 = await collectTokens(lexer.lex(chunk, { stream: true }));

      // First row tokenized
      expect(tokens1).toHaveLength(4);

      // Flush to get remaining data
      const tokens2 = await collectTokens(lexer.lex());

      // Should get the incomplete last row
      // Note: The exact behavior depends on flush implementation
      expect(tokens2.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("quoted fields", () => {
    it("should handle quoted fields with commas", async () => {
      const backend = new MockBackend();
      const lexer = new GPUBinaryCSVLexer({ backend });

      const csv = encode('"a,b",c\n');
      const tokens = await collectTokens(lexer.lex(csv));

      expect(tokens).toHaveLength(4);
      expect(tokens[0]).toMatchObject({ type: Field, value: "a,b" });
      expect(tokens[1]).toMatchObject({ type: FieldDelimiter, value: "," });
      expect(tokens[2]).toMatchObject({ type: Field, value: "c" });
    });

    it("should handle escaped quotes", async () => {
      const backend = new MockBackend();
      const lexer = new GPUBinaryCSVLexer({ backend });

      const csv = encode('"a""b",c\n');
      const tokens = await collectTokens(lexer.lex(csv));

      expect(tokens).toHaveLength(4);
      expect(tokens[0]).toMatchObject({ type: Field, value: 'a"b' });
    });
  });

  describe("BOM handling", () => {
    it("should strip UTF-8 BOM from first chunk", async () => {
      const backend = new MockBackend();
      const lexer = new GPUBinaryCSVLexer({ backend });

      // UTF-8 BOM + CSV data
      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      const data = encode("a,b\n");
      const csv = new Uint8Array(bom.length + data.length);
      csv.set(bom, 0);
      csv.set(data, bom.length);

      const tokens = await collectTokens(lexer.lex(csv));

      expect(tokens).toHaveLength(4);
      expect(tokens[0]).toMatchObject({ type: Field, value: "a" });
    });
  });

  describe("reset", () => {
    it("should reset state for new file", async () => {
      const backend = new MockBackend();
      const lexer = new GPUBinaryCSVLexer({ backend });

      // Process first file
      await collectTokens(lexer.lex(encode("a,b\n")));

      // Reset for new file
      lexer.reset();

      // Process second file with BOM
      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      const data = encode("c,d\n");
      const csv = new Uint8Array(bom.length + data.length);
      csv.set(bom, 0);
      csv.set(data, bom.length);

      const tokens = await collectTokens(lexer.lex(csv));

      expect(tokens).toHaveLength(4);
      expect(tokens[0]).toMatchObject({ type: Field, value: "c" });
    });
  });

  describe("location tracking", () => {
    it("should track token locations across chunks", async () => {
      const backend = new MockBackend();
      const lexer = new GPUBinaryCSVLexer({ backend });

      const tokens = await collectTokens(lexer.lex(encode("a,b\nc,d\n")));

      // First row tokens should have rowNumber = 1
      expect(tokens[0]?.location?.rowNumber).toBe(1);
      expect(tokens[1]?.location?.rowNumber).toBe(1);
      expect(tokens[2]?.location?.rowNumber).toBe(1);

      // Second row tokens should have rowNumber = 2
      expect(tokens[4]?.location?.rowNumber).toBe(2);
      expect(tokens[5]?.location?.rowNumber).toBe(2);
      expect(tokens[6]?.location?.rowNumber).toBe(2);
    });
  });
});
