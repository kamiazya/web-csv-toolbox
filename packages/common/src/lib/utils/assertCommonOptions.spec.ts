import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { FC } from "#/tests/utils/helper.ts";

import { COMMA, CR, CRLF, DOUBLE_QUOTE, LF } from "../constants.ts";
import { assertCommonOptions } from "./assertCommonOptions.ts";

describe("function assertCommonOptions", () => {
  it("should throw an error if quotation is an empty character", () => {
    expect(() =>
      assertCommonOptions({
        quotation: "",
        delimiter: DOUBLE_QUOTE,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[RangeError: quotation must not be empty]`,
    );
  });

  it("should throw an error if delimiter is an empty character", () => {
    expect(() =>
      assertCommonOptions({
        quotation: COMMA,
        delimiter: "",
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[RangeError: delimiter must not be empty]`,
    );
  });

  it("should throw an error if delimiter is the same as quotation", async () => {
    fc.assert(
      fc.property(
        FC.text({ minLength: 1, maxLength: 1, excludes: [...CRLF] }),
        (value) => {
          expect(() =>
            assertCommonOptions({ quotation: value, delimiter: value }),
          ).toThrowError(RangeError);
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
      ).toThrowError(RangeError);
    }
    for (const delimiter of [CR, LF]) {
      expect(() =>
        assertCommonOptions({
          quotation: COMMA,
          delimiter: delimiter,
        }),
      ).toThrowError(RangeError);
    }
  });

  it("should throw an error if quotation is not a string", () => {
    expect(() =>
      assertCommonOptions({
        quotation: 1 as unknown as string,
        delimiter: DOUBLE_QUOTE,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[TypeError: quotation must be a string]`,
    );
  });

  it("should throw an error if delimiter is not a string", () => {
    expect(() =>
      assertCommonOptions({
        quotation: COMMA,
        delimiter: 1 as unknown as string,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[TypeError: delimiter must be a string]`,
    );
  });
});
