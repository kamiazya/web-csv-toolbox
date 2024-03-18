import { fc } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";
import { FC } from "./__tests__/helper.ts";
import { assertCommonOptions } from "./assertCommonOptions.ts";
import { COMMA, CR, CRLF, DOUBLE_QUOTE, LF } from "./constants.ts";

describe("function assertCommonOptions", () => {
  it("should throw an error if quotation is an empty character", () => {
    expect(() =>
      assertCommonOptions({
        quotation: "",
        delimiter: DOUBLE_QUOTE,
      }),
    ).toThrow("quotation must not be empty");
  });

  it("should throw an error if delimiter is an empty character", () => {
    expect(() =>
      assertCommonOptions({
        quotation: COMMA,
        delimiter: "",
      }),
    ).toThrow("delimiter must not be empty");
  });

  it("should throw an error if delimiter is the same as quotation", async () => {
    fc.assert(
      fc.property(
        FC.text({ minLength: 1, maxLength: 1, excludes: [...CRLF] }).filter(
          (v) => v.length === 1,
        ),
        (value) => {
          expect(() =>
            assertCommonOptions({ quotation: value, delimiter: value }),
          ).toThrow(
            "delimiter must not be the same as quotation, use different characters",
          );
        },
      ),
    );
  });

  it("should throw an error if quotation is CR or LF", () => {
    for (const quotation of [CR, LF]) {
      expect(() =>
        assertCommonOptions({
          quotation: quotation,
          delimiter: DOUBLE_QUOTE,
        }),
      ).toThrow("quotation must not include CR or LF");
    }
    for (const delimiter of [CR, LF]) {
      expect(() =>
        assertCommonOptions({
          quotation: COMMA,
          delimiter: delimiter,
        }),
      ).toThrow("delimiter must not include CR or LF");
    }
  });
});
