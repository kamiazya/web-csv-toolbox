import { fc } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";
import { FC, autoChunk } from "../__tests__/helper.ts";
import { Field, FieldDelimiter, RecordDelimiter } from "../common/constants.ts";
import { Lexer } from "./Lexer.ts";
import { COMMA, DOUBLE_QUOTE } from "./constants.ts";
import { escapeField } from "./escapeField.ts";

describe("class Lexer", () => {
  it("should lex with comma as a default field delimiter", () => {
    fc.assert(
      fc.property(
        fc.gen().map((g) => {
          const row = g(FC.row);
          const csv = row.map((field) => escapeField(field)).join(",");
          const expected = [
            ...row.flatMap((field, i) => [
              // if field is empty, it should be ignored
              ...(field !== "" ? [{ type: Field, value: field }] : []),
              // if field is not last field, it should be followed by a field delimiter
              ...(row.length - 1 !== i ? [FieldDelimiter] : []),
            ]),
          ];
          return { csv, expected };
        }),
        ({ csv, expected }) => {
          const lexer = new Lexer();
          const actual = [...lexer.lex(csv)];
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
            .map((field) => escapeField(field, { quote: true, quotation: '"' }))
            .join(",");
          const expected = [
            ...row.flatMap((field, i) => [
              // field should be escaped with double quote,
              // so empty field should be escaped with double quote
              { type: Field, value: field },
              // if field is not last field, it should be followed by a field delimiter
              ...(row.length - 1 !== i ? [FieldDelimiter] : []),
            ]),
          ];
          return { csv, expected };
        }),
        ({ csv, expected }) => {
          const lexer = new Lexer();
          const actual = [...lexer.lex(csv)];
          expect(actual).toStrictEqual(expected);
        },
      ),
    );
  });

  it("should lex with with user given delimiter", () => {
    fc.assert(
      fc.property(
        fc.gen().map((g) => {
          const { delimiter } = g(FC.commonOptions, {
            quotation: DOUBLE_QUOTE,
          });

          const row = g(FC.row);
          const csv = row
            .map((field) => escapeField(field, { delimiter }))
            .join(delimiter);
          const expected = [
            ...row.flatMap((field, i) => [
              // if field is empty, it should be ignored
              ...(field !== "" ? [{ type: Field, value: field }] : []),
              // if field is not last field, it should be followed by a field delimiter
              ...(row.length - 1 !== i ? [FieldDelimiter] : []),
            ]),
          ];
          return { delimiter, csv, expected };
        }),
        ({ delimiter, csv, expected }) => {
          const lexer = new Lexer({ delimiter });
          const actual = [...lexer.lex(csv)];
          expect(actual).toStrictEqual(expected);
        },
      ),
    );
  });

  it("should lex with with user given quotation", () => {
    fc.assert(
      fc.property(
        fc.gen().map((g) => {
          const { quotation } = g(FC.commonOptions, { delimiter: COMMA });
          const row = g(FC.row);
          const csv = row
            .map((field) => escapeField(field, { quotation }))
            .join(",");
          const expected = [
            ...row.flatMap((field, i) => [
              // if field is empty, it should be ignored
              ...(field !== "" ? [{ type: Field, value: field }] : []),
              // if field is not last field, it should be followed by a field delimiter
              ...(row.length - 1 !== i ? [FieldDelimiter] : []),
            ]),
          ];
          return { quotation, csv, expected };
        }),
        ({ quotation, csv, expected }) => {
          const lexer = new Lexer({ quotation });
          const actual = [...lexer.lex(csv)];
          expect(actual).toStrictEqual(expected);
        },
      ),
    );
  });

  it("should lex with with user given quotation and delimiter", () => {
    fc.assert(
      fc.property(
        fc.gen().map((g) => {
          const options = g(FC.commonOptions);
          const row = g(FC.row);
          const csv = row
            .map((field) => escapeField(field, options))
            .join(options.delimiter);
          const expected = [
            ...row.flatMap((field, i) => [
              // if field is empty or field is escaped, it should be escaped.
              ...(field !== "" || escapeField(field, options) !== field
                ? [{ type: Field, value: field }]
                : []),
              // if field is not last field, it should be followed by a field delimiter
              ...(row.length - 1 !== i ? [FieldDelimiter] : []),
            ]),
          ];
          return { options, row, csv, expected };
        }),
        ({ options, csv, expected }) => {
          const lexer = new Lexer(options);
          const actual = [...lexer.lex(csv)];
          expect(actual).toStrictEqual(expected);
        },
      ),
    );
  });

  it("should detect record delimiter", () => {
    fc.assert(
      fc.property(
        fc.gen().map((g) => {
          const options = g(FC.commonOptions);
          const eol = g(FC.eol);
          const data = g(FC.csvData, {
            fieldConstraints: { minLength: 1 },
            rowsConstraints: { minLength: 1 },
            columnsConstraints: { minLength: 1 },
          });
          const EOF = g(fc.boolean);
          const quote = g(FC.quote);
          const csv =
            data
              .map((row) =>
                row
                  .map((field) => escapeField(field, { ...options, quote }))
                  .join(options.delimiter),
              )
              .join(eol) + (EOF ? eol : "");
          const expected = [
            ...data.flatMap((row, i) => [
              ...row.flatMap((field, j) => [
                // if quote is false and field is empty, it should be ignored
                ...(quote || field !== ""
                  ? [{ type: Field, value: field }]
                  : []),
                // if field is not last field, it should be followed by a field delimiter
                ...(row.length - 1 !== j ? [FieldDelimiter] : []),
              ]),
              // if row is not last row, it should be followed by a record delimiter.
              ...(data.length - 1 !== i ? [RecordDelimiter] : []),
            ]),
          ];
          return { csv, data, options, expected };
        }),
        ({ options, csv, expected }) => {
          const lexer = new Lexer(options);
          const actual = [...lexer.lex(csv)];
          expect(actual).toStrictEqual(expected);
        },
      ),
      {
        examples: [
          [
            {
              csv: "QfQQff0Qf0Qf",
              data: [["Q", "0"]],
              options: { delimiter: "f0", quotation: "Qf" },
              expected: [
                { type: Field, value: "Q" },
                FieldDelimiter,
                { type: Field, value: "0" },
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
          const quote = g(FC.quote);
          const csv =
            data
              .map((row) =>
                row
                  .map((field) => escapeField(field, { ...options, quote }))
                  .join(options.delimiter),
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
          const expected = [...lexer1.lex(csv)];

          // lexer2 is used to lex chunked data
          const lexer2 = new Lexer(options);
          const actual = [
            // lex chunked data
            ...chunks.flatMap((chunk) => [...lexer2.lex(chunk, true)]),
            // flush lexer2
            ...lexer2.flush(),
          ];
          expect(actual).toStrictEqual(expected);
        },
      ),
    );
  });
});
