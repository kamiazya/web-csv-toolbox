import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FC } from "@/__tests__/helper.ts";
import {
  COMMA,
  CR,
  CRLF,
  DEFAULT_MAX_FIELD_SIZE,
  DOUBLE_QUOTE,
  LF,
  MAX_FIELD_SIZE_LIMIT,
} from "@/core/constants.ts";
import { assertCommonOptions } from "@/utils/validation/assertCommonOptions.ts";

describe("function assertCommonOptions", () => {
  it("should throw an error if quotation is an empty character", () => {
    expect(() =>
      assertCommonOptions({
        quotation: "",
        delimiter: DOUBLE_QUOTE,
        maxBufferSize: 1024,
        maxFieldSize: DEFAULT_MAX_FIELD_SIZE,
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
        maxFieldSize: DEFAULT_MAX_FIELD_SIZE,
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
              maxFieldSize: DEFAULT_MAX_FIELD_SIZE,
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
          maxFieldSize: DEFAULT_MAX_FIELD_SIZE,
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
          maxFieldSize: DEFAULT_MAX_FIELD_SIZE,
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
        maxFieldSize: DEFAULT_MAX_FIELD_SIZE,
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
        maxFieldSize: DEFAULT_MAX_FIELD_SIZE,
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
        maxFieldSize: DEFAULT_MAX_FIELD_SIZE,
      }),
    ).toThrow(RangeError);

    // Test zero
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: 0,
        maxFieldSize: DEFAULT_MAX_FIELD_SIZE,
      }),
    ).toThrow(RangeError);

    // Test non-integer
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: 1.5,
        maxFieldSize: DEFAULT_MAX_FIELD_SIZE,
      }),
    ).toThrow(RangeError);

    // Test NaN
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: Number.NaN,
        maxFieldSize: DEFAULT_MAX_FIELD_SIZE,
      }),
    ).toThrow(RangeError);
  });

  it("should accept Number.POSITIVE_INFINITY as maxBufferSize to disable limit", () => {
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: Number.POSITIVE_INFINITY,
        maxFieldSize: DEFAULT_MAX_FIELD_SIZE,
      }),
    ).not.toThrow();
  });

  it("should throw an error if maxFieldSize is invalid", () => {
    // Test negative value
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: 1024,
        maxFieldSize: -1,
      }),
    ).toThrow(RangeError);

    // Test zero
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: 1024,
        maxFieldSize: 0,
      }),
    ).toThrow(RangeError);

    // Test non-integer
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: 1024,
        maxFieldSize: 1.5,
      }),
    ).toThrow(RangeError);

    // Test NaN
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: 1024,
        maxFieldSize: Number.NaN,
      }),
    ).toThrow(RangeError);

    // Test exceeding limit (1GB)
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: 1024,
        maxFieldSize: MAX_FIELD_SIZE_LIMIT + 1,
      }),
    ).toThrow(RangeError);

    // Test Number.POSITIVE_INFINITY (not allowed for maxFieldSize)
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: 1024,
        maxFieldSize: Number.POSITIVE_INFINITY,
      }),
    ).toThrow(RangeError);
  });

  it("should accept valid maxFieldSize values", () => {
    // Test minimum valid value
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: 1024,
        maxFieldSize: 1,
      }),
    ).not.toThrow();

    // Test maximum valid value (1GB)
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: 1024,
        maxFieldSize: MAX_FIELD_SIZE_LIMIT,
      }),
    ).not.toThrow();

    // Test typical value (1MB)
    expect(() =>
      assertCommonOptions({
        quotation: DOUBLE_QUOTE,
        delimiter: COMMA,
        maxBufferSize: 1024,
        maxFieldSize: 1024 * 1024,
      }),
    ).not.toThrow();
  });
});
