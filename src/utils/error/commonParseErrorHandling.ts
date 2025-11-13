import { ParseError } from "../../core/errors.ts";

/**
 * Common error handling for parsing CSV data.
 *
 * @param error - The error to handle.
 * @throws {ParseError} When an error occurs while parsing the CSV data.
 * @throws {RangeError} When an invalid option is provided.
 * @throws {TypeError} When an invalid option is provided.
 */

export function commonParseErrorHandling(error: unknown): never {
  if (
    error instanceof ParseError ||
    error instanceof RangeError ||
    error instanceof TypeError
  ) {
    throw error;
  }
  throw new ParseError("An error occurred while parsing the CSV data.", {
    cause: error,
  });
}
