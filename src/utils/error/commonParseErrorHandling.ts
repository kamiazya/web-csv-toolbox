import { ParseError } from "@/core/errors";

/**
 * Common error handling for parsing CSV data.
 *
 * @param error - The error to handle.
 * @throws {ParseError} When an error occurs while parsing the CSV data.
 * @throws {RangeError} When an invalid option is provided.
 * @throws {TypeError} When an invalid option is provided.
 * @throws {DOMException} When an abort signal is triggered.
 */

export function commonParseErrorHandling(error: unknown): never {
  if (
    error instanceof ParseError ||
    error instanceof RangeError ||
    error instanceof TypeError ||
    (typeof DOMException !== "undefined" && error instanceof DOMException)
  ) {
    throw error;
  }
  throw new ParseError("An error occurred while parsing the CSV data.", {
    cause: error,
  });
}
