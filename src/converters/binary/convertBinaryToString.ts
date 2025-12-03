import type { BinaryOptions } from "@/core/types.ts";
import { validateBinarySize } from "@/utils/validation/validateBinarySize.ts";

/**
 * Converts binary data to a string.
 *
 * @param binary - The binary data to convert (BufferSource: Uint8Array, ArrayBuffer, or other TypedArray).
 * @param options - The options for parsing the binary data.
 * @returns The converted string.
 * @throws {RangeError} The given charset is not supported or binary size exceeds the limit.
 * @throws {TypeError} The encoded data was not valid.
 */
export function convertBinaryToString(
  binary: BufferSource,
  options: BinaryOptions,
): string {
  // Validate binary size
  validateBinarySize(binary, options?.maxBinarySize);

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

  return decoder.decode(binary);
}
