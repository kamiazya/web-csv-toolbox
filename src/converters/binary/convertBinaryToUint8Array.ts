/**
 * Convert a BufferSource to Uint8Array.
 *
 * This helper handles various binary input types:
 * - Uint8Array: returned as-is
 * - ArrayBuffer: wrapped in Uint8Array
 * - Other ArrayBufferViews (e.g., DataView, Int8Array): converted to Uint8Array
 *
 * @param binary - The BufferSource to convert
 * @returns A Uint8Array view of the binary data
 * @throws TypeError if input is not a valid BufferSource
 *
 * @example
 * ```ts
 * // Uint8Array passthrough
 * const bytes = new Uint8Array([1, 2, 3]);
 * convertBinaryToUint8Array(bytes) === bytes; // true
 *
 * // ArrayBuffer conversion
 * const buffer = new ArrayBuffer(8);
 * const view = convertBinaryToUint8Array(buffer);
 *
 * // DataView conversion
 * const dataView = new DataView(buffer);
 * const view2 = convertBinaryToUint8Array(dataView);
 * ```
 */
export function convertBinaryToUint8Array(binary: BufferSource): Uint8Array {
  if (binary instanceof Uint8Array) {
    return binary;
  }
  if (binary instanceof ArrayBuffer) {
    return new Uint8Array(binary);
  }
  if (ArrayBuffer.isView(binary)) {
    return new Uint8Array(binary.buffer, binary.byteOffset, binary.byteLength);
  }
  throw new TypeError("binary must be a BufferSource");
}
