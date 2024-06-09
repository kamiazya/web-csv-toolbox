import { InvalidOptionError, ParseError } from "./common/errors";

/**
 * Common error handling for parsing CSV data.
 *
 * @param error - The error to handle.
 * @throws {ParseError} When an error occurs while parsing the CSV data.
 * @throws {InvalidOptionError} When an invalid option is provided.
 */

export function commonParseErrorHandling(error: unknown): never {
  if (error instanceof ParseError || error instanceof InvalidOptionError) {
    throw error;
  }
  throw new ParseError("An error occurred while parsing the CSV data.", {
    cause: error,
  });
}
