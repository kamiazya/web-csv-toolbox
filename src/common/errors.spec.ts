import { describe, expect, it } from "vitest";
import { ParseError } from "./errors";

describe("ParseError", () => {
  it("should be an instance of Error", () => {
    // The ParseError class should be an instance of Error.
    expect(new ParseError()).toBeInstanceOf(Error);
  });

  it("should be an instance of SyntaxError", () => {
    // The ParseError class should be an instance of SyntaxError.
    expect(new ParseError()).toBeInstanceOf(SyntaxError);
  });

  it("should have a name property", () => {
    // The ParseError class should have
    // a name property equal to "ParseError".
    expect(new ParseError().name).toStrictEqual("ParseError");
  });

  it("should have a message property", () => {
    // The ParseError class should have
    // a message property equal to empty string.
    expect(new ParseError().message).toStrictEqual("");

    // The ParseError class should have a message property.
    expect(new ParseError("message").message).toStrictEqual("message");
  });

  it("should have a position property", () => {
    // The ParseError class should have
    // a position property equal to undefined.
    expect(new ParseError().position).toStrictEqual(undefined);

    // The ParseError class should have
    // a position property equal to the provided value.
    expect(
      new ParseError("", { position: { line: 1, column: 1, offset: 0 } })
        .position,
    ).toStrictEqual({ line: 1, column: 1, offset: 0 });
  });

  it("should have a cause property", () => {
    // The ParseError class should have
    // a cause property equal to undefined.
    expect(new ParseError().cause).toBeUndefined();

    // The ParseError class should have
    // a cause property equal to the provided value.
    expect(new ParseError("", { cause: new Error() }).cause).toStrictEqual(
      new Error(),
    );
  });

  it("should have a rowNumber property", () => {
    // The ParseError class should have
    // a rowNumber property equal to undefined.
    expect(new ParseError().rowNumber).toStrictEqual(undefined);

    // The ParseError class should have
    // a rowNumber property equal to the provided value.
    expect(new ParseError("", { rowNumber: 5 }).rowNumber).toStrictEqual(5);
  });

  it("should have a source property", () => {
    // The ParseError class should have
    // a source property equal to undefined.
    expect(new ParseError().source).toStrictEqual(undefined);

    // The ParseError class should have
    // a source property equal to the provided value.
    expect(
      new ParseError("", { source: "data.csv" }).source,
    ).toStrictEqual("data.csv");
  });

  it("should include all optional properties together", () => {
    const error = new ParseError("Test error", {
      position: { line: 2, column: 3, offset: 10 },
      rowNumber: 5,
      source: "test.csv",
      cause: new Error("Underlying cause"),
    });

    expect(error.message).toStrictEqual("Test error");
    expect(error.position).toStrictEqual({ line: 2, column: 3, offset: 10 });
    expect(error.rowNumber).toStrictEqual(5);
    expect(error.source).toStrictEqual("test.csv");
    expect(error.cause).toBeInstanceOf(Error);
  });
});
