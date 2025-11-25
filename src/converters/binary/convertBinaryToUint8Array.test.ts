import { describe, expect, it } from "vitest";
import { convertBinaryToUint8Array } from "./convertBinaryToUint8Array.ts";

describe("convertBinaryToUint8Array", () => {
  describe("Uint8Array input", () => {
    it("should return the same Uint8Array instance", () => {
      const input = new Uint8Array([1, 2, 3, 4, 5]);
      const result = convertBinaryToUint8Array(input);
      expect(result).toBe(input);
    });

    it("should handle empty Uint8Array", () => {
      const input = new Uint8Array(0);
      const result = convertBinaryToUint8Array(input);
      expect(result).toBe(input);
      expect(result.length).toBe(0);
    });
  });

  describe("ArrayBuffer input", () => {
    it("should convert ArrayBuffer to Uint8Array", () => {
      const buffer = new ArrayBuffer(4);
      const view = new Uint8Array(buffer);
      view.set([10, 20, 30, 40]);

      const result = convertBinaryToUint8Array(buffer);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result)).toEqual([10, 20, 30, 40]);
    });

    it("should handle empty ArrayBuffer", () => {
      const buffer = new ArrayBuffer(0);
      const result = convertBinaryToUint8Array(buffer);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(0);
    });
  });

  describe("Other ArrayBufferView inputs", () => {
    it("should convert DataView to Uint8Array", () => {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setUint8(0, 100);
      view.setUint8(1, 200);
      view.setUint8(2, 50);
      view.setUint8(3, 75);

      const result = convertBinaryToUint8Array(view);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(Array.from(result)).toEqual([100, 200, 50, 75]);
    });

    it("should convert Int8Array to Uint8Array", () => {
      const input = new Int8Array([-1, 0, 1, 127]);
      const result = convertBinaryToUint8Array(input);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(4);
    });

    it("should convert Int16Array to Uint8Array with correct byte length", () => {
      const input = new Int16Array([1, 2, 3]);
      const result = convertBinaryToUint8Array(input);
      expect(result).toBeInstanceOf(Uint8Array);
      // Int16Array has 2 bytes per element, so 3 elements = 6 bytes
      expect(result.length).toBe(6);
    });

    it("should convert Float32Array to Uint8Array with correct byte length", () => {
      const input = new Float32Array([1.0, 2.0]);
      const result = convertBinaryToUint8Array(input);
      expect(result).toBeInstanceOf(Uint8Array);
      // Float32Array has 4 bytes per element, so 2 elements = 8 bytes
      expect(result.length).toBe(8);
    });

    it("should handle ArrayBufferView with offset", () => {
      const buffer = new ArrayBuffer(10);
      const fullView = new Uint8Array(buffer);
      fullView.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      // Create a view with offset 2 and length 5
      const offsetView = new Uint8Array(buffer, 2, 5);

      const result = convertBinaryToUint8Array(offsetView);
      expect(result).toBe(offsetView); // Uint8Array should be returned as-is
      expect(Array.from(result)).toEqual([2, 3, 4, 5, 6]);
    });

    it("should handle DataView with offset correctly", () => {
      const buffer = new ArrayBuffer(10);
      const fullView = new Uint8Array(buffer);
      fullView.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);

      // Create a DataView with offset 3 and length 4
      const dataView = new DataView(buffer, 3, 4);

      const result = convertBinaryToUint8Array(dataView);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(4);
      expect(Array.from(result)).toEqual([3, 4, 5, 6]);
    });
  });

  describe("Error handling", () => {
    it("should throw TypeError for invalid input", () => {
      expect(() => convertBinaryToUint8Array(null as any)).toThrow(TypeError);
      expect(() => convertBinaryToUint8Array(undefined as any)).toThrow(TypeError);
      expect(() => convertBinaryToUint8Array("string" as any)).toThrow(TypeError);
      expect(() => convertBinaryToUint8Array(123 as any)).toThrow(TypeError);
      expect(() => convertBinaryToUint8Array({} as any)).toThrow(TypeError);
      expect(() => convertBinaryToUint8Array([] as any)).toThrow(TypeError);
    });

    it("should throw TypeError with correct message", () => {
      expect(() => convertBinaryToUint8Array("invalid" as any)).toThrow(
        "binary must be a BufferSource",
      );
    });
  });
});
