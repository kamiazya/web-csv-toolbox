/**
 * Decodes a byte range to a UTF-8 string
 */

/**
 * Shared TextDecoder instance to avoid repeated allocation
 * Reusing the decoder significantly improves performance when decoding
 * many small fields in large CSV files.
 */
const textDecoder = new TextDecoder("utf-8", { fatal: false });

/**
 * Decodes a byte range to a UTF-8 string
 *
 * @param bytes - Input byte array
 * @param start - Start offset (inclusive)
 * @param end - End offset (exclusive)
 * @returns Decoded string
 */
export function decodeUTF8(
  bytes: Uint8Array,
  start: number,
  end: number,
): string {
  return textDecoder.decode(bytes.subarray(start, end));
}
