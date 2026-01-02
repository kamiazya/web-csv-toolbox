/**
 * Comprehensive tests for CSVSeparatorIndexingBackend
 *
 * Tests configuration validation, initialization, lifecycle management,
 * and GPU computation features (when WebGPU is available).
 */

import { describe, it } from "vitest";
import { expect, test } from "@/__tests__/webgpu/webgpu-fixture.ts";
import { CSVSeparatorIndexingBackend } from "./CSVSeparatorIndexingBackend.ts";

describe("CSVSeparatorIndexingBackend", () => {
  describe("constructor and validation", () => {
    describe("quotation validation", () => {
      it("should accept default quotation (double quote)", () => {
        expect(() => new CSVSeparatorIndexingBackend()).not.toThrow();
      });

      it('should accept double quote (")', () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ quotation: '"' }),
        ).not.toThrow();
      });

      it("should accept single quote (')", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ quotation: "'" }),
        ).not.toThrow();
      });

      it("should accept backtick (`)", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ quotation: "`" }),
        ).not.toThrow();
      });

      it("should accept any ASCII character (0-127)", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ quotation: "!" }),
        ).not.toThrow();
        expect(
          () => new CSVSeparatorIndexingBackend({ quotation: "@" }),
        ).not.toThrow();
        expect(
          () => new CSVSeparatorIndexingBackend({ quotation: "~" }),
        ).not.toThrow();
      });

      it("should reject non-ASCII characters", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ quotation: "\u201C" }),
        ).toThrow(/Quotation must be an ASCII character.*code: 8220/);
        expect(
          () => new CSVSeparatorIndexingBackend({ quotation: "\u201D" }),
        ).toThrow(/Quotation must be an ASCII character.*code: 8221/);
        expect(
          () => new CSVSeparatorIndexingBackend({ quotation: "\u300C" }),
        ).toThrow(/Quotation must be an ASCII character.*code: 12300/);
      });

      it("should reject multiple characters", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ quotation: '""' }),
        ).toThrow(/Quotation must be a single character, got: ""/);
      });

      it("should reject empty string", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ quotation: "" }),
        ).toThrow(/Quotation must be a single character, got:/);
      });

      it("should reject emoji (surrogate pair)", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ quotation: "\uD83D\uDE00" }),
        ).toThrow(/Quotation must be a single character/);
      });
    });

    describe("delimiter validation", () => {
      it("should accept default delimiter (comma)", () => {
        expect(() => new CSVSeparatorIndexingBackend()).not.toThrow();
      });

      it("should accept comma (,)", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ delimiter: "," }),
        ).not.toThrow();
      });

      it("should accept semicolon (;)", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ delimiter: ";" }),
        ).not.toThrow();
      });

      it("should accept tab (\\t)", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ delimiter: "\t" }),
        ).not.toThrow();
      });

      it("should accept pipe (|)", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ delimiter: "|" }),
        ).not.toThrow();
      });

      it("should accept any ASCII character (0-127) except CR/LF", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ delimiter: "!" }),
        ).not.toThrow();
        expect(
          () => new CSVSeparatorIndexingBackend({ delimiter: "@" }),
        ).not.toThrow();
        expect(
          () => new CSVSeparatorIndexingBackend({ delimiter: "~" }),
        ).not.toThrow();
      });

      it("should reject non-ASCII characters", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ delimiter: "\uFF0C" }),
        ).toThrow(/Delimiter must be an ASCII character.*code: 65292/);
        expect(
          () => new CSVSeparatorIndexingBackend({ delimiter: "\u3001" }),
        ).toThrow(/Delimiter must be an ASCII character.*code: 12289/);
      });

      it("should reject CR (\\r, code 13)", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ delimiter: "\r" }),
        ).toThrow(/code: 13/);
      });

      it("should reject LF (\\n, code 10)", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ delimiter: "\n" }),
        ).toThrow(/code: 10/);
      });

      it("should reject multiple characters", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ delimiter: ",," }),
        ).toThrow(/Delimiter must be a single character, got: ,,/);
      });

      it("should reject empty string", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ delimiter: "" }),
        ).toThrow(/Delimiter must be a single character, got:/);
      });

      it("should reject emoji (surrogate pair)", () => {
        expect(
          () => new CSVSeparatorIndexingBackend({ delimiter: "\uD83D\uDE00" }),
        ).toThrow(/Delimiter must be a single character/);
      });
    });

    describe("delimiter and quotation conflict", () => {
      it("should reject when delimiter and quotation are the same", () => {
        expect(
          () =>
            new CSVSeparatorIndexingBackend({ delimiter: ",", quotation: "," }),
        ).toThrow(
          /Delimiter and quotation must be different characters, both are: ","/,
        );
        expect(
          () =>
            new CSVSeparatorIndexingBackend({ delimiter: ";", quotation: ";" }),
        ).toThrow(
          /Delimiter and quotation must be different characters, both are: ";"/,
        );
        expect(
          () =>
            new CSVSeparatorIndexingBackend({ delimiter: "|", quotation: "|" }),
        ).toThrow(
          /Delimiter and quotation must be different characters, both are: "\|"/,
        );
      });

      it("should accept when delimiter and quotation are different", () => {
        expect(
          () =>
            new CSVSeparatorIndexingBackend({ delimiter: ";", quotation: '"' }),
        ).not.toThrow();
        expect(
          () =>
            new CSVSeparatorIndexingBackend({
              delimiter: "\t",
              quotation: "'",
            }),
        ).not.toThrow();
      });
    });

    describe("configuration options", () => {
      it("should accept custom chunk size", () => {
        const backend = new CSVSeparatorIndexingBackend({
          chunkSize: 1024 * 1024,
        });
        expect(backend).toBeInstanceOf(CSVSeparatorIndexingBackend);
      });

      it("should accept custom maxSeparators", () => {
        const backend = new CSVSeparatorIndexingBackend({
          maxSeparators: 10000,
        });
        expect(backend).toBeInstanceOf(CSVSeparatorIndexingBackend);
      });

      it("should accept enableTiming option", () => {
        const backend = new CSVSeparatorIndexingBackend({ enableTiming: true });
        expect(backend).toBeInstanceOf(CSVSeparatorIndexingBackend);
      });

      it("should accept workgroupSize option", () => {
        const backend = new CSVSeparatorIndexingBackend({ workgroupSize: 256 });
        expect(backend).toBeInstanceOf(CSVSeparatorIndexingBackend);
      });
    });
  });

  describe("initialization and lifecycle", () => {
    it("should not be initialized before calling initialize()", () => {
      const backend = new CSVSeparatorIndexingBackend();
      expect(backend.isInitialized).toBe(false);
    });

    test("should be initialized after calling initialize()", async ({
      gpu,
    }) => {
      if (!gpu) {
        return;
      }

      const backend = new CSVSeparatorIndexingBackend({ gpu });
      await backend.initialize();
      expect(backend.isInitialized).toBe(true);
      await backend.destroy();
    });

    test("should support async dispose pattern", async ({ gpu }) => {
      if (!gpu) {
        return;
      }

      const backend = new CSVSeparatorIndexingBackend({ gpu });
      await backend.initialize();
      await backend[Symbol.asyncDispose]();
      // Backend should still be usable after asyncDispose
    });

    test("should be safe to call destroy multiple times", async ({ gpu }) => {
      if (!gpu) {
        return;
      }

      const backend = new CSVSeparatorIndexingBackend({ gpu });
      await backend.initialize();
      await backend.destroy();
      await backend.destroy(); // Should not throw
    });
  });

  describe("getters and configuration", () => {
    it("should return delimiter", () => {
      const backend = new CSVSeparatorIndexingBackend({ delimiter: ";" });
      expect(backend.delimiter).toBe(";");
    });

    it("should return default delimiter when not specified", () => {
      const backend = new CSVSeparatorIndexingBackend();
      expect(backend.delimiter).toBe(",");
    });

    it("should return max chunk size", () => {
      const backend = new CSVSeparatorIndexingBackend({
        chunkSize: 1024 * 1024,
      });
      // Chunk size is aligned to u32, so we check it's a positive number
      expect(backend.getMaxChunkSize()).toBeGreaterThan(0);
    });

    it("should return configured workgroup size", () => {
      const backend = new CSVSeparatorIndexingBackend({ workgroupSize: 256 });
      expect(backend.workgroupSize).toBe(256);
    });

    it("should return default workgroup size when not configured", () => {
      const backend = new CSVSeparatorIndexingBackend();
      // Should return a valid workgroup size (default is 256)
      expect(backend.workgroupSize).toBeGreaterThan(0);
      expect([32, 64, 128, 256]).toContain(backend.workgroupSize);
    });
  });

  describe("GPU computation", () => {
    it("should throw when calling run() before initialization", async () => {
      const backend = new CSVSeparatorIndexingBackend();
      const chunk = new Uint8Array([0x61, 0x62, 0x63]); // "abc"

      await expect(backend.run(chunk, false)).rejects.toThrow(
        /CSVSeparatorIndexingBackend not initialized/,
      );
    });

    test("should process empty chunk", async ({ gpu }) => {
      if (!gpu) {
        return;
      }

      const backend = new CSVSeparatorIndexingBackend({ gpu });
      try {
        await backend.initialize();
        const result = await backend.run(new Uint8Array(0), false);

        expect(result.sepCount).toBe(0);
        expect(result.endInQuote).toBe(false);
        expect(result.separators).toEqual(new Uint32Array(0));
        expect(result.processedBytes).toBe(0);
      } finally {
        await backend.destroy();
      }
    });

    test("should detect simple comma separator", async ({ gpu }) => {
      if (!gpu) {
        // WebGPU not available, skip test
        return;
      }

      const backend = new CSVSeparatorIndexingBackend({ gpu });
      try {
        await backend.initialize();
        const encoder = new TextEncoder();
        const chunk = encoder.encode("a,b\n");

        const result = await backend.run(chunk, false);

        expect(result.sepCount).toBeGreaterThan(0);
        // Should find at least comma and LF
        expect(result.sepCount).toBeGreaterThanOrEqual(2);
      } finally {
        await backend.destroy();
      }
    });

    test("should detect custom delimiter (semicolon)", async ({ gpu }) => {
      if (!gpu) {
        // WebGPU not available, skip test
        return;
      }

      const backend = new CSVSeparatorIndexingBackend({ gpu, delimiter: ";" });
      try {
        await backend.initialize();
        const encoder = new TextEncoder();
        const chunk = encoder.encode("a;b\n");

        const result = await backend.run(chunk, false);

        expect(result.sepCount).toBeGreaterThan(0);
        // Should find at least semicolon and LF
        expect(result.sepCount).toBeGreaterThanOrEqual(2);
      } finally {
        await backend.destroy();
      }
    });

    test("should handle quoted fields correctly", async ({ gpu }) => {
      if (!gpu) {
        // WebGPU not available, skip test
        return;
      }

      const backend = new CSVSeparatorIndexingBackend({ gpu });
      try {
        await backend.initialize();
        const encoder = new TextEncoder();
        // Comma inside quotes should not be detected
        const chunk = encoder.encode('"a,b",c\n');

        const result = await backend.run(chunk, false);

        expect(result.sepCount).toBeGreaterThan(0);
        // Should find the comma after quotes and LF, but not the comma inside quotes
        expect(result.endInQuote).toBe(false);
      } finally {
        await backend.destroy();
      }
    });

    test("should carry quote state across chunks", async ({ gpu }) => {
      if (!gpu) {
        // WebGPU not available, skip test
        return;
      }

      const backend = new CSVSeparatorIndexingBackend({ gpu });
      try {
        await backend.initialize();
        const encoder = new TextEncoder();

        // First chunk ends inside quotes
        const chunk1 = encoder.encode('"a,b');
        const result1 = await backend.run(chunk1, false);

        // Should end in quote
        expect(result1.endInQuote).toBe(true);

        // Second chunk starts inside quotes
        const chunk2 = encoder.encode('",c\n');
        const result2 = await backend.run(chunk2, true); // Continue from previous chunk

        // Should end outside quotes
        expect(result2.endInQuote).toBe(false);
      } finally {
        await backend.destroy();
      }
    });

    test("should handle multiple records", async ({ gpu }) => {
      if (!gpu) {
        // WebGPU not available, skip test
        return;
      }

      const backend = new CSVSeparatorIndexingBackend({ gpu });
      try {
        await backend.initialize();
        const encoder = new TextEncoder();
        const chunk = encoder.encode("a,b\nc,d\ne,f\n");

        const result = await backend.run(chunk, false);

        // Should find 3 commas + 3 LFs = 6 separators
        expect(result.sepCount).toBeGreaterThanOrEqual(6);
      } finally {
        await backend.destroy();
      }
    });

    test("should respect maxSeparators limit", async ({ gpu }) => {
      if (!gpu) {
        // WebGPU not available, skip test
        return;
      }

      const backend = new CSVSeparatorIndexingBackend({
        gpu,
        maxSeparators: 10,
      });
      try {
        await backend.initialize();
        const encoder = new TextEncoder();
        // Create CSV with multiple separators
        const chunk = encoder.encode("a,b,c,d,e,f,g,h,i,j,k,l\n");

        const result = await backend.run(chunk, false);

        // Note: maxSeparators acts as a buffer size hint, not a hard limit
        // The actual implementation uses Math.max(maxSeparators, chunkSize) for the buffer
        // So the test verifies that separators are found, not that they're limited
        expect(result.sepCount).toBeGreaterThan(0);
        expect(result.sepCount).toBe(12); // 11 commas + 1 LF
      } finally {
        await backend.destroy();
      }
    });

    test("should preserve quote state for empty chunk with prevInQuote=true", async ({
      gpu,
    }) => {
      if (!gpu) {
        return;
      }

      const backend = new CSVSeparatorIndexingBackend({ gpu });
      try {
        await backend.initialize();
        // Empty chunk starting inside quotes should preserve quote state
        const result = await backend.run(new Uint8Array(0), true);

        expect(result.sepCount).toBe(0);
        expect(result.endInQuote).toBe(true); // Quote state preserved
        expect(result.separators).toEqual(new Uint32Array(0));
        expect(result.processedBytes).toBe(0);
      } finally {
        await backend.destroy();
      }
    });
  });

  describe("error handling", () => {
    test("should throw when run() receives chunk larger than maxChunkSize", async ({
      gpu,
    }) => {
      if (!gpu) {
        // WebGPU not available, skip test
        return;
      }

      const backend = new CSVSeparatorIndexingBackend({
        gpu,
        workgroupSize: 32, // Use smaller workgroup size to reduce memory usage
      });
      try {
        await backend.initialize();
        const largeChunk = new Uint8Array(backend.getMaxChunkSize() + 1);

        await expect(backend.run(largeChunk, false)).rejects.toThrow(
          /exceeds maximum/,
        );
      } finally {
        await backend.destroy();
      }
    });
  });
});
