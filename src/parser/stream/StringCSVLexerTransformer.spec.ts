import fc from "fast-check";
import { describe as describe_, expect, it as it_ } from "vitest";
import { autoChunk, FC, transform } from "@/__tests__/helper.ts";
import { Delimiter } from "@/core/constants.ts";
import { FlexibleStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";
import { StringCSVLexerTransformer } from "@/parser/stream/StringCSVLexerTransformer.ts";
import { escapeField } from "@/utils/serialization/escapeField.ts";

const describe = describe_.concurrent;
const it = it_.concurrent;

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

describe("StringCSVLexerTransformer", () => {
  it("should be a TransformStream", () => {
    const lexer = new FlexibleStringCSVLexer({});
    expect(new StringCSVLexerTransformer(lexer)).toBeInstanceOf(
      TransformStream,
    );
  });

  it("should separate fields by commas by default", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const row = g(FC.row);
          const quote = g(FC.quote);
          const chunks = autoChunk(
            g,
            row.map((v) => escapeField(v, { quote })).join(","),
          );
          // In unified token format, each token represents a field with its following delimiter
          const expected = row
            .map((value, index) => ({
              value: quote || value ? value : "",
              next: index === row.length - 1 ? Delimiter.EOF : Delimiter.Field,
              length: expect.any(Number),
              location: LOCATION_SHAPE,
            }))
            .filter(
              (token) =>
                !(
                  token.value === "" &&
                  token.next === Delimiter.EOF &&
                  row.length === 1 &&
                  !row[0]
                ),
            );
          return { row, chunks, expected };
        }),
        async ({ chunks, expected }) => {
          const lexer = new FlexibleStringCSVLexer({});
          const transformer = new StringCSVLexerTransformer(lexer);
          const actual = (await transform(transformer, chunks)).flat();
          expect(actual).toMatchObject(expected);
        },
      ),
    );
  });

  it("should treat the field enclosures as double quotes by default", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const row = g(FC.row);
          const chunks = autoChunk(
            g,
            row.map((v) => escapeField(v, { quote: true })).join(","),
          );
          // In unified token format, each token represents a field with its following delimiter
          const expected = row.map((value, index) => ({
            value,
            next: index === row.length - 1 ? Delimiter.EOF : Delimiter.Field,
            length: expect.any(Number),
            location: LOCATION_SHAPE,
          }));
          return { expected, chunks };
        }),
        async ({ expected, chunks }) => {
          const lexer = new FlexibleStringCSVLexer({});
          const transformer = new StringCSVLexerTransformer(lexer);
          const actual = (await transform(transformer, chunks)).flat();
          expect(actual).toMatchObject(expected);
        },
      ),
    );
  });

  it("should parse csv with user options", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const options = g(FC.commonOptions);
          const quote = g(FC.quote);
          const data = g(FC.csvData, {
            fieldConstraints: { minLength: 1 },
            rowsConstraints: { minLength: 1 },
            columnsConstraints: { minLength: 1 },
          });
          const eol = g(FC.eol);
          const EOF = g(fc.boolean);
          const csv =
            data
              .map((row) =>
                row
                  .map((value) => escapeField(value, { quote, ...options }))
                  .join(options.delimiter),
              )
              .join(eol) + (EOF ? eol : "");
          const chunks = autoChunk(g, csv);
          // In unified token format, each token represents a field with its following delimiter
          const expected: { value: string; next?: Delimiter }[] = [];
          for (let i = 0; i < data.length; i++) {
            const row = data[i]!;
            for (let j = 0; j < row.length; j++) {
              const value = row[j]!;
              const isLastFieldInRow = j === row.length - 1;
              const isLastRow = i === data.length - 1;

              // Only add token if field is non-empty or quoted
              if (quote || value !== "") {
                expected.push({
                  value,
                  next: isLastFieldInRow
                    ? isLastRow && !EOF
                      ? Delimiter.EOF
                      : Delimiter.Record
                    : Delimiter.Field,
                });
              }
            }
          }
          return { options, chunks, expected };
        }),
        async ({ options, chunks, expected }) => {
          const lexer = new FlexibleStringCSVLexer(options);
          const transformer = new StringCSVLexerTransformer(lexer);
          const actual = (await transform(transformer, chunks)).flat();
          expect(actual).toMatchObject(expected);
        },
      ),
      {
        examples: [
          [
            // only EOL is ignored
            {
              options: { delimiter: ",", quotation: '"' } as any,
              chunks: ["\n"],
              expected: [],
            },
          ],
        ],
      },
    );
  });
});
