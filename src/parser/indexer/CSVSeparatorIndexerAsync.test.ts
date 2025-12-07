/**
 * Unit tests for CSVSeparatorIndexerAsync
 *
 * Tests the async stateful streaming wrapper using a mock backend to verify
 * state management (leftover bytes, quote state) without GPU dependencies.
 */

import { describe, expect, it, vi } from "vitest";
import type { CSVSeparatorIndexResult } from "../types/SeparatorIndexResult.ts";
import {
  CSVSeparatorIndexerAsync,
  type CSVIndexerBackendAsync,
} from "./CSVSeparatorIndexerAsync.ts";

const encoder = new TextEncoder();

// Separator type constants (matching GPU implementation)
const SEP_TYPE_COMMA = 0;
const SEP_TYPE_LF = 1;

/**
 * Pack separator offset and type into u32
 */
function packSeparator(offset: number, type: number): number {
  return offset | (type << 31);
}

/**
 * Create a mock async backend for testing
 */
function createMockBackend(
  scanImpl?: (
    chunk: Uint8Array,
    prevInQuote: boolean,
  ) => Promise<CSVSeparatorIndexResult>,
): CSVIndexerBackendAsync {
  return {
    isInitialized: true,
    initialize: vi.fn().mockResolvedValue(undefined),
    getMaxChunkSize: () => 1024 * 1024,
    scan:
      scanImpl ??
      vi.fn().mockResolvedValue({
        separators: new Uint32Array(0),
        sepCount: 0,
        processedBytes: 0,
        endInQuote: false,
      }),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Simple async CSV parser implementation for testing
 */
async function simpleCSVParser(
  chunk: Uint8Array,
  prevInQuote: boolean,
): Promise<CSVSeparatorIndexResult> {
  const separators: number[] = [];
  let inQuote = prevInQuote;

  for (let i = 0; i < chunk.length; i++) {
    const byte = chunk[i]!;

    if (byte === 0x22) {
      // Double quote
      inQuote = !inQuote;
    } else if (!inQuote) {
      if (byte === 0x2c) {
        // Comma
        separators.push(packSeparator(i, SEP_TYPE_COMMA));
      } else if (byte === 0x0a) {
        // LF
        separators.push(packSeparator(i, SEP_TYPE_LF));
      }
    }
  }

  // Find last LF for processedBytes
  let processedBytes = 0;
  for (let i = separators.length - 1; i >= 0; i--) {
    const sep = separators[i]!;
    if (sep >>> 31 === 1) {
      // It's a LF
      processedBytes = (sep & 0x7fffffff) + 1;
      break;
    }
  }

  return {
    separators: new Uint32Array(separators),
    sepCount: separators.length,
    processedBytes,
    endInQuote: inQuote,
  };
}

describe("CSVSeparatorIndexerAsync", () => {
  describe("constructor", () => {
    it("should create an async indexer with a backend", () => {
      const backend = createMockBackend();
      const indexer = new CSVSeparatorIndexerAsync(backend);
      expect(indexer).toBeInstanceOf(CSVSeparatorIndexerAsync);
    });
  });

  describe("index() - basic", () => {
    it("should call backend.scan() with chunk and prevInQuote", async () => {
      const scanSpy = vi.fn().mockResolvedValue({
        separators: new Uint32Array([packSeparator(3, SEP_TYPE_COMMA)]),
        sepCount: 1,
        processedBytes: 4,
        endInQuote: false,
      });
      const backend = createMockBackend(scanSpy);
      const indexer = new CSVSeparatorIndexerAsync(backend);

      const chunk = encoder.encode("a,b\n");
      await indexer.index(chunk);

      expect(scanSpy).toHaveBeenCalledWith(chunk, false);
    });

    it("should return result from backend", async () => {
      const expectedResult = {
        separators: new Uint32Array([
          packSeparator(1, SEP_TYPE_COMMA),
          packSeparator(3, SEP_TYPE_LF),
        ]),
        sepCount: 2,
        processedBytes: 4,
        endInQuote: false,
      };

      const backend = createMockBackend(async () => expectedResult);
      const indexer = new CSVSeparatorIndexerAsync(backend);

      const result = await indexer.index(encoder.encode("a,b\n"));

      expect(result.separators).toEqual(expectedResult.separators);
      expect(result.sepCount).toBe(expectedResult.sepCount);
      expect(result.processedBytes).toBe(expectedResult.processedBytes);
      expect(result.endInQuote).toBe(expectedResult.endInQuote);
    });
  });

  describe("index() - streaming mode", () => {
    it("should handle leftover bytes in streaming mode", async () => {
      const backend = createMockBackend(simpleCSVParser);
      const indexer = new CSVSeparatorIndexerAsync(backend);

      // First chunk: "a,b\nc,d" (no trailing LF)
      const chunk1 = encoder.encode("a,b\nc,d");
      const result1 = await indexer.index(chunk1, { stream: true });

      // Should process only up to last LF
      expect(result1.processedBytes).toBe(4); // "a,b\n"
      expect(indexer.hasLeftover()).toBe(true);
      expect(indexer.getLeftover()).toEqual(encoder.encode("c,d"));

      // Second chunk: ",e\n"
      const chunk2 = encoder.encode(",e\n");
      const result2 = await indexer.index(chunk2, { stream: true });

      // Should combine leftover "c,d" with new chunk ",e\n" → "c,d,e\n"
      expect(result2.processedBytes).toBe(6); // "c,d,e\n"
      expect(indexer.hasLeftover()).toBe(false);
    });

    it("should reset quote state after LF in streaming mode", async () => {
      const backend = createMockBackend(simpleCSVParser);
      const indexer = new CSVSeparatorIndexerAsync(backend);

      // Chunk with quoted field ending at LF
      const chunk = encoder.encode('"a,b"\n');
      const result = await indexer.index(chunk, { stream: true });

      // endInQuote should be false after LF
      expect(result.endInQuote).toBe(false);
    });

    it("should filter separators beyond processedBytes in streaming mode", async () => {
      const backend = createMockBackend(simpleCSVParser);
      const indexer = new CSVSeparatorIndexerAsync(backend);

      // "a,b\nc,d" - has separators after last LF
      const chunk = encoder.encode("a,b\nc,d");
      const result = await indexer.index(chunk, { stream: true });

      // Should only count separators up to last LF
      // Separators: [1 (comma), 3 (LF), 5 (comma)]
      // Valid count: 2 (only up to LF at position 3)
      expect(result.sepCount).toBe(2);
    });
  });

  describe("index() - non-streaming mode", () => {
    it("should process all bytes in non-streaming mode", async () => {
      const backend = createMockBackend(simpleCSVParser);
      const indexer = new CSVSeparatorIndexerAsync(backend);

      // "a,b,c" (no trailing LF)
      const chunk = encoder.encode("a,b,c");
      const result = await indexer.index(chunk, { stream: false });

      // Should process all bytes
      expect(result.sepCount).toBe(2); // Two commas
      expect(indexer.hasLeftover()).toBe(false);
    });

    it("should carry quote state to next call", async () => {
      const scanSpy = vi.fn().mockImplementation(simpleCSVParser);
      const backend = createMockBackend(scanSpy);
      const indexer = new CSVSeparatorIndexerAsync(backend);

      // First chunk: starts quote but doesn't close it
      await indexer.index(encoder.encode('"a,b'));
      // Second chunk: closes quote
      await indexer.index(encoder.encode(',c"\n'));

      // Second call should receive prevInQuote=true
      expect(scanSpy).toHaveBeenNthCalledWith(2, encoder.encode(',c"\n'), true);
    });
  });

  describe("flush()", () => {
    it("should process remaining leftover bytes", async () => {
      const backend = createMockBackend(simpleCSVParser);
      const indexer = new CSVSeparatorIndexerAsync(backend);

      // Add leftover bytes
      await indexer.index(encoder.encode("a,b\nc,d"), { stream: true });
      expect(indexer.hasLeftover()).toBe(true);

      // Flush should process "c,d"
      const result = await indexer.index(); // No chunk = flush
      expect(result.processedBytes).toBe(3); // "c,d"
      expect(result.sepCount).toBe(1); // One comma
      expect(indexer.hasLeftover()).toBe(false);
    });

    it("should return empty result if no leftover", async () => {
      const backend = createMockBackend();
      const indexer = new CSVSeparatorIndexerAsync(backend);

      const result = await indexer.index(); // Flush with no leftover
      expect(result.sepCount).toBe(0);
      expect(result.processedBytes).toBe(0);
    });
  });

  describe("reset()", () => {
    it("should clear leftover and quote state", async () => {
      const backend = createMockBackend(simpleCSVParser);
      const indexer = new CSVSeparatorIndexerAsync(backend);

      // Create state
      await indexer.index(encoder.encode('"a,b'), { stream: false });
      await indexer.index(encoder.encode("c,d\ne,f"), { stream: true });

      expect(indexer.hasLeftover()).toBe(true);

      // Reset
      indexer.reset();

      expect(indexer.hasLeftover()).toBe(false);
      expect(indexer.getLeftover()).toEqual(new Uint8Array(0));
    });
  });

  describe("getLeftover() and hasLeftover()", () => {
    it("should return leftover bytes", async () => {
      const backend = createMockBackend(simpleCSVParser);
      const indexer = new CSVSeparatorIndexerAsync(backend);

      await indexer.index(encoder.encode("a,b\nc,d"), { stream: true });

      expect(indexer.hasLeftover()).toBe(true);
      expect(indexer.getLeftover()).toEqual(encoder.encode("c,d"));
    });

    it("should return empty array when no leftover", () => {
      const backend = createMockBackend();
      const indexer = new CSVSeparatorIndexerAsync(backend);

      expect(indexer.hasLeftover()).toBe(false);
      expect(indexer.getLeftover()).toEqual(new Uint8Array(0));
    });
  });

  describe("edge cases", () => {
    it("should handle empty chunk", async () => {
      const backend = createMockBackend(simpleCSVParser);
      const indexer = new CSVSeparatorIndexerAsync(backend);

      const result = await indexer.index(new Uint8Array(0));
      expect(result.sepCount).toBe(0);
    });

    it("should handle chunk with only separators", async () => {
      const backend = createMockBackend(simpleCSVParser);
      const indexer = new CSVSeparatorIndexerAsync(backend);

      const result = await indexer.index(encoder.encode(",,,\n"));
      expect(result.sepCount).toBe(4); // 3 commas + 1 LF
    });

    it("should handle quoted commas correctly", async () => {
      const backend = createMockBackend(simpleCSVParser);
      const indexer = new CSVSeparatorIndexerAsync(backend);

      // "a,b,c" should not have separators inside quotes
      const result = await indexer.index(encoder.encode('"a,b,c"\n'));
      expect(result.sepCount).toBe(1); // Only LF, not the quoted commas
    });
  });
});
