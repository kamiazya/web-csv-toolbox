/**
 * Aligns buffer size to u32 boundaries for GPU transfer
 *
 * WebGPU requires buffer sizes to be multiples of 4 bytes.
 *
 * @param size - Original size in bytes
 * @returns Aligned size (rounded up to nearest multiple of 4)
 */
export function alignToU32(size: number): number {
  return Math.ceil(size / 4) * 4;
}
