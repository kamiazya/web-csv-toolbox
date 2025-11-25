/**
 * Checks if a byte is a carriage return (CR, \r)
 *
 * @param byte - Byte value to check
 * @returns true if byte is CR
 */
export function isCR(byte: number): boolean {
  return byte === 0x0d;
}
