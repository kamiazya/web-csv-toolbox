/**
 * Tests for WebGPU alignment utilities
 */

import { describe, expect, it } from "vitest";
import { alignToU32 } from "./alignToU32.ts";
import { padToU32Aligned } from "./padToU32Aligned.ts";
import { toUint32View } from "./toUint32View.ts";

describe("alignToU32", () => {
  it("should return the same size if already aligned", () => {
    expect(alignToU32(0)).toBe(0);
    expect(alignToU32(4)).toBe(4);
    expect(alignToU32(8)).toBe(8);
    expect(alignToU32(12)).toBe(12);
    expect(alignToU32(100)).toBe(100);
  });

  it("should round up to nearest multiple of 4", () => {
    expect(alignToU32(1)).toBe(4);
    expect(alignToU32(2)).toBe(4);
    expect(alignToU32(3)).toBe(4);
    expect(alignToU32(5)).toBe(8);
    expect(alignToU32(6)).toBe(8);
    expect(alignToU32(7)).toBe(8);
    expect(alignToU32(9)).toBe(12);
  });

  it("should handle large numbers", () => {
    expect(alignToU32(1000)).toBe(1000);
    expect(alignToU32(1001)).toBe(1004);
    expect(alignToU32(10001)).toBe(10004);
  });

  it("should handle edge cases", () => {
    expect(alignToU32(0)).toBe(0);
    expect(alignToU32(1)).toBe(4);
  });
});

describe("padToU32Aligned", () => {
  it("should return original array if already aligned", () => {
    const arr4 = new Uint8Array(4);
    expect(padToU32Aligned(arr4)).toBe(arr4); // Same reference

    const arr8 = new Uint8Array(8);
    expect(padToU32Aligned(arr8)).toBe(arr8);
  });

  it("should pad array to aligned size", () => {
    const arr1 = new Uint8Array([1]);
    const padded1 = padToU32Aligned(arr1);
    expect(padded1.length).toBe(4);
    expect(padded1[0]).toBe(1);
    expect(padded1[1]).toBe(0);
    expect(padded1[2]).toBe(0);
    expect(padded1[3]).toBe(0);

    const arr3 = new Uint8Array([1, 2, 3]);
    const padded3 = padToU32Aligned(arr3);
    expect(padded3.length).toBe(4);
    expect(padded3[0]).toBe(1);
    expect(padded3[1]).toBe(2);
    expect(padded3[2]).toBe(3);
    expect(padded3[3]).toBe(0);
  });

  it("should preserve data in padded array", () => {
    const original = new Uint8Array([10, 20, 30, 40, 50]);
    const padded = padToU32Aligned(original);
    expect(padded.length).toBe(8);
    expect(padded.slice(0, 5)).toEqual(original);
    expect(padded[5]).toBe(0);
    expect(padded[6]).toBe(0);
    expect(padded[7]).toBe(0);
  });

  it("should handle empty array", () => {
    const empty = new Uint8Array(0);
    const padded = padToU32Aligned(empty);
    expect(padded.length).toBe(0);
    expect(padded).toBe(empty);
  });

  it("should not modify original array", () => {
    const original = new Uint8Array([1, 2, 3]);
    const originalCopy = new Uint8Array(original);
    padToU32Aligned(original);
    expect(original).toEqual(originalCopy);
  });
});

describe("toUint32View", () => {
  it("should create Uint32 view of aligned buffer", () => {
    const arr = new Uint8Array([1, 0, 0, 0, 2, 0, 0, 0]);
    const view = toUint32View(arr);
    expect(view.length).toBe(2);
    expect(view[0]).toBe(1);
    expect(view[1]).toBe(2);
  });

  it("should handle endianness correctly", () => {
    // Little-endian: 0x01020304 = [4, 3, 2, 1]
    const arr = new Uint8Array([4, 3, 2, 1]);
    const view = toUint32View(arr);
    expect(view.length).toBe(1);
    expect(view[0]).toBe(0x01020304);
  });

  it("should share buffer with original array", () => {
    const arr = new Uint8Array([1, 0, 0, 0]);
    const view = toUint32View(arr);

    // Modify through Uint32 view
    view[0] = 0x12345678;

    // Should reflect in original array (little-endian)
    expect(arr[0]).toBe(0x78);
    expect(arr[1]).toBe(0x56);
    expect(arr[2]).toBe(0x34);
    expect(arr[3]).toBe(0x12);
  });

  it("should handle aligned buffers of various sizes", () => {
    expect(toUint32View(new Uint8Array(0)).length).toBe(0);
    expect(toUint32View(new Uint8Array(4)).length).toBe(1);
    expect(toUint32View(new Uint8Array(8)).length).toBe(2);
    expect(toUint32View(new Uint8Array(100)).length).toBe(25);
  });

  it("should work with aligned but offset buffers", () => {
    // Create a larger buffer
    const largeArr = new Uint8Array(16);
    largeArr.set([1, 0, 0, 0, 2, 0, 0, 0], 4); // Offset by 4 bytes

    // Create subarray (aligned at offset 4)
    const subArr = largeArr.subarray(4, 12);
    const view = toUint32View(subArr);

    expect(view.length).toBe(2);
    expect(view[0]).toBe(1);
    expect(view[1]).toBe(2);
  });
});
