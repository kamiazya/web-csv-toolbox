/**
 * Unit tests for buffer utility functions
 */

import { describe, it, expect } from "vitest";
import {
	concatUint8Arrays,
	hasBOM,
	stripBOM,
	isCR,
	isLF,
	adjustForCRLF,
	decodeUTF8,
	alignToU32,
	padToU32Aligned,
	toUint32View,
	BufferPool,
} from "./buffer-utils.ts";

describe("buffer-utils", () => {
	describe("concatUint8Arrays", () => {
		it("should concatenate two arrays", () => {
			const a = new Uint8Array([1, 2, 3]);
			const b = new Uint8Array([4, 5, 6]);
			const result = concatUint8Arrays(a, b);
			expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
		});

		it("should return second array if first is empty", () => {
			const a = new Uint8Array([]);
			const b = new Uint8Array([1, 2, 3]);
			const result = concatUint8Arrays(a, b);
			expect(result).toBe(b); // Same reference
		});

		it("should return first array if second is empty", () => {
			const a = new Uint8Array([1, 2, 3]);
			const b = new Uint8Array([]);
			const result = concatUint8Arrays(a, b);
			expect(result).toBe(a); // Same reference
		});
	});

	describe("hasBOM", () => {
		it("should detect UTF-8 BOM", () => {
			const buffer = new Uint8Array([0xef, 0xbb, 0xbf, 0x48, 0x69]);
			expect(hasBOM(buffer)).toBe(true);
		});

		it("should return false for non-BOM data", () => {
			const buffer = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
			expect(hasBOM(buffer)).toBe(false);
		});

		it("should return false for too-short buffer", () => {
			const buffer = new Uint8Array([0xef, 0xbb]);
			expect(hasBOM(buffer)).toBe(false);
		});
	});

	describe("stripBOM", () => {
		it("should remove BOM from buffer", () => {
			const buffer = new Uint8Array([0xef, 0xbb, 0xbf, 0x48, 0x69]);
			const result = stripBOM(buffer);
			expect(result).toEqual(new Uint8Array([0x48, 0x69]));
		});

		it("should return original buffer if no BOM", () => {
			const buffer = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
			const result = stripBOM(buffer);
			expect(result).toBe(buffer); // Same reference (subarray)
		});

		it("should be zero-copy (use subarray)", () => {
			const buffer = new Uint8Array([0xef, 0xbb, 0xbf, 0x48, 0x69]);
			const result = stripBOM(buffer);
			expect(result.buffer).toBe(buffer.buffer);
		});
	});

	describe("isCR", () => {
		it("should return true for carriage return", () => {
			expect(isCR(0x0d)).toBe(true);
		});

		it("should return false for other bytes", () => {
			expect(isCR(0x0a)).toBe(false); // LF
			expect(isCR(0x20)).toBe(false); // Space
		});
	});

	describe("isLF", () => {
		it("should return true for line feed", () => {
			expect(isLF(0x0a)).toBe(true);
		});

		it("should return false for other bytes", () => {
			expect(isLF(0x0d)).toBe(false); // CR
			expect(isLF(0x20)).toBe(false); // Space
		});
	});

	describe("adjustForCRLF", () => {
		it("should adjust position for CRLF", () => {
			const buffer = new Uint8Array([0x48, 0x69, 0x0d, 0x0a]); // Hi\r\n
			const adjusted = adjustForCRLF(buffer, 3); // LF at position 3
			expect(adjusted).toBe(2); // Should exclude CR at position 2
		});

		it("should not adjust for plain LF", () => {
			const buffer = new Uint8Array([0x48, 0x69, 0x0a]); // Hi\n
			const adjusted = adjustForCRLF(buffer, 2); // LF at position 2
			expect(adjusted).toBe(2); // No CR before, no adjustment
		});

		it("should handle LF at position 0", () => {
			const buffer = new Uint8Array([0x0a, 0x48, 0x69]); // \nHi
			const adjusted = adjustForCRLF(buffer, 0);
			expect(adjusted).toBe(0);
		});
	});

	describe("decodeUTF8", () => {
		it("should decode UTF-8 string", () => {
			const buffer = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // Hello
			const result = decodeUTF8(buffer, 0, 5);
			expect(result).toBe("Hello");
		});

		it("should decode partial buffer", () => {
			const buffer = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // Hello
			const result = decodeUTF8(buffer, 0, 2);
			expect(result).toBe("He");
		});

		it("should decode UTF-8 multibyte characters", () => {
			const buffer = new Uint8Array([0xe3, 0x81, 0x82]); // あ (hiragana A)
			const result = decodeUTF8(buffer, 0, 3);
			expect(result).toBe("あ");
		});
	});

	describe("alignToU32", () => {
		it("should align to 4-byte boundary", () => {
			expect(alignToU32(0)).toBe(0);
			expect(alignToU32(1)).toBe(4);
			expect(alignToU32(2)).toBe(4);
			expect(alignToU32(3)).toBe(4);
			expect(alignToU32(4)).toBe(4);
			expect(alignToU32(5)).toBe(8);
		});

		it("should not change already-aligned values", () => {
			expect(alignToU32(8)).toBe(8);
			expect(alignToU32(16)).toBe(16);
			expect(alignToU32(1024)).toBe(1024);
		});
	});

	describe("padToU32Aligned", () => {
		it("should pad to 4-byte boundary", () => {
			const buffer = new Uint8Array([1, 2, 3]);
			const padded = padToU32Aligned(buffer);
			expect(padded.length).toBe(4);
			expect(padded[0]).toBe(1);
			expect(padded[1]).toBe(2);
			expect(padded[2]).toBe(3);
			expect(padded[3]).toBe(0); // Padding
		});

		it("should not pad already-aligned buffer", () => {
			const buffer = new Uint8Array([1, 2, 3, 4]);
			const padded = padToU32Aligned(buffer);
			expect(padded).toBe(buffer); // Same reference
		});
	});

	describe("toUint32View", () => {
		it("should create Uint32Array view", () => {
			const buffer = new Uint8Array([1, 0, 0, 0, 2, 0, 0, 0]);
			const view = toUint32View(buffer);
			expect(view.length).toBe(2);
			expect(view[0]).toBe(1);
			expect(view[1]).toBe(2);
		});

		it("should throw on non-aligned buffer", () => {
			const buffer = new Uint8Array([1, 2, 3]);
			expect(() => toUint32View(buffer)).toThrow();
		});
	});

	describe("BufferPool", () => {
		it("should acquire new buffer", () => {
			const pool = new BufferPool(16);
			const buffer = pool.acquire();
			expect(buffer.length).toBe(16);
		});

		it("should reuse released buffer", () => {
			const pool = new BufferPool(16);
			const buffer1 = pool.acquire();
			pool.release(buffer1);
			const buffer2 = pool.acquire();
			expect(buffer2).toBe(buffer1); // Same reference
		});

		it("should respect max pool size", () => {
			const pool = new BufferPool(16, 2);
			const b1 = pool.acquire();
			const b2 = pool.acquire();
			const b3 = pool.acquire();

			pool.release(b1);
			pool.release(b2);
			pool.release(b3); // Should be dropped (exceeds max)

			const r1 = pool.acquire();
			const r2 = pool.acquire();
			const r3 = pool.acquire();

			expect(r1 === b2 || r1 === b1).toBe(true);
			expect(r2 === b2 || r2 === b1).toBe(true);
			expect(r3).not.toBe(b3); // b3 was dropped, so r3 is new
		});

		it("should clear pool", () => {
			const pool = new BufferPool(16);
			const buffer = pool.acquire();
			pool.release(buffer);
			pool.clear();

			const newBuffer = pool.acquire();
			expect(newBuffer).not.toBe(buffer); // New allocation
		});
	});
});
