import type { BinaryOptions } from "../common/types.ts";

/**
 * Default maximum binary size in bytes (100MB).
 */
const DEFAULT_MAX_BINARY_SIZE = 100 * 1024 * 1024;

/**
 * Converts a binary string to a string.
 *
 * @param binary - The binary string to convert.
 * @param options - The options for parsing the binary string.
 * @returns The converted string.
 * @throws {RangeError} The given charset is not supported or binary size exceeds the limit.
 * @throws {TypeError} The encoded data was not valid.
 */
export function convertBinaryToString(
  binary: Uint8Array | ArrayBuffer,
  options: BinaryOptions,
): string {
  const maxBinarySize = options?.maxBinarySize ?? DEFAULT_MAX_BINARY_SIZE;

  // Validate maxBinarySize
  if (
    !(Number.isFinite(maxBinarySize) || maxBinarySize === Number.POSITIVE_INFINITY) ||
    (Number.isFinite(maxBinarySize) && maxBinarySize < 0)
  ) {
    throw new RangeError(
      "maxBinarySize must be a non-negative number or Number.POSITIVE_INFINITY",
    );
  }

  // Check binary size
  if (Number.isFinite(maxBinarySize) && binary.byteLength > maxBinarySize) {
    throw new RangeError(
      `Binary size (${binary.byteLength} bytes) exceeded maximum allowed size of ${maxBinarySize} bytes`,
    );
  }

  return new TextDecoder(options?.charset, {
    ignoreBOM: options?.ignoreBOM,
    fatal: options?.fatal,
  }).decode(binary instanceof ArrayBuffer ? new Uint8Array(binary) : binary);
}
