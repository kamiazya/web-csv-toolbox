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
    ).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[InvalidSettingError: quotation must not be empty]`,
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
      `[InvalidSettingError: delimiter must not be empty]`,
    );
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
          ).toThrowErrorMatchingInlineSnapshot(
            // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
            `[InvalidSettingError: delimiter must not be the same as quotation, use different characters]`,
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
      ).toThrowErrorMatchingInlineSnapshot(
        // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
        `[InvalidSettingError: quotation must not include CR or LF]`,
      );
    }
    for (const delimiter of [CR, LF]) {
      expect(() =>
        assertCommonOptions({
          quotation: COMMA,
          delimiter: delimiter,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
        `[InvalidSettingError: delimiter must not include CR or LF]`,
      );
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
