import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { autoChunk, FC } from "@/__tests__/helper.ts";
import { COMMA, Delimiter, DOUBLE_QUOTE } from "@/core/constants.ts";
import { FlexibleStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";
import { escapeField } from "@/utils/serialization/escapeField.ts";

// Note: We don't use trackLocation in spec tests for performance
// The unit tests verify location tracking works correctly

describe("class Lexer", () => {
  it("should lex with comma as a default field delimiter", () => {
    fc.assert(
      fc.property(
        fc.gen().map((g) => {
          const row = g(FC.row);
          const csv = row.map((field) => escapeField(field)).join(",");
          // In unified token format, each token represents a field with its following delimiter
          const expected = row
            .map((field, i) => ({
              value: field,
              delimiter: i === row.length - 1 ? Delimiter.EOF : Delimiter.Field,
              delimiterLength: expect.any(Number),
            }))
            // Filter out empty fields at the end with no following content
            .filter(
              (token) =>
                !(
                  token.value === "" &&
                  token.delimiter === Delimiter.EOF &&
                  row.length === 1 &&
                  !row[0]
                ),
            );
          return { csv, expected };
        }),
        ({ csv, expected }) => {
          const lexer = new FlexibleStringCSVLexer();
          const actual = [...lexer.lex(csv)];
          expect(actual).toMatchObject(expected);
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
          // In unified token format, each token represents a field with its following delimiter
          const expected = row.map((field, i) => ({
            value: field,
            next: i === row.length - 1 ? Delimiter.EOF : Delimiter.Field,
            length: expect.any(Number),
          }));
          return { csv, expected };
        }),
        ({ csv, expected }) => {
          const lexer = new FlexibleStringCSVLexer();
          const actual = [...lexer.lex(csv)];
          expect(actual).toMatchObject(expected);
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
          // In unified token format, each token represents a field with its following delimiter
          const expected = row
            .map((field, i) => ({
              value: field,
              delimiter: i === row.length - 1 ? Delimiter.EOF : Delimiter.Field,
              delimiterLength: expect.any(Number),
            }))
            .filter(
              (token, i) =>
                !(
                  token.value === "" &&
                  i === row.length - 1 &&
                  escapeField(row[i]!, { delimiter }) === row[i]
                ),
            );
          return { delimiter, csv, expected };
        }),
        ({ delimiter, csv, expected }) => {
          const lexer = new FlexibleStringCSVLexer({ delimiter });
          const actual = [...lexer.lex(csv)];
          expect(actual).toMatchObject(expected);
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
          // In unified token format, each token represents a field with its following delimiter
          const expected = row
            .map((field, i) => ({
              value: field,
              delimiter: i === row.length - 1 ? Delimiter.EOF : Delimiter.Field,
              delimiterLength: expect.any(Number),
            }))
            .filter(
              (token) =>
                !(
                  token.value === "" &&
                  token.delimiter === Delimiter.EOF &&
                  row.length === 1 &&
                  !row[0]
                ),
            );
          return { quotation, csv, expected };
        }),
        ({ quotation, csv, expected }) => {
          const lexer = new FlexibleStringCSVLexer({ quotation });
          const actual = [...lexer.lex(csv)];
          expect(actual).toMatchObject(expected);
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
          // In unified token format, each token represents a field with its following delimiter
          const expected = row
            .map((field, i) => ({
              value: field,
              delimiter: i === row.length - 1 ? Delimiter.EOF : Delimiter.Field,
              delimiterLength: expect.any(Number),
            }))
            .filter(
              (token, i) =>
                !(
                  token.value === "" &&
                  i === row.length - 1 &&
                  escapeField(row[i]!, options) === row[i]
                ),
            );
          return { options, row, csv, expected };
        }),
        ({ options, csv, expected }) => {
          const lexer = new FlexibleStringCSVLexer(options);
          const actual = [...lexer.lex(csv)];
          expect(actual).toMatchObject(expected);
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
          // In unified token format, each token represents a field with its following delimiter
          const expected: { value: string; delimiter?: Delimiter }[] = [];
          for (let i = 0; i < data.length; i++) {
            const row = data[i]!;
            for (let j = 0; j < row.length; j++) {
              const field = row[j]!;
              const isLastFieldInRow = j === row.length - 1;
              const isLastRow = i === data.length - 1;

              // Only add token if field is non-empty or quoted
              if (quote || field !== "") {
                expected.push({
                  value: field,
                  delimiter: isLastFieldInRow
                    ? isLastRow && !EOF
                      ? Delimiter.EOF
                      : Delimiter.Record
                    : Delimiter.Field,
                });
              }
            }
          }
          return { csv, data, options, expected };
        }),
        ({ options, csv, expected }) => {
          const lexer = new FlexibleStringCSVLexer(options);
          const actual = [...lexer.lex(csv)];
          expect(actual).toMatchObject(expected);
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
          const lexer1 = new FlexibleStringCSVLexer(options);
          const expected = [...lexer1.lex(csv)];

          // lexer2 is used to lex chunked data
          const lexer2 = new FlexibleStringCSVLexer(options);
          const actual = [
            // lex chunked data
            ...chunks.flatMap((chunk) => [
              ...lexer2.lex(chunk, { stream: true }),
            ]),
            // flush lexer2
            ...lexer2.lex(),
          ];
          expect(actual).toMatchObject(expected);
        },
      ),
    );
  });
});
