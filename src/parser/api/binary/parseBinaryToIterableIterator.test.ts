import { describe, expect, test } from "vitest";
import { parseBinaryToIterableIterator } from "@/parser/api/binary/parseBinaryToIterableIterator.ts";

const csv = new TextEncoder().encode(`name,age
Alice,42
Bob,69`);

const expected = [
  { name: "Alice", age: "42" },
  { name: "Bob", age: "69" },
];

test("parseBinaryToIterableIterator", () => {
  const iterator = parseBinaryToIterableIterator(csv);
  const results = Array.from(iterator);
  expect(results).toEqual(expected);
});

test("should work with ArrayBuffer input", () => {
  const arrayBuffer = csv.buffer.slice(
    csv.byteOffset,
    csv.byteOffset + csv.byteLength,
  );
  const iterator = parseBinaryToIterableIterator(arrayBuffer);
  const results = Array.from(iterator);
  expect(results).toEqual(expected);
});

test("throws an error if the binary is invalid", () => {
  expect(() => {
    const iterator = parseBinaryToIterableIterator(new Uint8Array([0x80]), {
      fatal: true,
    });
    Array.from(iterator); // Must consume iterator to trigger error
  }).toThrowError(TypeError);
});

describe("maxBinarySize validation", () => {
  test("throws RangeError if binary size exceeds maxBinarySize", () => {
    const largeData = new Uint8Array(1000);
    expect(() =>
      parseBinaryToIterableIterator(largeData, {
        maxBinarySize: 500,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: Binary size (1000 bytes) exceeded maximum allowed size of 500 bytes]`,
    );
  });

  test("allows binary within maxBinarySize limit", () => {
    const data = new TextEncoder().encode("a,b\n1,2");
    expect(() =>
      parseBinaryToIterableIterator(data, {
        maxBinarySize: 1000,
      }),
    ).not.toThrow();
  });

  test("allows infinite maxBinarySize", () => {
    const largeData = new Uint8Array(200 * 1024 * 1024); // 200MB
    expect(() =>
      parseBinaryToIterableIterator(largeData, {
        maxBinarySize: Number.POSITIVE_INFINITY,
        maxBufferSize: Number.POSITIVE_INFINITY,
      }),
    ).not.toThrow();
  });

  test("throws RangeError for invalid maxBinarySize (negative)", () => {
    const data = new Uint8Array(10);
    expect(() =>
      parseBinaryToIterableIterator(data, {
        maxBinarySize: -1,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: maxBinarySize must be a non-negative number or Number.POSITIVE_INFINITY]`,
    );
  });

  test("throws RangeError for invalid maxBinarySize (NaN)", () => {
    const data = new Uint8Array(10);
    expect(() =>
      parseBinaryToIterableIterator(data, {
        maxBinarySize: Number.NaN,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: maxBinarySize must be a non-negative number or Number.POSITIVE_INFINITY]`,
    );
  });

  test("uses default maxBinarySize when not specified", () => {
    // DEFAULT_BINARY_MAX_SIZE is 536870912 (512MB), so this should pass
    const smallData = new Uint8Array(1000);
    expect(() => parseBinaryToIterableIterator(smallData)).not.toThrow();
  });

  test("validates maxBinarySize before processing data", () => {
    // Error should be thrown immediately, not when consuming iterator
    const largeData = new Uint8Array(1000);
    expect(() =>
      parseBinaryToIterableIterator(largeData, {
        maxBinarySize: 500,
      }),
    ).toThrow();
  });
});

describe("Integration with FlexibleBinaryObjectCSVParser", () => {
  test("should produce same results as using parser directly", async () => {
    const { FlexibleBinaryObjectCSVParser } = await import(
      "@/parser/models/FlexibleBinaryObjectCSVParser.ts"
    );

    const options = {
      header: ["name", "age"] as const,
      charset: "utf-8" as const,
    };
    const parser = new FlexibleBinaryObjectCSVParser(options);

    const encoder = new TextEncoder();
    const data = encoder.encode("Alice,30\nBob,25");

    const parserResults = Array.from(parser.parse(data));
    const iteratorResults = Array.from(
      parseBinaryToIterableIterator(data, options),
    );

    expect(iteratorResults).toEqual(parserResults);
  });

  test("should handle streaming options", () => {
    const encoder = new TextEncoder();
    const options = {
      header: ["name", "age"] as const,
      charset: "utf-8" as const,
    };

    // parseBinaryToIterableIterator doesn't support stream option directly,
    // but it should parse complete data correctly
    const data = encoder.encode("Alice,30\nBob");
    const results = Array.from(parseBinaryToIterableIterator(data, options));

    expect(results).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "" }, // Missing field returns empty string
    ]);
  });
});

describe("Output format options", () => {
  test("should support array output format", () => {
    const encoder = new TextEncoder();
    const data = encoder.encode("Alice,30\nBob,25");

    const results = Array.from(
      parseBinaryToIterableIterator(data, {
        header: ["name", "age"] as const,
        outputFormat: "array",
        charset: "utf-8",
      }),
    );

    expect(results).toEqual([
      ["Alice", "30"],
      ["Bob", "25"],
    ]);
  });

  test("should support includeHeader with array format", () => {
    const encoder = new TextEncoder();
    const data = encoder.encode("Alice,30\nBob,25");

    const results = Array.from(
      parseBinaryToIterableIterator(data, {
        header: ["name", "age"] as const,
        outputFormat: "array",
        includeHeader: true,
        charset: "utf-8",
      }),
    );

    expect(results).toEqual([
      ["name", "age"],
      ["Alice", "30"],
      ["Bob", "25"],
    ]);
  });
});
