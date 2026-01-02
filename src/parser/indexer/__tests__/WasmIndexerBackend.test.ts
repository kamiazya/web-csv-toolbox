import { beforeAll, describe, expect, it } from "vitest";
import {
  isSyncInitialized,
  loadWasmSync,
  scanCsvBytesStreaming,
} from "@/wasm/WasmInstance.main.web.ts";
import { CSVSeparatorIndexer } from "../CSVSeparatorIndexer.ts";
import { WasmIndexerBackend } from "../WasmIndexerBackend.ts";

loadWasmSync();
describe.skipIf(!isSyncInitialized())("WasmIndexerBackend", () => {
  describe("initialize", () => {
    it("should initialize successfully", async () => {
      const backend = new WasmIndexerBackend();
      await backend.initialize();
      expect(backend.isInitialized).toBe(true);
    });

    it("should not re-initialize if already initialized", async () => {
      const backend = new WasmIndexerBackend();
      await backend.initialize();
      await backend.initialize(); // Should not throw
      expect(backend.isInitialized).toBe(true);
    });
  });

  describe("scan", () => {
    it("should scan simple CSV", async () => {
      const backend = new WasmIndexerBackend();
      await backend.initialize();

      const csv = new TextEncoder().encode("a,b,c\n1,2,3\n");
      const result = backend.scan(csv, false);

      expect(result.sepCount).toBe(6); // 2 commas + LF + 2 commas + LF
      expect(result.processedBytes).toBe(12);
      expect(result.endInQuote).toBe(false);
    });

    it("should handle quoted fields", async () => {
      const backend = new WasmIndexerBackend();
      await backend.initialize();

      const csv = new TextEncoder().encode('"a,b",c\n1,2\n');
      const result = backend.scan(csv, false);

      // The comma inside quotes should be ignored
      expect(result.sepCount).toBe(4); // comma + LF + comma + LF
      expect(result.endInQuote).toBe(false);
    });

    it("should track quote state across chunks", async () => {
      const backend = new WasmIndexerBackend();
      await backend.initialize();

      // First chunk ends inside a quote
      const chunk1 = new TextEncoder().encode('a,"b,');
      const result1 = backend.scan(chunk1, false);
      expect(result1.endInQuote).toBe(true);

      // Continue with prevInQuote=true
      const chunk2 = new TextEncoder().encode('c",d\n');
      const result2 = backend.scan(chunk2, true);
      expect(result2.endInQuote).toBe(false);
    });

    it("should throw if not initialized", () => {
      const backend = new WasmIndexerBackend();
      const csv = new TextEncoder().encode("a,b,c\n");

      expect(() => backend.scan(csv, false)).toThrow(
        "WasmIndexerBackend is not initialized",
      );
    });
  });

  describe("getMaxChunkSize", () => {
    it("should return default chunk size", () => {
      const backend = new WasmIndexerBackend();
      expect(backend.getMaxChunkSize()).toBe(1024 * 1024); // 1MB
    });

    it("should return custom chunk size", () => {
      const backend = new WasmIndexerBackend(44, 2 * 1024 * 1024);
      expect(backend.getMaxChunkSize()).toBe(2 * 1024 * 1024); // 2MB
    });
  });

  describe("initializeWithModule", () => {
    it("should initialize with pre-loaded module", async () => {
      const backend = new WasmIndexerBackend();

      // Get the Wasm module
      const wasm = await import("@/wasm/WasmInstance.main.web.ts");

      backend.initializeWithModule({
        scanCsvBytesStreaming: wasm.scanCsvBytesStreaming as any,
        scanCsvBytesZeroCopy: wasm.scanCsvBytesZeroCopy as any,
        isInitialized: wasm.isInitialized,
        loadWasmSync: wasm.loadWasmSync,
      });

      expect(backend.isInitialized).toBe(true);

      // Should work
      const csv = new TextEncoder().encode("a,b,c\n");
      const result = backend.scan(csv, false);
      expect(result.sepCount).toBe(3);
    });
  });
});

describe.skipIf(!isSyncInitialized())("CSVSeparatorIndexer", () => {
  let backend: WasmIndexerBackend;

  beforeAll(async () => {
    loadWasmSync();
    backend = new WasmIndexerBackend();
    await backend.initialize();
  });

  describe("non-streaming mode", () => {
    it("should process entire CSV at once", () => {
      const indexer = new CSVSeparatorIndexer(backend);
      const csv = new TextEncoder().encode("a,b,c\n1,2,3\n");

      const result = indexer.index(csv);

      expect(result.sepCount).toBe(6);
      expect(result.processedBytes).toBe(12);
      expect(result.endInQuote).toBe(false);
    });
  });

  describe("streaming mode", () => {
    it("should process chunks and maintain leftover", () => {
      const indexer = new CSVSeparatorIndexer(backend);

      // Chunk 1: complete row + partial row
      const chunk1 = new TextEncoder().encode("a,b,c\n1,2");
      const result1 = indexer.index(chunk1, { stream: true });

      expect(result1.sepCount).toBe(3); // 2 commas + LF (only complete row)
      expect(result1.processedBytes).toBe(6); // "a,b,c\n"
      expect(indexer.hasLeftover()).toBe(true);
      expect(indexer.getLeftover().length).toBe(3); // "1,2"

      // Chunk 2: complete the partial row
      const chunk2 = new TextEncoder().encode(",3\n");
      const result2 = indexer.index(chunk2, { stream: true });

      expect(result2.sepCount).toBe(3); // leftover "1,2" + new ",3\n" = 2 commas + LF
      expect(result2.processedBytes).toBe(6); // "1,2,3\n"
      expect(indexer.hasLeftover()).toBe(false);
    });

    it("should handle flush for remaining data", () => {
      const indexer = new CSVSeparatorIndexer(backend);

      // Chunk without trailing LF
      const chunk = new TextEncoder().encode("a,b,c\n1,2,3");
      indexer.index(chunk, { stream: true });

      // Flush remaining data
      const result = indexer.index();

      expect(result.sepCount).toBe(2); // 2 commas (no LF)
      expect(result.processedBytes).toBe(5); // "1,2,3"
    });

    it("should handle quoted fields spanning chunks", () => {
      const indexer = new CSVSeparatorIndexer(backend);

      // Chunk 1: starts a quoted field
      const chunk1 = new TextEncoder().encode('a,"b,');
      const result1 = indexer.index(chunk1, { stream: true });

      // No complete rows yet
      expect(result1.sepCount).toBe(0);
      expect(result1.processedBytes).toBe(0);

      // Chunk 2: completes the quoted field
      const chunk2 = new TextEncoder().encode('c",d\n');
      const result2 = indexer.index(chunk2, { stream: true });

      // Now we have: a,"b,c",d\n = comma + comma + LF
      expect(result2.sepCount).toBe(3);
      expect(indexer.hasLeftover()).toBe(false);
    });
  });

  describe("reset", () => {
    it("should clear state", () => {
      const indexer = new CSVSeparatorIndexer(backend);

      // Process partial data
      const chunk = new TextEncoder().encode("a,b");
      indexer.index(chunk, { stream: true });

      expect(indexer.hasLeftover()).toBe(true);

      indexer.reset();

      expect(indexer.hasLeftover()).toBe(false);
    });
  });
});

describe.skipIf(!isSyncInitialized())(
  "scanCsvBytesStreaming direct test",
  () => {
    it("should return streaming result object", () => {
      const csv = new TextEncoder().encode("a,b,c\n1,2,3\n");
      const result = scanCsvBytesStreaming(csv, 44, false);

      expect(result).toHaveProperty("separators");
      expect(result).toHaveProperty("sepCount");
      expect(result).toHaveProperty("processedBytes");
      expect(result).toHaveProperty("endInQuote");

      expect(result.sepCount).toBe(6);
      expect(result.processedBytes).toBe(12);
      expect(result.endInQuote).toBe(false);
    });

    it("should track quote state with prevInQuote", () => {
      // First chunk ends in quote
      const chunk1 = new TextEncoder().encode('a,"b,');
      const result1 = scanCsvBytesStreaming(chunk1, 44, false);
      expect(result1.endInQuote).toBe(true);

      // Continue with prevInQuote=true
      const chunk2 = new TextEncoder().encode('c",d\n');
      const result2 = scanCsvBytesStreaming(chunk2, 44, true);
      expect(result2.endInQuote).toBe(false);
      expect(result2.sepCount).toBe(2); // comma + LF
    });
  },
);
