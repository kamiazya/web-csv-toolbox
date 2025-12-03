import { DEFAULT_BINARY_MAX_SIZE } from "@/core/constants.ts";

/**
 * Validates binary size against maxBinarySize limit.
 *
 * @param binary - The binary data to validate.
 * @param maxBinarySize - The maximum allowed binary size (optional, defaults to DEFAULT_BINARY_MAX_SIZE).
 * @throws {RangeError} If maxBinarySize is invalid or if binary size exceeds the limit.
 */
export function validateBinarySize(
  binary: BufferSource,
  maxBinarySize?: number,
): void {
  const limit = maxBinarySize ?? DEFAULT_BINARY_MAX_SIZE;

  // Validate maxBinarySize parameter
  if (
    !(Number.isFinite(limit) || limit === Number.POSITIVE_INFINITY) ||
    (Number.isFinite(limit) && limit < 0)
  ) {
    throw new RangeError(
      "maxBinarySize must be a non-negative number or Number.POSITIVE_INFINITY",
    );
  }

  // Check binary size against limit
  if (Number.isFinite(limit) && binary.byteLength > limit) {
    throw new RangeError(
      `Binary size (${binary.byteLength} bytes) exceeded maximum allowed size of ${limit} bytes`,
    );
  }
}
