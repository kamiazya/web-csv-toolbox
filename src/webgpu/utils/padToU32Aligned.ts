/**
 * Pads a Uint8Array to u32-aligned size
 */

import { alignToU32 } from "@/webgpu/utils/alignToU32.ts";

/**
 * Pads a Uint8Array to u32-aligned size
 *
 * @param bytes - Original byte array
 * @returns New array with padding (if needed) or original array
 */
export function padToU32Aligned(bytes: Uint8Array): Uint8Array {
  const aligned = alignToU32(bytes.length);
  if (aligned === bytes.length) {
    return bytes;
  }

  const padded = new Uint8Array(aligned);
  padded.set(bytes, 0);
  // Remaining bytes are zero-filled by default
  return padded;
}
