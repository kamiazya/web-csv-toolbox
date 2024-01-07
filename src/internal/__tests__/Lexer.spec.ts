import { fc } from "@fast-check/vitest";
import { describe, expect, it, vi } from "vitest";
import { FC, autoChunk } from "../../__tests__/helper.js";
import { Field, FieldDelimiter, RecordDelimiter } from "../../common/index.js";
import { Lexer } from "../Lexer.js";
import * as mod from "../assertCommonOptions.js";
import { COMMA, DOUBLE_QUATE } from "../constants.js";
import { escapeField } from "../escapeField.js";

describe("class Lexer", () => {
  it("should assert options with assertCommonOptions", () => {
    fc.assert(
      fc.property(FC.commonOptions(), (options) => {
        const spy = vi.spyOn(mod, "assertCommonOptions");
        new Lexer(options);
        expect(spy).toBeCalledTimes(1);
        expect(spy).toBeCalledWith(options);
      }),
    );
  });

  it("should lex with comma as a default field demiliter", () => {
    fc.assert(
      fc.property(
        fc.gen().map((g) => {
          const row = g(FC.row);
          const csv = row.map((field) => escapeField(field)).join(",");
          const expected = [
            ...row.flatMap((field, i) => [
              // if field is empty, it should be ignored
              ...(field !== ""
                ? [
                    {
                      type: Field,
                      value: field,
                    },
                  ]
                : []),
              // if field is not last field, it should be followed by a field delimiter
              ...(row.length - 1 !== i
                ? [
                    {
                      type: FieldDelimiter,
                      value: ",",
                    },
                  ]
                : []),
            ]),
          ];
          return { csv, expected };
        }),
        ({ csv, expected }) => {
          const lexer = new Lexer();
          const actual = lexer.lex(csv);
          expect(actual).toStrictEqual(expected);
        },
      ),
    );
  });

  it("should lex with double quote as a default field quotation", () => {
    fc.assert(
      fc.property(
        fc.gen().map((g) => {
          const row = g(FC.row);
          const csv = row
            // field should be escaped with double quote
            .map((field) => escapeField(field, { quate: true, quotation: '"' }))
            .join(",");
          const expected = [
            ...row.flatMap((field, i) => [
              // field should be escaped with double quote,
              // so empty field should be escaped with double quote
              {
                type: Field,
                value: field,
              },
              // if field is not last field, it should be followed by a field delimiter
              ...(row.length - 1 !== i
                ? [
                    {
                      type: FieldDelimiter,
                      value: ",",
                    },
                  ]
                : []),
            ]),
          ];
          return { csv, expected };
        }),
        ({ csv, expected }) => {
          const lexer = new Lexer();
          const actual = lexer.lex(csv);
          expect(actual).toStrictEqual(expected);
        },
      ),
    );
  });

  it("should lex with with user given demiliter", () => {
    fc.assert(
      fc.property(
        fc.gen().map((g) => {
          const { demiliter } = g(FC.commonOptions, {
            quotation: DOUBLE_QUATE,
          });

          const row = g(FC.row);
          const csv = row
            .map((field) => escapeField(field, { demiliter }))
            .join(demiliter);
          const expected = [
            ...row.flatMap((field, i) => [
              // if field is empty, it should be ignored
              ...(field !== ""
                ? [
                    {
                      type: Field,
                      value: field,
                    },
                  ]
                : []),
              // if field is not last field, it should be followed by a field delimiter
              ...(row.length - 1 !== i
                ? [
                    {
                      type: FieldDelimiter,
                      value: demiliter,
                    },
                  ]
                : []),
            ]),
          ];
          return { demiliter, csv, expected };
        }),
        ({ demiliter, csv, expected }) => {
          const lexer = new Lexer({ demiliter });
          const actual = lexer.lex(csv);
          expect(actual).toStrictEqual(expected);
        },
      ),
    );
  });

  it("should lex with with user given quotation", () => {
    fc.assert(
      fc.property(
        fc.gen().map((g) => {
          const { quotation } = g(FC.commonOptions, { demiliter: COMMA });
          const row = g(FC.row);
          const csv = row
            .map((field) => escapeField(field, { quotation }))
            .join(",");
          const expected = [
            ...row.flatMap((field, i) => [
              // if field is empty, it should be ignored
              ...(field !== ""
                ? [
                    {
                      type: Field,
                      value: field,
                    },
                  ]
                : []),
              // if field is not last field, it should be followed by a field delimiter
              ...(row.length - 1 !== i
                ? [
                    {
                      type: FieldDelimiter,
                      value: ",",
                    },
                  ]
                : []),
            ]),
          ];
          return { quotation, csv, expected };
        }),
        ({ quotation, csv, expected }) => {
          const lexer = new Lexer({ quotation });
          const actual = lexer.lex(csv);
          expect(actual).toStrictEqual(expected);
        },
      ),
    );
  });

  it("should lex with with user given quotation and demiliter", () => {
    fc.assert(
      fc.property(
        fc.gen().map((g) => {
          const options = g(FC.commonOptions);
          const row = g(FC.row);
          const csv = row
            .map((field) => escapeField(field, options))
            .join(options.demiliter);
          const expected = [
            ...row.flatMap((field, i) => [
              // if field is empty, it should be ignored
              ...(field !== ""
                ? [
                    {
                      type: Field,
                      value: field,
                    },
                  ]
                : []),
              // if field is not last field, it should be followed by a field delimiter
              ...(row.length - 1 !== i
                ? [
                    {
                      type: FieldDelimiter,
                      value: options.demiliter,
                    },
                  ]
                : []),
            ]),
          ];
          return { options, csv, expected };
        }),
        ({ options, csv, expected }) => {
          const lexer = new Lexer(options);
          const actual = lexer.lex(csv);
          expect(actual).toStrictEqual(expected);
        },
      ),
    );
  });

  it("should detect reccord demiliter", () => {
    fc.assert(
      fc.property(
        fc.gen().map((g) => {
          const options = g(FC.commonOptions);
          const eol = g(FC.eol);
          const data = g(FC.csvData);
          const EOF = g(fc.boolean);
          const quate = g(FC.quate);
          const csv =
            data
              .map((row) =>
                row
                  .map((field) => escapeField(field, { ...options, quate }))
                  .join(options.demiliter),
              )
              .join(eol) + (EOF ? eol : "");
          const expected = [
            ...data.flatMap((row, i) => [
              ...row.flatMap((field, j) => [
                // if quate is false and field is empty, it should be ignored
                ...(quate || field !== ""
                  ? [
                      {
                        type: Field,
                        value: field,
                      },
                    ]
                  : []),
                // if field is not last field, it should be followed by a field delimiter
                ...(row.length - 1 !== j
                  ? [
                      {
                        type: FieldDelimiter,
                        value: options.demiliter,
                      },
                    ]
                  : []),
              ]),
              // if row is not last row, it should be followed by a record delimiter.
              ...(data.length - 1 !== i
                ? [
                    {
                      type: RecordDelimiter,
                      value: eol,
                    },
                  ]
                : []),
            ]),
            // if EOF line demiliter is present,
            // it should be followed by a record delimiter.
            ...(EOF ? [{ type: RecordDelimiter, value: eol }] : []),
          ];
          return { csv, options, expected };
        }),
        ({ options, csv, expected }) => {
          const lexer = new Lexer(options);
          const actual = lexer.lex(csv);
          expect(actual).toStrictEqual(expected);
        },
      ),
      {
        examples: [
          [
            {
              options: { demiliter: COMMA, quotation: DOUBLE_QUATE },
              csv: "\n",
              expected: [{ type: RecordDelimiter, value: "\n" }],
            },
          ],
          [
            {
              options: { demiliter: COMMA, quotation: DOUBLE_QUATE },
              csv: "\r\n",
              expected: [{ type: RecordDelimiter, value: "\r\n" }],
            },
          ],
          [
            {
              csv: "a,b,c\n1,2,3",
              expected: [
                { type: Field, value: "a" },
                { type: FieldDelimiter, value: "," },
                { type: Field, value: "b" },
                { type: FieldDelimiter, value: "," },
                { type: Field, value: "c" },
                { type: RecordDelimiter, value: "\n" },
                { type: Field, value: "1" },
                { type: FieldDelimiter, value: "," },
                { type: Field, value: "2" },
                { type: FieldDelimiter, value: "," },
                { type: Field, value: "3" },
              ],
            },
          ],
        ],
      },
    );
  });

  it("it should be a same result when given one CSV at a time and when given chunked CSVs", () => {
    fc.assert(
      fc.property(
        fc.gen().map((g) => {
          const options = g(FC.commonOptions);
          const eol = g(FC.eol);
          const data = g(FC.csvData);
          const EOF = g(fc.boolean);
          const quate = g(FC.quate);
          const csv =
            data
              .map((row) =>
                row
                  .map((field) => escapeField(field, { ...options, quate }))
                  .join(options.demiliter),
              )
              .join(eol) + (EOF ? eol : "");
          const chunks = autoChunk(g, csv);
          return {
            csv,
            chunks,
            options,
          };
        }),
        ({ options, csv, chunks }) => {
          // lexer1 is used to compare with lexer2
          const lexer1 = new Lexer(options);
          const expected = lexer1.lex(csv);

          // lexer2 is used to lex chunked data
          const lexer2 = new Lexer(options);
          const actual = [
            // lex chunked data
            ...chunks.flatMap((chunk) => lexer2.lex(chunk, true)),
            // flush lexer2
            ...lexer2.flush(),
          ];
          expect(actual).toStrictEqual(expected);
        },
      ),
    );
  });
});
