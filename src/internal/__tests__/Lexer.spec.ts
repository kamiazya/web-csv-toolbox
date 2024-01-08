import { fc } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";
import { FC, autoChunk } from "../../__tests__/helper.js";
import { Field, FieldDelimiter, RecordDelimiter } from "../../common/index.js";
import { Lexer } from "../Lexer.js";
import { COMMA, DOUBLE_QUATE } from "../constants.js";
import { escapeField } from "../escapeField.js";

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
              ...(row.length - 1 !== i ? [{ type: FieldDelimiter }] : []),
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
            .map((field) => escapeField(field, { quate: true, quotation: '"' }))
            .join(",");
          const expected = [
            ...row.flatMap((field, i) => [
              // field should be escaped with double quote,
              // so empty field should be escaped with double quote
              { type: Field, value: field },
              // if field is not last field, it should be followed by a field delimiter
              ...(row.length - 1 !== i ? [{ type: FieldDelimiter }] : []),
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
            quotation: DOUBLE_QUATE,
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
              ...(row.length - 1 !== i ? [{ type: FieldDelimiter }] : []),
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
              ...(row.length - 1 !== i ? [{ type: FieldDelimiter }] : []),
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
              // if field is empty, it should be ignored
              ...(field !== "" ? [{ type: Field, value: field }] : []),
              // if field is not last field, it should be followed by a field delimiter
              ...(row.length - 1 !== i ? [{ type: FieldDelimiter }] : []),
            ]),
          ];
          return { options, csv, expected };
        }),
        ({ options, csv, expected }) => {
          const lexer = new Lexer(options);
          const actual = [...lexer.lex(csv)];
          expect(actual).toStrictEqual(expected);
        },
      ),
    );
  });

  it("should detect reccord delimiter", () => {
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
                  .join(options.delimiter),
              )
              .join(eol) + (EOF ? eol : "");
          const expected = [
            ...data.flatMap((row, i) => [
              ...row.flatMap((field, j) => [
                // if quate is false and field is empty, it should be ignored
                ...(quate || field !== ""
                  ? [{ type: Field, value: field }]
                  : []),
                // if field is not last field, it should be followed by a field delimiter
                ...(row.length - 1 !== j ? [{ type: FieldDelimiter }] : []),
              ]),
              // if row is not last row, it should be followed by a record delimiter.
              ...(data.length - 1 !== i ? [{ type: RecordDelimiter }] : []),
            ]),
            // if EOF line delimiter is present,
            // it should be followed by a record delimiter.
            ...(EOF ? [{ type: RecordDelimiter }] : []),
          ];
          return { csv, options, expected };
        }),
        ({ options, csv, expected }) => {
          const lexer = new Lexer(options);
          const actual = [...lexer.lex(csv)];
          expect(actual).toStrictEqual(expected);
        },
      ),
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
