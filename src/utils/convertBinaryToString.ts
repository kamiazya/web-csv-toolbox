import type { BinaryOptions } from "../common/types.ts";

/**
 * Converts a binary string to a string.
 *
 * @param binary - The binary string to convert.
 * @param options - The options for parsing the binary string.
 * @returns The converted string.
 * @throws {RangeError} The given charset is not supported.
 * @throws {TypeError} The encoded data was not valid.
 */
export function convertBinaryToString(
  binary: Uint8Array | ArrayBuffer,
  options: BinaryOptions,
): string {
  return new TextDecoder(options?.charset, {
    ignoreBOM: options?.ignoreBOM,
    fatal: options?.fatal,
  }).decode(binary instanceof ArrayBuffer ? new Uint8Array(binary) : binary);
}
