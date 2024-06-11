import { describe, expect, it } from "vitest";
import { InvalidOptionError, ParseError } from "./errors";

describe("InvalidOptionError", () => {
  it("should be an instance of Error", () => {
    // The InvalidOptionError class should be an instance of Error.
    expect(new InvalidOptionError()).toBeInstanceOf(Error);
  });

  it("should have a name property", () => {
    // The InvalidOptionError class should have
    // a name property equal to "InvalidOptionError".
    expect(new InvalidOptionError().name).toStrictEqual("InvalidOptionError");
  });

  it("should have a message property", () => {
    // The InvalidOptionError class should have
    // a message property equal to empty string.
    expect(new InvalidOptionError().message).toStrictEqual("");

    // The InvalidOptionError class should have
    // a message property equal to the provided value.
    expect(new InvalidOptionError("message").message).toStrictEqual("message");
  });

  it("should have a cause property", () => {
    // The InvalidOptionError class should have
    // a cause property equal to undefined.
    expect(new InvalidOptionError().cause).toBeUndefined();

    // The InvalidOptionError class should have
    // a cause property equal to the provided value.
    expect(
      new InvalidOptionError("", { cause: new Error() }).cause,
    ).toStrictEqual(new Error());
  });
});

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
});
