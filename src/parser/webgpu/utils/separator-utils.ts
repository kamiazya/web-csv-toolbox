/**
 * Utility functions for working with packed separator indices
 *
 * Separators are packed into u32 values with the following format:
 * - Bit 0-30: Byte offset (supports up to 2GB chunks)
 * - Bit 31 (MSB): Separator type (0: comma, 1: line feed)
 */

import type { Separator } from "@/parser/webgpu/indexing/types.ts";
import { SEP_TYPE_COMMA, SEP_TYPE_LF } from "@/parser/webgpu/indexing/types.ts";

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
  // Use >>> 0 to convert to unsigned 32-bit integer
  // (1 << 31) in JavaScript is -2147483648 (signed), but we need 2147483648 (unsigned)
  return (offset | (type << 31)) >>> 0;
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
 * Sorts separator indices by byte offset (ascending)
 *
 * GPU workgroups execute in non-deterministic order, so separators
 * may not be written in offset order. This function sorts them.
 *
 * @param sepIndices - Array of packed separator indices
 * @param count - Number of valid separators in the array
 * @returns New sorted Uint32Array
 */
export function sortSeparatorsByOffset(
  sepIndices: Uint32Array,
  count: number,
): Uint32Array {
  // Extract valid separators and sort by offset
  const validSeps = sepIndices.slice(0, count);
  const sorted = new Uint32Array(validSeps);

  // Sort by offset (lower 31 bits)
  sorted.sort((a, b) => (a & OFFSET_MASK) - (b & OFFSET_MASK));

  return sorted;
}

/**
 * Finds the index of the last line feed in a separator array
 *
 * Note: This function assumes the array is already sorted by offset.
 * Use sortSeparatorsByOffset first if needed.
 *
 * @param sepIndices - Array of packed separator indices (must be sorted)
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
    const packed = sepIndices[i]!;
    if ((packed & TYPE_MASK) !== 0) {
      return i;
    }
  }
  return -1;
}

/**
 * Extracts the byte offset where the last complete record ends
 *
 * Note: This function sorts separators internally because GPU workgroups
 * may execute in non-deterministic order.
 *
 * @param sepIndices - Array of packed separator indices
 * @param count - Number of valid separators
 * @returns Byte offset after the last LF, or 0 if no LF found
 */
export function getProcessedBytesCount(
  sepIndices: Uint32Array,
  count: number,
): number {
  if (count === 0) {
    return 0;
  }

  // Sort separators by offset to ensure correct ordering
  const sorted = sortSeparatorsByOffset(sepIndices, count);

  const lastLFIndex = findLastLineFeed(sorted, count);
  if (lastLFIndex === -1) {
    return 0;
  }
  const lastLF = unpackSeparator(sorted[lastLFIndex]!);
  return lastLF.offset + 1; // +1 to include the LF itself
}

/**
 * Filters separators up to and including the last line feed
 *
 * Note: This function sorts separators internally because GPU workgroups
 * may execute in non-deterministic order.
 *
 * @param sepIndices - Array of packed separator indices
 * @param count - Number of valid separators
 * @returns Array of unpacked separators up to last LF (sorted by offset)
 */
export function getValidSeparators(
  sepIndices: Uint32Array,
  count: number,
): Separator[] {
  if (count === 0) {
    return [];
  }

  // Sort separators by offset to ensure correct ordering
  const sorted = sortSeparatorsByOffset(sepIndices, count);

  const lastLFIndex = findLastLineFeed(sorted, count);
  if (lastLFIndex === -1) {
    return [];
  }

  const result: Separator[] = [];
  for (let i = 0; i <= lastLFIndex; i++) {
    result.push(unpackSeparator(sorted[i]!));
  }
  return result;
}
