import { describe, expect, it } from "vitest";
import { inspectAndReconstructStream } from "./StreamInspector.ts";

describe("inspectAndReconstructStream", () => {
  describe("String streams", () => {
    it("should detect string stream type", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("hello");
          controller.close();
        },
      });

      const result = await inspectAndReconstructStream(stream);

      expect(result).not.toBeNull();
      expect(result!.type).toBe("parseStringStream");
    });

    it("should reconstruct string stream with first chunk", async () => {
      const chunks = ["chunk1", "chunk2", "chunk3"];
      const stream = new ReadableStream<string>({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });

      const result = await inspectAndReconstructStream(stream);

      expect(result).not.toBeNull();

      // Read all chunks from reconstructed stream
      const reader = result!.stream.getReader();
      const readChunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        readChunks.push(value as string);
      }

      expect(readChunks).toEqual(chunks);
    });

    it("should handle single chunk string stream", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("only chunk");
          controller.close();
        },
      });

      const result = await inspectAndReconstructStream(stream);

      expect(result).not.toBeNull();
      expect(result!.type).toBe("parseStringStream");

      const reader = result!.stream.getReader();
      const { value } = await reader.read();
      expect(value).toBe("only chunk");

      const { done } = await reader.read();
      expect(done).toBe(true);
    });
  });

  describe("Binary streams", () => {
    it("should detect binary stream type", async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      });

      const result = await inspectAndReconstructStream(stream);

      expect(result).not.toBeNull();
      expect(result!.type).toBe("parseBinaryStream");
    });

    it("should reconstruct binary stream with first chunk", async () => {
      const chunks = [
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
        new Uint8Array([7, 8, 9]),
      ];
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });

      const result = await inspectAndReconstructStream(stream);

      expect(result).not.toBeNull();
      expect(result!.type).toBe("parseBinaryStream");

      // Read all chunks from reconstructed stream
      const reader = result!.stream.getReader();
      const readChunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        readChunks.push(value as Uint8Array);
      }

      expect(readChunks).toHaveLength(3);
      expect(readChunks[0]).toEqual(new Uint8Array([1, 2, 3]));
      expect(readChunks[1]).toEqual(new Uint8Array([4, 5, 6]));
      expect(readChunks[2]).toEqual(new Uint8Array([7, 8, 9]));
    });

    it("should handle empty Uint8Array chunk", async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([]));
          controller.enqueue(new Uint8Array([1, 2]));
          controller.close();
        },
      });

      const result = await inspectAndReconstructStream(stream);

      expect(result).not.toBeNull();
      expect(result!.type).toBe("parseBinaryStream");
    });
  });

  describe("Empty streams", () => {
    it("should return null for empty stream", async () => {
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.close();
        },
      });

      const result = await inspectAndReconstructStream(stream);

      expect(result).toBeNull();
    });

    it("should return null for empty binary stream", async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      });

      const result = await inspectAndReconstructStream(stream);

      expect(result).toBeNull();
    });
  });

  describe("Error handling", () => {
    it("should throw error for unsupported chunk type", async () => {
      const stream = new ReadableStream<unknown>({
        start(controller) {
          controller.enqueue(12345);
          controller.close();
        },
      });

      await expect(
        inspectAndReconstructStream(stream as ReadableStream<string>),
      ).rejects.toThrow("Unsupported stream chunk type");
    });

    it("should throw error for object chunk type", async () => {
      const stream = new ReadableStream<unknown>({
        start(controller) {
          controller.enqueue({ key: "value" });
          controller.close();
        },
      });

      await expect(
        inspectAndReconstructStream(stream as ReadableStream<string>),
      ).rejects.toThrow("Unsupported stream chunk type");
    });
  });

  describe("Stream cancellation", () => {
    it("should properly release reader on cancel", async () => {
      let cancelled = false;
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("chunk1");
          controller.enqueue("chunk2");
        },
        cancel() {
          cancelled = true;
        },
      });

      const result = await inspectAndReconstructStream(stream);
      expect(result).not.toBeNull();

      // Cancel the reconstructed stream
      await result!.stream.cancel("test cancel");

      // Give it time to propagate
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(cancelled).toBe(true);
    });
  });

  describe("Pull behavior", () => {
    it("should pull remaining chunks on demand", async () => {
      let pullCount = 0;
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("first");
        },
        pull(controller) {
          pullCount++;
          if (pullCount === 1) {
            controller.enqueue("second");
          } else if (pullCount === 2) {
            controller.enqueue("third");
            controller.close();
          }
        },
      });

      const result = await inspectAndReconstructStream(stream);
      expect(result).not.toBeNull();

      const reader = result!.stream.getReader();
      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value as string);
      }

      expect(chunks).toEqual(["first", "second", "third"]);
    });

    it("should propagate errors from original stream", async () => {
      const testError = new Error("Stream error");
      const stream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue("first");
        },
        pull() {
          throw testError;
        },
      });

      const result = await inspectAndReconstructStream(stream);
      expect(result).not.toBeNull();

      const reader = result!.stream.getReader();

      // First chunk should be available
      const { value: first } = await reader.read();
      expect(first).toBe("first");

      // Second read should fail with the error
      await expect(reader.read()).rejects.toThrow("Stream error");
    });
  });
});
