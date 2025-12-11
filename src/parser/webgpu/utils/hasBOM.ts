/**
 * Checks if a byte array starts with UTF-8 BOM
 */

const BOM_UTF8 = new Uint8Array([0xef, 0xbb, 0xbf]);

/**
 * Checks if a byte array starts with UTF-8 BOM
 *
 * @param bytes - Byte array to check
 * @returns true if the array starts with BOM
 */
export function hasBOM(bytes: Uint8Array): boolean {
  if (bytes.length < 3) return false;
  return (
    bytes[0] === BOM_UTF8[0] &&
    bytes[1] === BOM_UTF8[1] &&
    bytes[2] === BOM_UTF8[2]
  );
}
