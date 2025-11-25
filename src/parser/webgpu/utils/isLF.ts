/**
 * Checks if a byte is a line feed (LF, \n)
 *
 * @param byte - Byte value to check
 * @returns true if byte is LF
 */
export function isLF(byte: number): boolean {
  return byte === 0x0a;
}
