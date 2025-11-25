/**
 * Validates the maxFieldCount option.
 *
 * @param maxFieldCount - The maximum number of fields allowed per record.
 * @throws {RangeError} If maxFieldCount is not a positive integer or Infinity.
 *
 * @example
 * ```typescript
 * validateMaxFieldCount(100); // OK
 * validateMaxFieldCount(Number.POSITIVE_INFINITY); // OK
 * validateMaxFieldCount(0); // throws RangeError
 * validateMaxFieldCount(-1); // throws RangeError
 * validateMaxFieldCount(1.5); // throws RangeError
 * ```
 */
export function validateMaxFieldCount(maxFieldCount: number): void {
  if (
    !(
      Number.isFinite(maxFieldCount) ||
      maxFieldCount === Number.POSITIVE_INFINITY
    ) ||
    (Number.isFinite(maxFieldCount) &&
      (maxFieldCount < 1 || !Number.isInteger(maxFieldCount)))
  ) {
    throw new RangeError(
      "maxFieldCount must be a positive integer or Number.POSITIVE_INFINITY",
    );
  }
}
