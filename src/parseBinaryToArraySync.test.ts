import { expect, test } from "vitest";
import { parseBinaryToArraySync } from "./parseBinaryToArraySync.ts";

const csv = new TextEncoder().encode(`name,age
Alice,42
Bob,69`);

const expected = [
  { name: "Alice", age: "42" },
  { name: "Bob", age: "69" },
];

test("parseBinaryToArraySync", async () => {
  expect(parseBinaryToArraySync(csv)).toEqual(expected);
});

test("throws an error if the binary is invalid", () => {
  expect(() =>
    parseBinaryToArraySync(new Uint8Array([0x80]), {
      fatal: true,
    }),
  ).toThrowError(TypeError); // NOTE: Error messages vary depending on the execution environment.
});

test("throws RangeError if binary size exceeds maxBinarySize", () => {
  const largeData = new Uint8Array(1000);
  expect(() =>
    parseBinaryToArraySync(largeData, {
      maxBinarySize: 500,
    }),
  ).toThrowError(/Binary size \(1000 bytes\) exceeded maximum allowed size of 500 bytes/);
});

test("allows binary within maxBinarySize limit", () => {
  const data = new TextEncoder().encode("a,b\n1,2");
  expect(() =>
    parseBinaryToArraySync(data, {
      maxBinarySize: 1000,
    }),
  ).not.toThrow();
});

test("allows infinite maxBinarySize", () => {
  const largeData = new Uint8Array(200 * 1024 * 1024); // 200MB
  expect(() =>
    parseBinaryToArraySync(largeData, {
      maxBinarySize: Number.POSITIVE_INFINITY,
      maxBufferSize: Number.POSITIVE_INFINITY,
    }),
  ).not.toThrow();
});

test("throws RangeError for invalid maxBinarySize", () => {
  const data = new Uint8Array(10);
  expect(() =>
    parseBinaryToArraySync(data, {
      maxBinarySize: -1,
    }),
  ).toThrowError(/maxBinarySize must be a non-negative number or Number\.POSITIVE_INFINITY/);
  expect(() =>
    parseBinaryToArraySync(data, {
      maxBinarySize: Number.NaN,
    }),
  ).toThrowError(/maxBinarySize must be a non-negative number or Number\.POSITIVE_INFINITY/);
});
