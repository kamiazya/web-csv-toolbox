import { describe, expect, it } from "vitest";
import { InvalidOptionError, ParseError } from "./common/errors";
import { commonParseErrorHandling } from "./commonParseErrorHandling";

describe("function commonParseErrorHandling", () => {
  it("should throws ParseError for ParseError instance", () => {
    const parseError = new ParseError(
      "An error occurred while parsing the CSV data.",
    );
    expect(() => commonParseErrorHandling(parseError)).toThrowError(parseError);
  });

  it("should throws InvalidOptionError for InvalidOptionError instance", () => {
    const invalidOptionError = new InvalidOptionError(
      "Invalid option provided.",
    );
    expect(() => commonParseErrorHandling(invalidOptionError)).toThrowError(
      invalidOptionError,
    );
  });

  it("should throws ParseError for unknown error", () => {
    const unknownError = new Error("Unknown error occurred.");
    expect(() => commonParseErrorHandling(unknownError)).toThrowError(
      ParseError,
    );
  });
});
