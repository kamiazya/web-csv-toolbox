/**
 * Utility functions for working with packed separator indices
 *
 * Separators are packed into u32 values with the following format:
 * - Bit 0-30: Byte offset (supports up to 2GB chunks)
 * - Bit 31 (MSB): Separator type (0: comma, 1: line feed)
 */

import type { Separator } from "../core/types.ts";
import { SEP_TYPE_COMMA, SEP_TYPE_LF } from "../core/types.ts";

const TYPE_MASK = 0x80000000; // Bit 31
const OFFSET_MASK = 0x7fffffff; // Bits 0-30

/**
 * Unpacks a separator from its packed u32 representation
 *
 * @param packed - Packed u32 value containing offset and type
 * @returns Unpacked separator with offset and type
 *
 * @example
 * ```ts
 * const packed = 0x80000042; // LF at offset 66
 * const sep = unpackSeparator(packed);
 * console.log(sep); // { offset: 66, type: 1 }
 * ```
 */
export function unpackSeparator(packed: number): Separator {
	const offset = packed & OFFSET_MASK;
	const type = (packed & TYPE_MASK) >>> 31;
	return { offset, type: type as typeof SEP_TYPE_COMMA | typeof SEP_TYPE_LF };
}

/**
 * Packs a separator into u32 representation
 *
 * @param offset - Byte offset of the separator
 * @param type - Separator type (0: comma, 1: LF)
 * @returns Packed u32 value
 *
 * @example
 * ```ts
 * const packed = packSeparator(66, SEP_TYPE_LF);
 * console.log(packed.toString(16)); // "80000042"
 * ```
 */
export function packSeparator(
	offset: number,
	type: typeof SEP_TYPE_COMMA | typeof SEP_TYPE_LF,
): number {
	return offset | (type << 31);
}

/**
 * Checks if a separator is a comma
 *
 * @param sep - Separator to check
 * @returns true if the separator is a comma
 */
export function isComma(sep: Separator): boolean {
	return sep.type === SEP_TYPE_COMMA;
}

/**
 * Checks if a separator is a line feed
 *
 * @param sep - Separator to check
 * @returns true if the separator is a line feed
 */
export function isLineFeed(sep: Separator): boolean {
	return sep.type === SEP_TYPE_LF;
}

/**
 * Finds the index of the last line feed in a separator array
 *
 * @param sepIndices - Array of packed separator indices
 * @param count - Number of valid separators in the array
 * @returns Index of the last LF, or -1 if not found
 *
 * @example
 * ```ts
 * const indices = new Uint32Array([
 *   packSeparator(10, SEP_TYPE_COMMA),
 *   packSeparator(20, SEP_TYPE_LF),
 *   packSeparator(30, SEP_TYPE_COMMA),
 * ]);
 * const lastLF = findLastLineFeed(indices, 3);
 * console.log(lastLF); // 1
 * ```
 */
export function findLastLineFeed(
	sepIndices: Uint32Array,
	count: number,
): number {
	for (let i = count - 1; i >= 0; i--) {
		const packed = sepIndices[i];
		if ((packed & TYPE_MASK) !== 0) {
			return i;
		}
	}
	return -1;
}

/**
 * Extracts the byte offset where the last complete record ends
 *
 * @param sepIndices - Array of packed separator indices
 * @param count - Number of valid separators
 * @returns Byte offset after the last LF, or 0 if no LF found
 */
export function getProcessedBytesCount(
	sepIndices: Uint32Array,
	count: number,
): number {
	const lastLFIndex = findLastLineFeed(sepIndices, count);
	if (lastLFIndex === -1) {
		return 0;
	}
	const lastLF = unpackSeparator(sepIndices[lastLFIndex]);
	return lastLF.offset + 1; // +1 to include the LF itself
}

/**
 * Filters separators up to and including the last line feed
 *
 * @param sepIndices - Array of packed separator indices
 * @param count - Number of valid separators
 * @returns Array of unpacked separators up to last LF
 */
export function getValidSeparators(
	sepIndices: Uint32Array,
	count: number,
): Separator[] {
	const lastLFIndex = findLastLineFeed(sepIndices, count);
	if (lastLFIndex === -1) {
		return [];
	}

	const result: Separator[] = [];
	for (let i = 0; i <= lastLFIndex; i++) {
		result.push(unpackSeparator(sepIndices[i]));
	}
	return result;
}
