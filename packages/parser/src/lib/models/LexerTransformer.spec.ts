import fc from "fast-check";
import { describe as describe_, expect, it as it_ } from "vitest";

import { FC, autoChunk, transform } from "#/tests/utils/helper";

import {
  Field,
  FieldDelimiter,
  RecordDelimiter,
  escapeField,
} from "@web-csv-toolbox/common";

import { LexerTransformer } from "./LexerTransformer.ts";

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

describe("LexerTransformer", () => {
  it("should be a TransformStream", () => {
    expect(new LexerTransformer()).toBeInstanceOf(TransformStream);
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
          const expected = [
            ...row.flatMap((value, index) => [
              // If the field is empty or quote is true, add a field.
              ...(quote || value
                ? [{ type: Field, value, location: LOCATION_SHAPE }]
                : []),
              // If the field is not the last field, add a field delimiter.
              ...(index === row.length - 1
                ? []
                : [
                    {
                      type: FieldDelimiter,
                      value: ",",
                      location: LOCATION_SHAPE,
                    },
                  ]),
            ]),
          ];
          return { row, chunks, expected };
        }),
        async ({ chunks, expected }) => {
          const lexer = new LexerTransformer();
          const actual = (await transform(lexer, chunks)).flat();
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
          const expected = [
            ...row.flatMap((value, index) => [
              { type: Field, value, location: LOCATION_SHAPE },
              ...(index === row.length - 1
                ? []
                : [
                    {
                      type: FieldDelimiter,
                      value: ",",
                      location: LOCATION_SHAPE,
                    },
                  ]),
            ]),
          ];
          return { expected, chunks };
        }),
        async ({ expected, chunks }) => {
          const lexer = new LexerTransformer();
          const actual = (await transform(lexer, chunks)).flat();
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
          const expected = [
            ...data.flatMap((row, i) => [
              // If row is empty, add a record delimiter.
              ...row.flatMap((value, j) => [
                // If the field is empty or quote is true, add a field.
                ...(quote || value !== "" ? [{ type: Field, value }] : []),
                // If the field is not the last field, add a field delimiter.
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
              // If the field is the last field, add a record delimiter.
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
          return { options, chunks, expected };
        }),
        async ({ options, chunks, expected }) => {
          const lexer = new LexerTransformer(options);
          const actual = (await transform(lexer, chunks)).flat();
          expect(actual).toMatchObject(expected);
        },
      ),
      {
        examples: [
          [
            // only EOL is ignored
            {
              options: { delimiter: ",", quotation: '"' },
              chunks: ["\n"],
              expected: [],
            },
          ],
        ],
      },
    );
  });
});
