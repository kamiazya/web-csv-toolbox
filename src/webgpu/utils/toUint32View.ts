/**
 * Creates a Uint32Array view of a Uint8Array for GPU transfer
 *
 * @param bytes - Input byte array (must be u32-aligned)
 * @returns Uint32Array view of the same buffer
 * @throws Error if bytes are not u32-aligned
 */
export function toUint32View(bytes: Uint8Array): Uint32Array {
  if (bytes.length % 4 !== 0) {
    throw new Error(
      `Buffer size ${bytes.length} is not u32-aligned. Use padToU32Aligned first.`,
    );
  }
  return new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
}
