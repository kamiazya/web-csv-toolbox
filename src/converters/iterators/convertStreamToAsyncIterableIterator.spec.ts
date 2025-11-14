import { describe, expect, it, vi } from "vitest";
import { convertStreamToAsyncIterableIterator } from "@/converters/iterators/convertStreamToAsyncIterableIterator.ts";

/**
 * Helper function to collect all values from an async iterable into an array
 */
async function collectAsyncIterator<T>(
  iterator: AsyncIterableIterator<T>,
): Promise<T[]> {
  const results: T[] = [];
  for await (const value of iterator) {
    results.push(value);
  }
  return results;
}

/**
 * Helper function to create a simple ReadableStream from an array of values
 */
function createStream<T>(values: T[]): ReadableStream<T> {
  return new ReadableStream({
    start(controller) {
      for (const value of values) {
        controller.enqueue(value);
      }
      controller.close();
    },
  });
}

/**
 * Helper function to create a stream that errors after emitting some values
 */
function createErrorStream<T>(
  values: T[],
  errorMessage: string,
): ReadableStream<T> {
  return new ReadableStream({
    start(controller) {
      for (const value of values) {
        controller.enqueue(value);
      }
      controller.error(new Error(errorMessage));
    },
  });
}

describe("convertStreamToAsyncIterableIterator", () => {
  it("should convert a simple stream to async iterable iterator", async () => {
    const stream = createStream([1, 2, 3, 4, 5]);
    const iterator = convertStreamToAsyncIterableIterator(stream);

    const result = await collectAsyncIterator(iterator);

    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it("should handle empty streams", async () => {
    const stream = createStream<number>([]);
    const iterator = convertStreamToAsyncIterableIterator(stream);

    const result = await collectAsyncIterator(iterator);

    expect(result).toEqual([]);
  });

  it("should handle streams with string values", async () => {
    const stream = createStream(["hello", "world", "test"]);
    const iterator = convertStreamToAsyncIterableIterator(stream);

    const result = await collectAsyncIterator(iterator);

    expect(result).toEqual(["hello", "world", "test"]);
  });

  it("should handle streams with object values", async () => {
    const objects = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
      { id: 3, name: "Charlie" },
    ];
    const stream = createStream(objects);
    const iterator = convertStreamToAsyncIterableIterator(stream);

    const result = await collectAsyncIterator(iterator);

    expect(result).toEqual(objects);
  });

  it("should propagate errors from the stream", async () => {
    const stream = createErrorStream([1, 2], "test error");
    const iterator = convertStreamToAsyncIterableIterator(stream);

    await expect(collectAsyncIterator(iterator)).rejects.toThrow("test error");
  });

  it("should handle streams that error immediately", async () => {
    const stream = createErrorStream<number>([], "immediate error");
    const iterator = convertStreamToAsyncIterableIterator(stream);

    await expect(collectAsyncIterator(iterator)).rejects.toThrow(
      "immediate error",
    );
  });

  it("should allow manual iteration with next()", async () => {
    const stream = createStream([1, 2, 3]);
    const iterator = convertStreamToAsyncIterableIterator(stream);

    const first = await iterator.next();
    expect(first).toEqual({ value: 1, done: false });

    const second = await iterator.next();
    expect(second).toEqual({ value: 2, done: false });

    const third = await iterator.next();
    expect(third).toEqual({ value: 3, done: false });

    const fourth = await iterator.next();
    expect(fourth.done).toBe(true);
  });

  it("should handle large streams efficiently", async () => {
    const largeArray = Array.from({ length: 10000 }, (_, i) => i);
    const stream = createStream(largeArray);
    const iterator = convertStreamToAsyncIterableIterator(stream);

    const result = await collectAsyncIterator(iterator);

    expect(result).toEqual(largeArray);
    expect(result.length).toBe(10000);
  });

  it("should handle Uint8Array streams", async () => {
    const chunks = [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6]),
      new Uint8Array([7, 8, 9]),
    ];
    const stream = createStream(chunks);
    const iterator = convertStreamToAsyncIterableIterator(stream);

    const result = await collectAsyncIterator(iterator);

    expect(result).toEqual(chunks);
    expect(result[0]).toBeInstanceOf(Uint8Array);
  });

  it("should work with for-await-of loop", async () => {
    const stream = createStream(["a", "b", "c"]);
    const iterator = convertStreamToAsyncIterableIterator(stream);

    const result: string[] = [];
    for await (const value of iterator) {
      result.push(value);
    }

    expect(result).toEqual(["a", "b", "c"]);
  });

  it("should handle early termination with break", async () => {
    const stream = createStream([1, 2, 3, 4, 5]);
    const iterator = convertStreamToAsyncIterableIterator(stream);

    const result: number[] = [];
    for await (const value of iterator) {
      result.push(value);
      if (value === 3) break;
    }

    expect(result).toEqual([1, 2, 3]);
  });

  it("should handle stream with null and undefined values", async () => {
    const stream = createStream([null, undefined, 0, "", false]);
    const iterator = convertStreamToAsyncIterableIterator(stream);

    const result = await collectAsyncIterator(iterator);

    expect(result).toEqual([null, undefined, 0, "", false]);
  });

  describe("native async iteration detection", () => {
    it("should use native Symbol.asyncIterator when available", async () => {
      const stream = createStream([1, 2, 3]);

      // Spy on the Symbol.asyncIterator method
      const originalAsyncIterator = (stream as any)[Symbol.asyncIterator];
      const asyncIteratorSpy = vi.fn(originalAsyncIterator.bind(stream));

      // Replace Symbol.asyncIterator with the spy
      Object.defineProperty(stream, Symbol.asyncIterator, {
        value: asyncIteratorSpy,
        writable: true,
        configurable: true,
      });

      const iterator = convertStreamToAsyncIterableIterator(stream);
      await collectAsyncIterator(iterator);

      // Verify native async iterator method was called
      expect(asyncIteratorSpy).toHaveBeenCalledOnce();
    });

    it("should produce same results in native and fallback paths", async () => {
      const testData = [1, 2, 3, 4, 5];

      // Test with native path (if available)
      const nativeStream = createStream(testData);
      const nativeResult = await collectAsyncIterator(
        convertStreamToAsyncIterableIterator(nativeStream),
      );

      // Test with forced fallback path
      const fallbackStream = createStream(testData);
      // Remove Symbol.asyncIterator to force fallback
      delete (fallbackStream as any)[Symbol.asyncIterator];
      const fallbackResult = await collectAsyncIterator(
        convertStreamToAsyncIterableIterator(fallbackStream),
      );

      // Both should produce identical results
      expect(nativeResult).toEqual(testData);
      expect(fallbackResult).toEqual(testData);
      expect(nativeResult).toEqual(fallbackResult);
    });
  });

  describe("fallback path resource management", () => {
    it("should call releaseLock on successful completion", async () => {
      const stream = createStream([1, 2, 3]);

      const releaseLockSpy = vi.fn();
      const originalGetReader = stream.getReader.bind(stream);

      // Force fallback by making Symbol.asyncIterator check fail
      Object.defineProperty(stream, Symbol.asyncIterator, {
        value: undefined,
        writable: true,
        configurable: true,
      });

      // Mock getReader to spy on releaseLock
      stream.getReader = vi.fn(() => {
        const reader = originalGetReader();
        const originalReleaseLock = reader.releaseLock.bind(reader);
        reader.releaseLock = vi.fn(() => {
          releaseLockSpy();
          originalReleaseLock();
        });
        return reader;
      }) as any;

      const iterator = convertStreamToAsyncIterableIterator(stream);
      await collectAsyncIterator(iterator);

      expect(releaseLockSpy).toHaveBeenCalledOnce();
    });

    it("should call cancel and releaseLock on error", async () => {
      const stream = createErrorStream([1, 2], "test error");

      const cancelSpy = vi.fn();
      const releaseLockSpy = vi.fn();
      const originalGetReader = stream.getReader.bind(stream);

      // Force fallback by making Symbol.asyncIterator check fail
      Object.defineProperty(stream, Symbol.asyncIterator, {
        value: undefined,
        writable: true,
        configurable: true,
      });

      // Mock getReader to spy on cancel and releaseLock
      stream.getReader = vi.fn(() => {
        const reader = originalGetReader();
        const originalCancel = reader.cancel.bind(reader);
        const originalReleaseLock = reader.releaseLock.bind(reader);

        reader.cancel = vi.fn(async (reason) => {
          cancelSpy(reason);
          return originalCancel(reason);
        });

        reader.releaseLock = vi.fn(() => {
          releaseLockSpy();
          originalReleaseLock();
        });

        return reader;
      }) as any;

      const iterator = convertStreamToAsyncIterableIterator(stream);

      await expect(collectAsyncIterator(iterator)).rejects.toThrow(
        "test error",
      );

      // Verify cancel was called with the error
      expect(cancelSpy).toHaveBeenCalledOnce();
      expect(cancelSpy).toHaveBeenCalledWith(expect.any(Error));
      expect(cancelSpy.mock.calls[0]![0].message).toBe("test error");

      // Verify releaseLock was called even on error
      expect(releaseLockSpy).toHaveBeenCalledOnce();
    });

    it("should call releaseLock even if cancel fails", async () => {
      const stream = createErrorStream([1], "stream error");

      const releaseLockSpy = vi.fn();
      const originalGetReader = stream.getReader.bind(stream);

      // Force fallback by making Symbol.asyncIterator check fail
      Object.defineProperty(stream, Symbol.asyncIterator, {
        value: undefined,
        writable: true,
        configurable: true,
      });

      stream.getReader = vi.fn(() => {
        const reader = originalGetReader();
        const originalReleaseLock = reader.releaseLock.bind(reader);

        // Make cancel throw an error
        reader.cancel = vi.fn(async () => {
          throw new Error("cancel failed");
        });

        reader.releaseLock = vi.fn(() => {
          releaseLockSpy();
          originalReleaseLock();
        });

        return reader;
      }) as any;

      const iterator = convertStreamToAsyncIterableIterator(stream);

      await expect(collectAsyncIterator(iterator)).rejects.toThrow(
        "stream error",
      );

      // releaseLock should still be called even if cancel fails
      expect(releaseLockSpy).toHaveBeenCalledOnce();
    });

    it("should release lock on early termination with break", async () => {
      const stream = createStream([1, 2, 3, 4, 5]);

      const cancelSpy = vi.fn();
      const releaseLockSpy = vi.fn();
      const originalGetReader = stream.getReader.bind(stream);

      // Force fallback by making Symbol.asyncIterator check fail
      Object.defineProperty(stream, Symbol.asyncIterator, {
        value: undefined,
        writable: true,
        configurable: true,
      });

      stream.getReader = vi.fn(() => {
        const reader = originalGetReader();
        const originalCancel = reader.cancel.bind(reader);
        const originalReleaseLock = reader.releaseLock.bind(reader);

        reader.cancel = vi.fn(async (reason) => {
          cancelSpy(reason);
          return originalCancel(reason);
        });

        reader.releaseLock = vi.fn(() => {
          releaseLockSpy();
          originalReleaseLock();
        });

        return reader;
      }) as any;

      const iterator = convertStreamToAsyncIterableIterator(stream);
      const result: number[] = [];

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const value of iterator) {
        result.push(value);
        if (value === 3) break;
      }

      expect(result).toEqual([1, 2, 3]);

      // Verify cancel was called on early termination
      expect(cancelSpy).toHaveBeenCalledOnce();
      expect(cancelSpy).toHaveBeenCalledWith(undefined);

      // Verify releaseLock was called
      expect(releaseLockSpy).toHaveBeenCalledOnce();
    });
  });
});
