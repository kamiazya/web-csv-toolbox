import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CSVLexer } from "./CSVLexer.ts";
import { FC, autoChunk } from "./__tests__/helper.ts";
import { Field, FieldDelimiter, RecordDelimiter } from "./common/constants.ts";
import { COMMA, DOUBLE_QUOTE } from "./constants.ts";
import { escapeField } from "./escapeField.ts";

const LOCATION_SHAPE = {
  start: {
    line: expect.any(Number),
    column: expect.any(Number),
    offset: expect.any(Number),
  },
  end: {
    line: expect.any(Number),
    column: expect.any(Number),
    offset: expect.any(Number),
  },
  rowNumber: expect.any(Number),
};

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
              ...(field !== ""
                ? [{ type: Field, value: field, location: LOCATION_SHAPE }]
                : []),
              // if field is not last field, it should be followed by a field delimiter
              ...(row.length - 1 !== i
                ? [
                    {
                      type: FieldDelimiter,
                      value: COMMA,
                      location: LOCATION_SHAPE,
                    },
                  ]
                : []),
            ]),
          ];
          return { csv, expected };
        }),
        ({ csv, expected }) => {
          const lexer = new CSVLexer();
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
          const expected = [
            ...row.flatMap((field, i) => [
              // field should be escaped with double quote, so empty field should be
              // escaped with double quote
              { type: Field, value: field, location: LOCATION_SHAPE },
              // if field is not last field, it should be followed by a field delimiter
              ...(row.length - 1 !== i
                ? [
                    {
                      type: FieldDelimiter,
                      value: COMMA,
                      location: LOCATION_SHAPE,
                    },
                  ]
                : []),
            ]),
          ];
          return { csv, expected };
        }),
        ({ csv, expected }) => {
          const lexer = new CSVLexer();
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
          const expected = [
            ...row.flatMap((field, i) => [
              // if field is empty, it should be ignored
              ...(field !== "" || escapeField(field, { delimiter }) !== field
                ? [{ type: Field, value: field, location: LOCATION_SHAPE }]
                : []),
              // if field is not last field, it should be followed by a field delimiter
              ...(row.length - 1 !== i
                ? [
                    {
                      type: FieldDelimiter,
                      value: delimiter,
                      location: LOCATION_SHAPE,
                    },
                  ]
                : []),
            ]),
          ];
          return { delimiter, csv, expected };
        }),
        ({ delimiter, csv, expected }) => {
          const lexer = new CSVLexer({ delimiter });
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
          const expected = [
            ...row.flatMap((field, i) => [
              // if field is empty, it should be ignored
              ...(field !== ""
                ? [{ type: Field, value: field, location: LOCATION_SHAPE }]
                : []),
              // if field is not last field, it should be followed by a field delimiter
              ...(row.length - 1 !== i
                ? [
                    {
                      type: FieldDelimiter,
                      value: COMMA,
                      location: LOCATION_SHAPE,
                    },
                  ]
                : []),
            ]),
          ];
          return { quotation, csv, expected };
        }),
        ({ quotation, csv, expected }) => {
          const lexer = new CSVLexer({ quotation });
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
          const expected = [
            ...row.flatMap((field, i) => [
              // if field is empty or field is escaped, it should be escaped.
              ...(field !== "" || escapeField(field, options) !== field
                ? [{ type: Field, value: field, location: LOCATION_SHAPE }]
                : []),
              // if field is not last field, it should be followed by a field delimiter
              ...(row.length - 1 !== i
                ? [
                    {
                      type: FieldDelimiter,
                      value: options.delimiter,
                      location: LOCATION_SHAPE,
                    },
                  ]
                : []),
            ]),
          ];
          return { options, row, csv, expected };
        }),
        ({ options, csv, expected }) => {
          const lexer = new CSVLexer(options);
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
          const expected = [
            ...data.flatMap((row, i) => [
              ...row.flatMap((field, j) => [
                // if quote is false and field is empty, it should be ignored
                ...(quote || field !== ""
                  ? [{ type: Field, value: field }]
                  : []),
                // if field is not last field, it should be followed by a field delimiter
                ...(row.length - 1 !== j
                  ? [
                      {
                        type: FieldDelimiter,
                        value: options.delimiter,
                        location: LOCATION_SHAPE,
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
                      location: LOCATION_SHAPE,
                    },
                  ]
                : []),
            ]),
          ];
          return { csv, data, options, expected };
        }),
        ({ options, csv, expected }) => {
          const lexer = new CSVLexer(options);
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
          const lexer1 = new CSVLexer(options);
          const expected = [...lexer1.lex(csv)];

          // lexer2 is used to lex chunked data
          const lexer2 = new CSVLexer(options);
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

  describe("bufferCleanupThreshold option", () => {
    it("should work correctly when bufferCleanupThreshold is 0 (disabled)", () => {
      fc.assert(
        fc.property(
          fc.gen().map((g) => {
            const optionsBase = g(FC.commonOptions);
            const eol = g(FC.eol);
            const data = g(FC.csvData);
            const quote = g(FC.quote);

            const options = { ...optionsBase, bufferCleanupThreshold: 0 };
            const csv = data
              .map((row) =>
                row
                  .map((field) => escapeField(field, { ...options, quote }))
                  .join(options.delimiter),
              )
              .join(eol);

            return { options, csv };
          }),
          ({ options, csv }) => {
            // With threshold=0 (disabled), lexer should work correctly
            // and produce same results as with threshold enabled
            const lexerWithDisabled = new CSVLexer(options);
            const lexerWithEnabled = new CSVLexer({
              ...options,
              bufferCleanupThreshold: 4096,
            });

            const resultDisabled = [...lexerWithDisabled.lex(csv)];
            const resultEnabled = [...lexerWithEnabled.lex(csv)];

            // Results should be identical regardless of cleanup setting
            expect(resultDisabled).toMatchObject(resultEnabled);
          },
        ),
      );
    });

    it("should handle large data correctly with bufferCleanupThreshold=0", () => {
      // Create a CSV with large amount of data to ensure buffer cleanup
      // would normally be triggered multiple times
      const largeData = Array.from({ length: 1000 }, (_, i) =>
        Array.from({ length: 10 }, (_, j) => `field_${i}_${j}`).join(","),
      ).join("\n");

      const lexer = new CSVLexer({ bufferCleanupThreshold: 0 });
      const tokens = [...lexer.lex(largeData)];

      // Should successfully parse all data
      // Expected: 1000 rows * (10 fields + 9 delimiters) + 999 record delimiters = 19999 tokens
      expect(tokens.length).toBeGreaterThan(0);

      // Verify the last row is parsed correctly
      const lastRowTokens = tokens.slice(-19); // 10 fields + 9 delimiters
      const fields = lastRowTokens.filter((t) => t.type === Field);
      expect(fields[fields.length - 1]?.value).toBe("field_999_9");
    });
  });
});
