import { describe, expect, test } from "vitest";
import { escapeField } from "./escape-field";

describe("escapeField function", () => {
  test("should throw error when quotation is empty", () => {
    expect(() =>
      escapeField("", {
        quotation: "",
      }),
    ).toThrowError("quotation must not be empty");
  });

  test("should throw error when demiliter is empty", () => {
    expect(() =>
      escapeField("", {
        demiliter: "",
      }),
    ).toThrowError("demiliter must not be empty");
  });

  test("should throw error when quotation includes demiliter", () => {
    expect(() =>
      escapeField("", {
        quotation: ",",
        demiliter: ",",
      }),
    ).toThrowError(
      "demiliter and quotation must not include each other as a substring",
    );
  });

  test("should throw error when demiliter includes quotation", () => {
    expect(() =>
      escapeField("", {
        quotation: ",",
        demiliter: ",",
      }),
    ).toThrowError(
      "demiliter and quotation must not include each other as a substring",
    );
  });

  test.only("should escape quotation", () => {
    expect(escapeField("aa")).toBe("aa");
    expect(escapeField('"')).toBe('""""');
    expect(escapeField("a\na")).toBe('"a\na"');
    expect(escapeField("a\na")).toBe('"a\na"');
    expect(escapeField("c21", { quotation: "c" })).toBe("ccc21c");
  });
});
