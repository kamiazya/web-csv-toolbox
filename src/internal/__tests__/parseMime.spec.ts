import { describe, expect, it } from "vitest";
import { parseMime } from "../parseMime.js";

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
});
