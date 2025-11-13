import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { COMMA, CR, CRLF, DOUBLE_QUOTE, LF } from "../../core/constants.ts";
import { FC } from "./__tests__/helper.ts";
import { assertCommonOptions } from "./assertCommonOptions.ts";

describe("function assertCommonOptions", () => {
  it("should throw an error if quotation is an empty character", () => {
    expect(() =>
      assertCommonOptions({
        quotation: "",
        delimiter: DOUBLE_QUOTE,
        maxBufferSize: 1024,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: quotation must not be empty]`,
    );
  });

  it("should throw an error if delimiter is an empty character", () => {
    expect(() =>
      assertCommonOptions({
        quotation: COMMA,
        delimiter: "",
        maxBufferSize: 1024,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: delimiter must not be empty]`,
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
            assertCommonOptions({
              quotation: value,
              delimiter: value,
              maxBufferSize: 1024,
            }),
          ).toThrowErrorMatchingInlineSnapshot(
            `[RangeError: delimiter must not be the same as quotation, use different characters]`,
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
          maxBufferSize: 1024,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[RangeError: quotation must not include CR or LF]`,
      );
    }
    for (const delimiter of [CR, LF]) {
      expect(() =>
        assertCommonOptions({
          quotation: COMMA,
          delimiter: delimiter,
          maxBufferSize: 1024,
        }),
      ).toThrowErrorMatchingInlineSnapshot(
        `[RangeError: delimiter must not include CR or LF]`,
      );
    }
  });

  it("should throw an error if quotation is not a string", () => {
    expect(() =>
      assertCommonOptions({
        quotation: 1 as unknown as string,
        delimiter: DOUBLE_QUOTE,
        maxBufferSize: 1024,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: quotation must be a string]`,
    );
  });

  it("should throw an error if delimiter is not a string", () => {
    expect(() =>
      assertCommonOptions({
        quotation: COMMA,
        delimiter: 1 as unknown as string,
        maxBufferSize: 1024,
      }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: delimiter must be a string]`,
    );
  });

  it("should throw an error if maxBufferSize is invalid", () => {
    // Test negative value
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: -1,
      }),
    ).toThrow(RangeError);

    // Test zero
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: 0,
      }),
    ).toThrow(RangeError);

    // Test non-integer
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: 1.5,
      }),
    ).toThrow(RangeError);

    // Test NaN
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: Number.NaN,
      }),
    ).toThrow(RangeError);
  });

  it("should accept Number.POSITIVE_INFINITY as maxBufferSize to disable limit", () => {
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: Number.POSITIVE_INFINITY,
      }),
    ).not.toThrow();
  });
});
