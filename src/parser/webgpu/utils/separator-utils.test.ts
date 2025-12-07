/**
 * Unit tests for separator utility functions
 */

import { describe, expect, it } from "vitest";
import { SEP_TYPE_COMMA, SEP_TYPE_LF } from "../indexing/types.ts";
import {
  findLastLineFeed,
  getProcessedBytesCount,
  getValidSeparators,
  isComma,
  isLineFeed,
  packSeparator,
  unpackSeparator,
} from "./separator-utils.ts";

describe("separator-utils", () => {
  describe("packSeparator", () => {
    it("should pack comma separator correctly", () => {
      const packed = packSeparator(100, SEP_TYPE_COMMA);
      expect(packed).toBe(100); // No MSB set
    });

    it("should pack LF separator correctly", () => {
      const packed = packSeparator(100, SEP_TYPE_LF);
      expect(packed).toBe(0x80000064); // MSB set + 100
    });

    it("should handle offset 0", () => {
      const packed = packSeparator(0, SEP_TYPE_COMMA);
      expect(packed).toBe(0);
    });

    it("should handle maximum offset (2GB - 1)", () => {
      const maxOffset = 0x7fffffff;
      const packed = packSeparator(maxOffset, SEP_TYPE_COMMA);
      expect(packed).toBe(maxOffset);
    });
  });

  describe("unpackSeparator", () => {
    it("should unpack comma separator correctly", () => {
      const sep = unpackSeparator(100);
      expect(sep.offset).toBe(100);
      expect(sep.type).toBe(SEP_TYPE_COMMA);
    });

    it("should unpack LF separator correctly", () => {
      const sep = unpackSeparator(0x80000064);
      expect(sep.offset).toBe(100);
      expect(sep.type).toBe(SEP_TYPE_LF);
    });

    it("should roundtrip pack/unpack", () => {
      const original = { offset: 12345, type: SEP_TYPE_LF };
      const packed = packSeparator(original.offset, original.type);
      const unpacked = unpackSeparator(packed);
      expect(unpacked.offset).toBe(original.offset);
      expect(unpacked.type).toBe(original.type);
    });
  });

  describe("isComma", () => {
    it("should return true for comma separator", () => {
      const sep = unpackSeparator(packSeparator(10, SEP_TYPE_COMMA));
      expect(isComma(sep)).toBe(true);
    });

    it("should return false for LF separator", () => {
      const sep = unpackSeparator(packSeparator(10, SEP_TYPE_LF));
      expect(isComma(sep)).toBe(false);
    });
  });

  describe("isLineFeed", () => {
    it("should return true for LF separator", () => {
      const sep = unpackSeparator(packSeparator(10, SEP_TYPE_LF));
      expect(isLineFeed(sep)).toBe(true);
    });

    it("should return false for comma separator", () => {
      const sep = unpackSeparator(packSeparator(10, SEP_TYPE_COMMA));
      expect(isLineFeed(sep)).toBe(false);
    });
  });

  describe("findLastLineFeed", () => {
    it("should find last LF in array", () => {
      const indices = new Uint32Array([
        packSeparator(10, SEP_TYPE_COMMA),
        packSeparator(20, SEP_TYPE_LF),
        packSeparator(30, SEP_TYPE_COMMA),
        packSeparator(40, SEP_TYPE_LF),
        packSeparator(50, SEP_TYPE_COMMA),
      ]);

      const lastLFIndex = findLastLineFeed(indices, 5);
      expect(lastLFIndex).toBe(3);
    });

    it("should return -1 if no LF found", () => {
      const indices = new Uint32Array([
        packSeparator(10, SEP_TYPE_COMMA),
        packSeparator(20, SEP_TYPE_COMMA),
      ]);

      const lastLFIndex = findLastLineFeed(indices, 2);
      expect(lastLFIndex).toBe(-1);
    });

    it("should respect count parameter", () => {
      const indices = new Uint32Array([
        packSeparator(10, SEP_TYPE_LF),
        packSeparator(20, SEP_TYPE_LF),
        packSeparator(30, SEP_TYPE_LF),
      ]);

      const lastLFIndex = findLastLineFeed(indices, 2);
      expect(lastLFIndex).toBe(1); // Only checks first 2 elements
    });
  });

  describe("getProcessedBytesCount", () => {
    it("should return byte count after last LF", () => {
      const indices = new Uint32Array([
        packSeparator(10, SEP_TYPE_COMMA),
        packSeparator(20, SEP_TYPE_LF),
        packSeparator(30, SEP_TYPE_COMMA),
      ]);

      const count = getProcessedBytesCount(indices, 3);
      expect(count).toBe(21); // 20 + 1 to include the LF
    });

    it("should return 0 if no LF found", () => {
      const indices = new Uint32Array([
        packSeparator(10, SEP_TYPE_COMMA),
        packSeparator(20, SEP_TYPE_COMMA),
      ]);

      const count = getProcessedBytesCount(indices, 2);
      expect(count).toBe(0);
    });
  });

  describe("getValidSeparators", () => {
    it("should return separators up to last LF", () => {
      const indices = new Uint32Array([
        packSeparator(10, SEP_TYPE_COMMA),
        packSeparator(20, SEP_TYPE_LF),
        packSeparator(30, SEP_TYPE_COMMA),
        packSeparator(40, SEP_TYPE_COMMA),
      ]);

      const seps = getValidSeparators(indices, 4);
      expect(seps).toHaveLength(2);
      expect(seps[0]!.offset).toBe(10);
      expect(seps[1]!.offset).toBe(20);
    });

    it("should return empty array if no LF found", () => {
      const indices = new Uint32Array([
        packSeparator(10, SEP_TYPE_COMMA),
        packSeparator(20, SEP_TYPE_COMMA),
      ]);

      const seps = getValidSeparators(indices, 2);
      expect(seps).toHaveLength(0);
    });

    it("should include the LF separator itself", () => {
      const indices = new Uint32Array([
        packSeparator(10, SEP_TYPE_COMMA),
        packSeparator(20, SEP_TYPE_LF),
      ]);

      const seps = getValidSeparators(indices, 2);
      expect(seps).toHaveLength(2);
      expect(seps[1]!.type).toBe(SEP_TYPE_LF);
    });
  });
});
