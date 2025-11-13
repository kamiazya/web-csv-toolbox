import { DEFAULT_BINARY_MAX_SIZE } from "../../core/constants.ts";
import type { BinaryOptions } from "../../core/types.ts";

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
  const maxBinarySize = options?.maxBinarySize ?? DEFAULT_BINARY_MAX_SIZE;

  // Validate maxBinarySize
  if (
    !(
      Number.isFinite(maxBinarySize) ||
      maxBinarySize === Number.POSITIVE_INFINITY
    ) ||
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

  // Try to create TextDecoder with error handling for invalid charsets
  let decoder: TextDecoder;
  try {
    const decoderOptions: TextDecoderOptions = {};
    if (options?.ignoreBOM !== undefined)
      decoderOptions.ignoreBOM = options.ignoreBOM;
    if (options?.fatal !== undefined) decoderOptions.fatal = options.fatal;

    decoder = new TextDecoder(options?.charset, decoderOptions);
  } catch (error) {
    // If charset is invalid, provide clear error message
    if (error instanceof RangeError || error instanceof TypeError) {
      throw new RangeError(
        `Invalid or unsupported charset: "${options?.charset}". Please specify a valid charset or enable allowNonStandardCharsets option.`,
      );
    }
    throw error;
  }

  return decoder.decode(
    binary instanceof ArrayBuffer ? new Uint8Array(binary) : binary,
  );
}
