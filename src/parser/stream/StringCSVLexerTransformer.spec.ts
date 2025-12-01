import fc from "fast-check";
import { describe as describe_, expect, it as it_ } from "vitest";
import { autoChunk, FC, transform } from "@/__tests__/helper.ts";
import type { TokenNoLocation } from "@/common";
import { Delimiter } from "@/core/constants.ts";
import { FlexibleStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";
import { StringCSVLexerTransformer } from "@/parser/stream/StringCSVLexerTransformer.ts";
import { escapeField } from "@/utils/serialization/escapeField.ts";

const describe = describe_;
const it = it_;

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
          const csv = row.map((v) => escapeField(v, { quote })).join(",");
          const chunks = csv.length === 0 ? [""] : autoChunk(g, csv);
          // In unified token format, each token represents a field with its following delimiter
          const expected: TokenNoLocation[] = row.map((value, index) => ({
            value,
            delimiter:
              index === row.length - 1 ? Delimiter.Record : Delimiter.Field,
            delimiterLength: expect.any(Number),
          }));
          return { row, chunks, expected };
        }),
        async ({ chunks, expected }) => {
          const lexer = new FlexibleStringCSVLexer({});
          const transformer = new StringCSVLexerTransformer(lexer);
          const actual = (await transform(transformer, chunks)).flat();
          expect(actual).toMatchObject(expected);
        },
      ),
      { numRuns: 10 }, // Reduce runs to debug
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
          const expected: TokenNoLocation[] = row.map((value, index) => ({
            value,
            delimiter:
              index === row.length - 1 ? Delimiter.Record : Delimiter.Field,
            delimiterLength: expect.any(Number),
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
      { numRuns: 10 },
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
          const expected: TokenNoLocation[] = [];
          for (let i = 0; i < data.length; i++) {
            const row = data[i]!;
            for (let j = 0; j < row.length; j++) {
              const value = row[j]!;
              const isLastFieldInRow = j === row.length - 1;

              // Always add token for every field (including empty ones)
              expected.push({
                value,
                delimiter: isLastFieldInRow
                  ? Delimiter.Record
                  : Delimiter.Field,
                delimiterLength: expect.any(Number),
              });
            }
          }
          return { options, chunks, expected };
        }),
        async ({ options, chunks, expected }) => {
          const lexer = new FlexibleStringCSVLexer(options);
          const transformer = new StringCSVLexerTransformer(lexer);
          const actual = await transform(transformer, chunks);
          expect(actual).toMatchObject(expected);
        },
      ),
    );
  });
});
