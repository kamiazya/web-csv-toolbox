import { describe, expect, it } from "vitest";
import { parseBinaryStream } from "@/parser/api/binary/parseBinaryStream.ts";
import { parseStringStream } from "@/parser/api/string/parseStringStream.ts";

/**
 * Test AbortSignal support in stream collection loops.
 *
 * These tests verify that when using worker execution with streams in Node.js
 * (which requires collecting the stream before sending to worker), the AbortSignal
 * is properly honored during the collection phase.
 *
 * Note: These tests require Worker API which is not available in standard Node.js test environment.
 * They are skipped in environments where Worker is not defined.
 */
describe("Stream Collection AbortSignal Support", () => {
  describe("parseBinaryStream with AbortSignal", () => {
    it("should abort during stream collection when signal is aborted", async () => {
      // Create a slow stream that yields chunks over time
      const encoder = new TextEncoder();
      let _chunkCount = 0;

      const slowStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          // First chunk
          controller.enqueue(encoder.encode("a,b,c\n"));
          _chunkCount++;

          // Simulate slow stream with delay
          await new Promise((resolve) => setTimeout(resolve, 50));

          // Second chunk (should be aborted before this)
          controller.enqueue(encoder.encode("1,2,3\n"));
          _chunkCount++;

          controller.close();
        },
      });

      const controller = new AbortController();

      // Abort after 20ms (before second chunk)
      setTimeout(() => {
        controller.abort();
      }, 20);

      // Should throw AbortError
      await expect(async () => {
        const records = [];
        for await (const record of parseBinaryStream(slowStream, {
          engine: { worker: true },
          signal: controller.signal,
        })) {
          records.push(record);
        }
      }).rejects.toThrow(/abort/i);
    });

    it("should throw immediately if signal is already aborted", async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode("a,b,c\n1,2,3\n"));
          controller.close();
        },
      });

      const controller = new AbortController();
      controller.abort(); // Abort before parsing

      await expect(async () => {
        const records = [];
        for await (const record of parseBinaryStream(stream, {
          engine: { worker: true },
          signal: controller.signal,
        })) {
          records.push(record);
        }
      }).rejects.toThrow(/abort/i);
    });

    it("should complete successfully if not aborted", async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode("a,b,c\n"));
          controller.enqueue(encoder.encode("1,2,3\n"));
          controller.close();
        },
      });

      const controller = new AbortController();

      const records = [];
      for await (const record of parseBinaryStream(stream, {
        engine: { worker: true },
        signal: controller.signal,
      })) {
        records.push(record);
      }

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ a: "1", b: "2", c: "3" });
    });
  });

  describe("parseStringStream with AbortSignal", () => {
    it("should abort during stream collection when signal is aborted", async () => {
      let _chunkCount = 0;

      const slowStream = new ReadableStream<string>({
        async start(controller) {
          // First chunk
          controller.enqueue("a,b,c\n");
          _chunkCount++;

          // Simulate slow stream with delay
          await new Promise((resolve) => setTimeout(resolve, 50));

          // Second chunk (should be aborted before this)
          controller.enqueue("1,2,3\n");
          _chunkCount++;

          controller.close();
        },
      });

      const controller = new AbortController();

      // Abort after 20ms (before second chunk)
      setTimeout(() => {
        controller.abort();
      }, 20);

      // Should throw AbortError
      await expect(async () => {
        const records = [];
        for await (const record of parseStringStream(slowStream, {
          engine: { worker: true },
          signal: controller.signal,
        })) {
          records.push(record);
        }
      }).rejects.toThrow(/abort/i);
    });

    it("should throw immediately if signal is already aborted", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("a,b,c\n1,2,3\n");
          controller.close();
        },
      });

      const controller = new AbortController();
      controller.abort(); // Abort before parsing

      await expect(async () => {
        const records = [];
        for await (const record of parseStringStream(stream, {
          engine: { worker: true },
          signal: controller.signal,
        })) {
          records.push(record);
        }
      }).rejects.toThrow(/abort/i);
    });

    it("should complete successfully if not aborted", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("a,b,c\n");
          controller.enqueue("1,2,3\n");
          controller.close();
        },
      });

      const controller = new AbortController();

      const records = [];
      for await (const record of parseStringStream(stream, {
        engine: { worker: true },
        signal: controller.signal,
      })) {
        records.push(record);
      }

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ a: "1", b: "2", c: "3" });
    });
  });

  describe("Stream cancellation cleanup", () => {
    it("should properly release reader lock after abort", async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode("a,b,c\n"));
          controller.close();
        },
      });

      const controller = new AbortController();
      controller.abort();

      try {
        const records = [];
        for await (const record of parseBinaryStream(stream, {
          engine: { worker: true },
          signal: controller.signal,
        })) {
          records.push(record);
        }
      } catch (error) {
        // Expected to throw
        expect(error).toBeDefined();
      }

      // Verify stream is properly closed/released
      // If reader wasn't released, getting a new reader would throw
      const reader = stream.getReader();
      expect(reader).toBeDefined();
      reader.releaseLock();
    });
  });
});
