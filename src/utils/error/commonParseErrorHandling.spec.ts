import { describe, expect, it } from "vitest";
import { ParseError } from "../core/errors.ts";
import { commonParseErrorHandling } from "./commonParseErrorHandling.ts";

describe("function commonParseErrorHandling", () => {
  it("should throws ParseError for ParseError instance", () => {
    const error = new ParseError(
      "An error occurred while parsing the CSV data.",
    );
    expect(() => commonParseErrorHandling(error)).toThrowError(error);
  });

  it("should throws RangeError for RangeError instance", () => {
    const error = new RangeError("Invalid option provided.");
    expect(() => commonParseErrorHandling(error)).toThrowError(error);
  });

  it("should throws TypeError for TypeError instance", () => {
    const error = new TypeError("Invalid option provided.");
    expect(() => commonParseErrorHandling(error)).toThrowError(error);
  });

  it("should throws ParseError for unknown error", () => {
    const unknownError = new Error("Unknown error occurred.");
    expect(() => commonParseErrorHandling(unknownError)).toThrowError(
      ParseError,
    );
  });
});
