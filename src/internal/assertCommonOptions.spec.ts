import { fc } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";
import { FC } from "../__tests__/helper.js";
import { assertCommonOptions } from "./assertCommonOptions.js";
import { COMMA, CRLF, DOUBLE_QUATE } from "./constants.js";

describe("function assertCommonOptions", () => {
  it("should be throw error if quotation is a empty character", () => {
    expect(() =>
      assertCommonOptions({
        quotation: "",
        delimiter: DOUBLE_QUATE,
      }),
    ).toThrow("quotation must not be empty");
  });

  it("should be throw error if delimiter is a empty character", () => {
    expect(() =>
      assertCommonOptions({
        quotation: COMMA,
        delimiter: "",
      }),
    ).toThrow("delimiter must not be empty");
  });

  it("should be throw error if quotation includes CR or LF", () =>
    fc.assert(
      fc.property(
        fc.gen().map((g) => {
          const EOL = g(() => fc.constantFrom("\n", "\r"));
          const prefix = g(FC.text);
          const sufix = g(FC.text);
          return prefix + EOL + sufix;
        }),
        (invalidQuotation) => {
          expect(() =>
            assertCommonOptions({
              quotation: invalidQuotation,
              delimiter: DOUBLE_QUATE,
            }),
          ).toThrow("quotation must not include CR or LF");
        },
      ),
      {
        examples: [
          // "\n" is included
          ["\n"],
          // "\r" is included
          ["\r"],
          // "\n" and "\r" are included
          ["\n\r"],
        ],
      },
    ));

  it("should be throw error if delimiter and quotation include each other as a substring", () =>
    fc.assert(
      fc.property(
        fc.gen().map((g) => {
          const excludes = [...CRLF];
          const A = g(FC.text, { minLength: 1, excludes });
          // B is a string that includes A as a substring.
          const B = g(FC.text, { excludes }) + A + g(FC.text, { excludes });
          return { A, B };
        }),
        ({ A, B }) => {
          expect(() =>
            assertCommonOptions({ quotation: A, delimiter: B }),
          ).toThrow(
            "delimiter and quotation must not include each other as a substring",
          );
          expect(() =>
            assertCommonOptions({ quotation: B, delimiter: A }),
          ).toThrow(
            "delimiter and quotation must not include each other as a substring",
          );
        },
      ),
    ));
});
