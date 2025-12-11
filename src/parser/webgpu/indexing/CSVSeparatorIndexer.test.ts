/**
 * Unit tests for CSVSeparatorIndexer
 *
 * Tests the stateful streaming wrapper using a mock backend to verify
 * state management (leftover bytes, quote state) without GPU dependencies.
 */

import { describe, expect, it, vi } from "vitest";
import { packSeparator } from "@/parser/webgpu/utils/separator-utils.ts";
import {
  CSVSeparatorIndexer,
  type CSVSeparatorIndexingBackendInterface,
} from "./CSVSeparatorIndexer.ts";
import type { CSVSeparatorIndexResult } from "./types.ts";
import { SEP_TYPE_COMMA, SEP_TYPE_LF } from "./types.ts";

const encoder = new TextEncoder();

/**
 * Create a mock backend for testing
 */
function createMockBackend(
  runImpl?: (
    chunk: Uint8Array,
    prevInQuote: boolean,
  ) => Promise<CSVSeparatorIndexResult>,
): CSVSeparatorIndexingBackendInterface {
  return {
    isInitialized: true,
    getMaxChunkSize: () => 1024 * 1024,
    run:
      runImpl ??
      vi.fn().mockResolvedValue({
        separators: new Uint32Array(0),
        sepCount: 0,
        processedBytes: 0,
        endInQuote: false,
      }),
  };
}

/**
 * Simple implementation that finds separators in CSV data
 */
function simpleCSVParser(
  chunk: Uint8Array,
  prevInQuote: boolean,
): CSVSeparatorIndexResult {
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

describe("CSVSeparatorIndexer", () => {
  describe("constructor", () => {
    it("should create an indexer with a backend", () => {
      const backend = createMockBackend();
      const indexer = new CSVSeparatorIndexer({ backend });
      expect(indexer).toBeInstanceOf(CSVSeparatorIndexer);
    });
  });

  describe("index() - basic", () => {
    it("should throw if backend is not initialized", async () => {
      const backend = createMockBackend();
      (backend as { isInitialized: boolean }).isInitialized = false;

      const indexer = new CSVSeparatorIndexer({ backend });
      await expect(indexer.index(encoder.encode("a,b\n"))).rejects.toThrow(
        "Backend is not initialized",
      );
    });

    it("should process a simple CSV chunk", async () => {
      const backend = createMockBackend(async (chunk, prevInQuote) =>
        simpleCSVParser(chunk, prevInQuote),
      );

      const indexer = new CSVSeparatorIndexer({ backend });
      const result = await indexer.index(encoder.encode("a,b\nc,d\n"));

      expect(result.sepCount).toBe(4); // 2 commas + 2 LFs
      expect(result.processedBytes).toBe(8); // All bytes processed
    });
  });

  describe("index() - streaming mode", () => {
    it("should maintain state between chunks", async () => {
      const backend = createMockBackend(async (chunk, prevInQuote) =>
        simpleCSVParser(chunk, prevInQuote),
      );

      const indexer = new CSVSeparatorIndexer({ backend });

      // First chunk: "a,b\nc" - incomplete record at the end
      const result1 = await indexer.index(encoder.encode("a,b\nc"), {
        stream: true,
      });

      expect(result1.sepCount).toBe(2); // 1 comma + 1 LF
      expect(result1.processedBytes).toBe(4); // "a,b\n" processed

      // Second chunk: ",d\n" - completes the record
      const result2 = await indexer.index(encoder.encode(",d\n"), {
        stream: true,
      });

      // "c" leftover + ",d\n" = "c,d\n"
      expect(result2.sepCount).toBe(2); // 1 comma + 1 LF
      expect(result2.processedBytes).toBe(4); // All of "c,d\n" processed
    });

    it("should handle quoted fields across chunks", async () => {
      const backend = createMockBackend(async (chunk, prevInQuote) =>
        simpleCSVParser(chunk, prevInQuote),
      );

      const indexer = new CSVSeparatorIndexer({ backend });

      // First chunk: quote opened but not closed
      const result1 = await indexer.index(encoder.encode('a,"b,'), {
        stream: true,
      });

      // No LF, so processedBytes = 0, all data saved as leftover
      expect(result1.processedBytes).toBe(0);

      // Second chunk: closes the quote and completes record
      const result2 = await indexer.index(encoder.encode('c"\n'), {
        stream: true,
      });

      // Combined: 'a,"b,c"\n'
      expect(result2.sepCount).toBe(2); // comma before quote + LF
      expect(result2.processedBytes).toBe(8); // "a,\"b,c\"\n" = 8 bytes
    });

    it("should keep leftover bytes across multiple streaming calls", async () => {
      const backend = createMockBackend(async (chunk, prevInQuote) =>
        simpleCSVParser(chunk, prevInQuote),
      );

      const indexer = new CSVSeparatorIndexer({ backend });

      // Series of chunks without LF
      await indexer.index(encoder.encode("a"), { stream: true });
      await indexer.index(encoder.encode(","), { stream: true });
      await indexer.index(encoder.encode("b"), { stream: true });

      // Finally complete the record
      const result = await indexer.index(encoder.encode("\n"), {
        stream: true,
      });

      expect(result.sepCount).toBe(2); // 1 comma + 1 LF
      expect(result.processedBytes).toBe(4); // "a,b\n"
    });
  });

  describe("index() - flush mode", () => {
    it("should flush remaining data when called without chunk", async () => {
      const backend = createMockBackend(async (chunk, prevInQuote) =>
        simpleCSVParser(chunk, prevInQuote),
      );

      const indexer = new CSVSeparatorIndexer({ backend });

      // Add incomplete data
      await indexer.index(encoder.encode("a,b\nc,d"), { stream: true });

      // Flush without completing the last record
      const result = await indexer.index();

      // "c,d" should be flushed (1 comma, no LF)
      expect(result.sepCount).toBe(1); // 1 comma
      expect(result.processedBytes).toBe(3); // "c,d" = 3 bytes
    });

    it("should return empty result if no leftover on flush", async () => {
      const backend = createMockBackend(async (chunk, prevInQuote) =>
        simpleCSVParser(chunk, prevInQuote),
      );

      const indexer = new CSVSeparatorIndexer({ backend });

      // Process complete data
      await indexer.index(encoder.encode("a,b\n"), { stream: true });

      // Flush with no leftover
      const result = await indexer.index();

      expect(result.sepCount).toBe(0);
      expect(result.processedBytes).toBe(0);
    });
  });

  describe("reset()", () => {
    it("should clear state", async () => {
      const backend = createMockBackend(async (chunk, prevInQuote) =>
        simpleCSVParser(chunk, prevInQuote),
      );

      const indexer = new CSVSeparatorIndexer({ backend });

      // Add some incomplete data
      await indexer.index(encoder.encode("a,b"), { stream: true });

      // Reset
      indexer.reset();

      // Start fresh - data from before reset should be gone
      const result = await indexer.index(encoder.encode("c\n"), {
        stream: true,
      });

      // Only "c\n" should be processed, not "a,bc\n"
      expect(result.sepCount).toBe(1); // Just 1 LF
      expect(result.processedBytes).toBe(2); // "c\n" = 2 bytes
    });
  });

  describe("large chunk handling", () => {
    it("should split chunks larger than maxChunkSize", async () => {
      const runCalls: Array<{ chunkSize: number; prevInQuote: boolean }> = [];

      const backend: CSVSeparatorIndexingBackendInterface = {
        isInitialized: true,
        getMaxChunkSize: () => 100, // Small max size for testing
        run: async (chunk, prevInQuote) => {
          runCalls.push({ chunkSize: chunk.length, prevInQuote });
          return simpleCSVParser(chunk, prevInQuote);
        },
      };

      const indexer = new CSVSeparatorIndexer({ backend });

      // Create data larger than maxChunkSize
      const largeData = "a,b\n".repeat(40); // 160 bytes
      const result = await indexer.index(encoder.encode(largeData), {
        stream: true,
      });

      // Should have been split into multiple calls
      expect(runCalls.length).toBe(2);
      expect(runCalls[0]!.chunkSize).toBe(100);
      expect(runCalls[1]!.chunkSize).toBe(60);

      // Should still produce correct results
      expect(result.sepCount).toBe(80); // 40 commas + 40 LFs
      expect(result.processedBytes).toBe(160);
    });

    it("should propagate quote state across split chunks", async () => {
      const runCalls: Array<{ prevInQuote: boolean }> = [];

      const backend: CSVSeparatorIndexingBackendInterface = {
        isInitialized: true,
        getMaxChunkSize: () => 10,
        run: async (chunk, prevInQuote) => {
          runCalls.push({ prevInQuote });
          return simpleCSVParser(chunk, prevInQuote);
        },
      };

      const indexer = new CSVSeparatorIndexer({ backend });

      // Data with quote spanning chunks: "hello,\"wo | rld\"\n"
      const data = 'hello,"world"\n';
      await indexer.index(encoder.encode(data), { stream: true });

      // First chunk ends inside quote, second should start with prevInQuote=true
      expect(runCalls[0]!.prevInQuote).toBe(false);
      expect(runCalls[1]!.prevInQuote).toBe(true);
    });
  });
});
