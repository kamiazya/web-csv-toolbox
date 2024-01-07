import { fc } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";
import { FC } from "../../__tests__/helper";
import { assertCommonOptions } from "../assertCommonOptions";
import { COMMA, CRLF, DOUBLE_QUATE } from "../constants";
describe("function assertCommonOptions", () => {
  it("should be throw error if quotation is a empty character", () => {
    expect(() =>
      assertCommonOptions({
        quotation: "",
        demiliter: DOUBLE_QUATE,
      }),
    ).toThrow("quotation must not be empty");
  });

  it("should be throw error if demiliter is a empty character", () => {
    expect(() =>
      assertCommonOptions({
        quotation: COMMA,
        demiliter: "",
      }),
    ).toThrow("demiliter must not be empty");
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
              demiliter: DOUBLE_QUATE,
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

  it("should be throw error if demiliter and quotation include each other as a substring", () =>
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
            assertCommonOptions({ quotation: A, demiliter: B }),
          ).toThrow(
            "demiliter and quotation must not include each other as a substring",
          );
          expect(() =>
            assertCommonOptions({ quotation: B, demiliter: A }),
          ).toThrow(
            "demiliter and quotation must not include each other as a substring",
          );
        },
      ),
    ));
});
