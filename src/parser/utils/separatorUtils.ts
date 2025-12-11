import type { SeparatorType } from "../types/SeparatorIndexResult.ts";

/** Bit mask for separator type (bit 31) */
const TYPE_MASK = 0x80000000;

/**
 * Bit mask for offset (bits 0-29)
 *
 * Extended format uses:
 * - bits 0-29: offset (max 1GB)
 * - bit 30: isQuoted flag (1=quoted)
 * - bit 31: separator type (0=delimiter, 1=LF)
 */
const OFFSET_MASK = 0x3fffffff;

/**
 * Pack offset and separator type into a single u32 value
 * Format: offset | (type << 31)
 * @param offset - Byte or character offset (0-30 bits, max ~2GB)
 * @param type - Separator type: 0 = delimiter, 1 = LF
 * @returns Packed u32 value
 */
export function packSeparator(offset: number, type: SeparatorType): number {
  return (offset | (type << 31)) >>> 0;
}

/**
 * Unpack a packed separator value into offset and type
 * @param packed - Packed u32 value
 * @returns Object with offset and type
 */
export function unpackSeparator(packed: number): {
  offset: number;
  type: SeparatorType;
} {
  return {
    offset: packed & OFFSET_MASK,
    type: ((packed & TYPE_MASK) >>> 31) as SeparatorType,
  };
}

/**
 * Extract only the offset from a packed separator value
 * @param packed - Packed u32 value
 * @returns Offset value
 */
export function getOffset(packed: number): number {
  return packed & OFFSET_MASK;
}

/**
 * Extract only the type from a packed separator value
 * @param packed - Packed u32 value
 * @returns Separator type (0 = delimiter, 1 = LF)
 */
export function getType(packed: number): SeparatorType {
  return ((packed & TYPE_MASK) >>> 31) as SeparatorType;
}

/**
 * Check if a packed separator is a line feed
 * @param packed - Packed u32 value
 * @returns true if LF, false if delimiter
 */
export function isLineFeed(packed: number): boolean {
  return (packed & TYPE_MASK) !== 0;
}

/**
 * Find the number of bytes processed (up to and including the last LF)
 * This is used for streaming to determine the boundary for leftover data.
 * @param separators - Array of packed separator values
 * @param count - Number of valid separators in the array
 * @returns Number of bytes processed (offset of last LF + 1), or 0 if no LF found
 */
export function getProcessedBytesCount(
  separators: Uint32Array,
  count: number,
): number {
  // Find the last LF and return the next byte position
  for (let i = count - 1; i >= 0; i--) {
    const packed = separators[i]!;
    if ((packed & TYPE_MASK) !== 0) {
      return (packed & OFFSET_MASK) + 1;
    }
  }
  return 0;
}

/**
 * Concatenate two Uint8Arrays
 * @param a - First array
 * @param b - Second array
 * @returns New Uint8Array containing both arrays
 */
export function concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}
