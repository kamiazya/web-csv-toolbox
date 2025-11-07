import { describe, expect, it } from "vitest";
import { parseMime } from "./parseMime.ts";

describe("parseMime function", () => {
  it("should parse mime type", () => {
    const result = parseMime("text/csv");
    expect(result).toEqual({
      type: "text/csv",
      parameters: {},
    });
  });

  it("should parse mime type with parameters", () => {
    const result = parseMime("text/csv; charset=utf-8");
    expect(result).toEqual({
      type: "text/csv",
      parameters: {
        charset: "utf-8",
      },
    });
  });

  it("should parse mime type with multiple parameters", () => {
    const result = parseMime("text/csv; charset=utf-8; header=present");
    expect(result).toEqual({
      type: "text/csv",
      parameters: {
        charset: "utf-8",
        header: "present",
      },
    });
  });

  it("should parse mime type with spaces", () => {
    const result = parseMime("text/csv; charset = utf-8 ; header = present");
    expect(result).toEqual({
      type: "text/csv",
      parameters: {
        charset: "utf-8",
        header: "present",
      },
    });
  });

  it("should parse mime type with some parameters", () => {
    const result = parseMime(
      "text/csv; charset=utf-8; header=present; delimiter=,",
    );
    expect(result).toEqual({
      type: "text/csv",
      parameters: {
        charset: "utf-8",
        header: "present",
        delimiter: ",",
      },
    });
  });

  it("should throw TypeError for empty content type", () => {
    expect(() => parseMime("")).toThrow(TypeError);
    expect(() => parseMime("")).toThrow("Invalid content type");
  });

  it("should skip parameters without values", () => {
    const result = parseMime(
      "text/csv; charset=utf-8; invalid; header=present",
    );
    expect(result).toEqual({
      type: "text/csv",
      parameters: {
        charset: "utf-8",
        header: "present",
      },
    });
  });

  it("should skip parameters without keys", () => {
    const result = parseMime("text/csv; charset=utf-8; =value; header=present");
    expect(result).toEqual({
      type: "text/csv",
      parameters: {
        charset: "utf-8",
        header: "present",
      },
    });
  });
});
