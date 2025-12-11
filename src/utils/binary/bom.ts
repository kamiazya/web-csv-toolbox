/**
 * UTF-8 BOM (Byte Order Mark) utilities
 */

/**
 * UTF-8 BOM bytes: 0xEF, 0xBB, 0xBF
 */
export const UTF8_BOM = new Uint8Array([0xef, 0xbb, 0xbf]);

/**
 * Check if data starts with UTF-8 BOM
 *
 * @param data - The data to check
 * @returns true if the data starts with UTF-8 BOM
 */
export function hasBOM(data: Uint8Array): boolean {
  return (
    data.length >= 3 &&
    data[0] === UTF8_BOM[0] &&
    data[1] === UTF8_BOM[1] &&
    data[2] === UTF8_BOM[2]
  );
}

/**
 * Strip UTF-8 BOM from the beginning of a Uint8Array using subarray (zero-copy)
 *
 * @param data - The data to strip BOM from
 * @returns A view of the data without the BOM, or the original data if no BOM
 */
export function stripBOM(data: Uint8Array): Uint8Array {
  return hasBOM(data) ? data.subarray(3) : data;
}
