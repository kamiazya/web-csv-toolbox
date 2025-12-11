/**
 * Concatenates two Uint8Arrays efficiently
 *
 * @param left - First array
 * @param right - Second array
 * @returns New array containing both arrays concatenated
 */
export function concatUint8Arrays(
  left: Uint8Array,
  right: Uint8Array,
): Uint8Array {
  if (left.length === 0) return right;
  if (right.length === 0) return left;

  const result = new Uint8Array(left.length + right.length);
  result.set(left, 0);
  result.set(right, left.length);
  return result;
}
