import { describe, expect, it } from "vitest";
import {
  buildTextDecoderOptions,
  buildTextStream,
  decodeBinaryToString,
  toUint8Array,
} from "./binaryDecodingUtils.ts";

describe("buildTextDecoderOptions", () => {
  it("should return empty options when no options provided", () => {
    const result = buildTextDecoderOptions();
    expect(result).toEqual({});
  });

  it("should return empty options for empty options object", () => {
    const result = buildTextDecoderOptions({});
    expect(result).toEqual({});
  });

  it("should pass through fatal option", () => {
    const result = buildTextDecoderOptions({ fatal: true });
    expect(result).toEqual({ fatal: true });
  });

  it("should pass through fatal=false option", () => {
    const result = buildTextDecoderOptions({ fatal: false });
    expect(result).toEqual({ fatal: false });
  });

  it("should pass through ignoreBOM option", () => {
    const result = buildTextDecoderOptions({ ignoreBOM: true });
    expect(result).toEqual({ ignoreBOM: true });
  });

  it("should pass through both fatal and ignoreBOM options", () => {
    const result = buildTextDecoderOptions({ fatal: true, ignoreBOM: true });
    expect(result).toEqual({ fatal: true, ignoreBOM: true });
  });

  it("should ignore charset option (not part of TextDecoderOptions)", () => {
    const result = buildTextDecoderOptions({ charset: "utf-8", fatal: true });
    expect(result).toEqual({ fatal: true });
  });

  it("should ignore decompression option (not part of TextDecoderOptions)", () => {
    const result = buildTextDecoderOptions({
      decompression: "gzip",
      fatal: true,
    });
    expect(result).toEqual({ fatal: true });
  });
});

describe("toUint8Array", () => {
  it("should return same instance for Uint8Array input", () => {
    const input = new Uint8Array([1, 2, 3]);
    const result = toUint8Array(input);
    expect(result).toBe(input);
  });

  it("should convert ArrayBuffer to Uint8Array", () => {
    const buffer = new ArrayBuffer(3);
    const view = new Uint8Array(buffer);
    view[0] = 1;
    view[1] = 2;
    view[2] = 3;

    const result = toUint8Array(buffer);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result)).toEqual([1, 2, 3]);
  });

  it("should convert DataView to Uint8Array", () => {
    const buffer = new ArrayBuffer(5);
    const dataView = new DataView(buffer, 1, 3);
    dataView.setUint8(0, 10);
    dataView.setUint8(1, 20);
    dataView.setUint8(2, 30);

    const result = toUint8Array(dataView);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result)).toEqual([10, 20, 30]);
  });

  it("should convert Int8Array to Uint8Array", () => {
    const int8 = new Int8Array([1, 2, 3]);
    const result = toUint8Array(int8);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(3);
    expect(Array.from(result)).toEqual([1, 2, 3]);
  });

  it("should handle partial ArrayBufferView (with offset)", () => {
    const buffer = new ArrayBuffer(10);
    const fullView = new Uint8Array(buffer);
    fullView.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

    // Create a partial view starting at offset 3 with length 4
    const partialView = new Uint8Array(buffer, 3, 4);
    const result = toUint8Array(partialView);

    expect(Array.from(result)).toEqual([3, 4, 5, 6]);
  });

  it("should handle empty ArrayBuffer", () => {
    const buffer = new ArrayBuffer(0);
    const result = toUint8Array(buffer);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(0);
  });

  it("should handle empty Uint8Array", () => {
    const input = new Uint8Array(0);
    const result = toUint8Array(input);

    expect(result).toBe(input);
    expect(result.length).toBe(0);
  });
});

describe("buildTextStream", () => {
  it("should decode UTF-8 binary stream to text", async () => {
    const text = "Hello, World!";
    const encoder = new TextEncoder();
    const encoded = encoder.encode(text);

    const binaryStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded);
        controller.close();
      },
    });

    const textStream = buildTextStream(binaryStream);
    const reader = textStream.getReader();
    const chunks: string[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    expect(chunks.join("")).toBe(text);
  });

  it("should use default charset utf-8 when not specified", async () => {
    const text = "日本語テスト";
    const encoder = new TextEncoder();
    const encoded = encoder.encode(text);

    const binaryStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded);
        controller.close();
      },
    });

    const textStream = buildTextStream(binaryStream);
    const reader = textStream.getReader();
    const chunks: string[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    expect(chunks.join("")).toBe(text);
  });

  it("should handle multiple chunks", async () => {
    const chunks = ["Hello", ", ", "World", "!"];
    const encoder = new TextEncoder();

    const binaryStream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    const textStream = buildTextStream(binaryStream);
    const reader = textStream.getReader();
    const resultChunks: string[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resultChunks.push(value);
    }

    expect(resultChunks.join("")).toBe("Hello, World!");
  });

  it("should handle empty stream", async () => {
    const binaryStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });

    const textStream = buildTextStream(binaryStream);
    const reader = textStream.getReader();
    const { done } = await reader.read();

    expect(done).toBe(true);
  });

  it("should apply decompression when specified", async () => {
    // First, compress some text data
    const text = "Compressed text content";
    const encoder = new TextEncoder();
    const originalData = encoder.encode(text);

    // Compress using CompressionStream
    const compressionStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(originalData);
        controller.close();
      },
    }).pipeThrough(
      new CompressionStream("gzip") as unknown as TransformStream<
        Uint8Array,
        Uint8Array
      >,
    );

    // Collect compressed data
    const compressedChunks: Uint8Array[] = [];
    const compressReader = compressionStream.getReader();
    while (true) {
      const { done, value } = await compressReader.read();
      if (done) break;
      compressedChunks.push(value);
    }

    // Create input stream from compressed data
    const binaryStream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of compressedChunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    // Now test buildTextStream with decompression
    const textStream = buildTextStream(binaryStream, { decompression: "gzip" });
    const reader = textStream.getReader();
    const resultChunks: string[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resultChunks.push(value);
    }

    expect(resultChunks.join("")).toBe(text);
  });
});

describe("decodeBinaryToString", () => {
  it("should decode UTF-8 bytes to string", async () => {
    const text = "Hello, World!";
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);

    const result = await decodeBinaryToString(bytes);

    expect(result).toBe(text);
  });

  it("should decode UTF-8 Japanese text", async () => {
    const text = "こんにちは世界";
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);

    const result = await decodeBinaryToString(bytes);

    expect(result).toBe(text);
  });

  it("should decode ArrayBuffer", async () => {
    const text = "ArrayBuffer test";
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);

    const result = await decodeBinaryToString(bytes.buffer);

    expect(result).toBe(text);
  });

  it("should use specified charset", async () => {
    const text = "Hello";
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);

    const result = await decodeBinaryToString(bytes, { charset: "utf-8" });

    expect(result).toBe(text);
  });

  it("should apply fatal option", async () => {
    // Invalid UTF-8 sequence
    const invalidBytes = new Uint8Array([0xff, 0xfe]);

    await expect(
      decodeBinaryToString(invalidBytes, { fatal: true }),
    ).rejects.toThrow();
  });

  it("should handle decompression", async () => {
    const text = "Text to compress and decompress";
    const encoder = new TextEncoder();
    const originalData = encoder.encode(text);

    // Compress the data
    const compressionStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(originalData);
        controller.close();
      },
    }).pipeThrough(
      new CompressionStream("gzip") as unknown as TransformStream<
        Uint8Array,
        Uint8Array
      >,
    );

    // Collect compressed data
    const compressedChunks: Uint8Array[] = [];
    const reader = compressionStream.getReader();
    let totalLength = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      compressedChunks.push(value);
      totalLength += value.length;
    }

    // Combine into single buffer
    const compressedData = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of compressedChunks) {
      compressedData.set(chunk, offset);
      offset += chunk.length;
    }

    // Now decode with decompression
    const result = await decodeBinaryToString(compressedData, {
      decompression: "gzip",
    });

    expect(result).toBe(text);
  });

  it("should handle empty buffer", async () => {
    const bytes = new Uint8Array(0);
    const result = await decodeBinaryToString(bytes);
    expect(result).toBe("");
  });
});
