import { fc } from "@fast-check/vitest";
import { describe as describe_, expect, it as it_ } from "vitest";
import { FC, autoChunk, transform } from "../../__tests__/helper.js";
import { Field, FieldDelimiter, RecordDelimiter } from "../../common/index.js";
import { COMMA, DOUBLE_QUATE } from "../../internal/constants.js";
import { escapeField } from "../../internal/escapeField.js";
import { LexerTransformer } from "../LexerTransformer.js";

const describe = describe_.concurrent;
const it = it_.concurrent;

describe("LexerTransformer", () => {
  it("should be a TransformStream", () => {
    expect(new LexerTransformer()).toBeInstanceOf(TransformStream);
  });

  it("should be throw error if quotation is a empty character", () => {
    expect(() => new LexerTransformer({ quotation: "" })).toThrowError(
      "quotation must not be empty",
    );
  });

  it("should be throw error if demiliter is a empty character", () => {
    expect(() => new LexerTransformer({ demiliter: "" })).toThrowError(
      "demiliter must not be empty",
    );
  });

  it("should be throw error if quotation includes CR or LF", () =>
    fc.assert(
      fc.property(
        fc.gen().map((g) => {
          const EOL = g(() => fc.constantFrom("\n", "\r"));
          const prefix = g(FC.text);
          const sufix = g(FC.text);
          return `${prefix}${EOL}${sufix}`;
        }),
        (invalidQuotationWhatsIncludesEOL) => {
          expect(
            () =>
              new LexerTransformer({
                quotation: invalidQuotationWhatsIncludesEOL,
              }),
          ).toThrowError("quotation must not include CR or LF");
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
          const A = g(FC.text);
          // B is a string that includes A as a substring.
          const B = `${g(FC.text)}${A}${g(FC.text)}`;
          return { A, B };
        }),
        ({ A, B }) => {
          expect(
            () => new LexerTransformer({ quotation: A, demiliter: B }),
          ).toThrow(Error);
          expect(
            () => new LexerTransformer({ quotation: B, demiliter: A }),
          ).toThrow(Error);
        },
      ),
    ));

  it("should separate fields by commas by default", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const row = g(FC.row);
          const chunks = autoChunk(g, row.map((v) => escapeField(v)).join(","));
          return { row, chunks };
        }),
        async ({ row, chunks }) => {
          const lexer = new LexerTransformer();
          expect(lexer.demiliter).toBe(",");
          const actual = await transform(lexer, [...chunks]);
          expect(actual).toStrictEqual([
            ...row.flatMap((value, index) => [
              ...(value ? [{ type: Field, value }] : []),
              ...(index === row.length - 1
                ? []
                : [{ type: FieldDelimiter, value: "," }]),
            ]),
          ]);
        },
      ),
      {
        examples: [
          [
            // Simple case
            { row: ["a", "b", "c"], chunks: ["a,b,c"] },
          ],
          [
            // Has empty field
            { row: ["a", "", "c"], chunks: ["a,,c"] },
          ],
          [
            // Has escaped field
            { row: ['"', "\n"], chunks: ['"""","\n"'] },
          ],
        ],
      },
    ));

  it("should separate fields by if there is a user-specified demiliter", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const demiliter = g(FC.demiliter, { excludes: [DOUBLE_QUATE] });
          const row = g(FC.row);
          const chunks = autoChunk(
            g,
            row.map((v) => escapeField(v, { demiliter })).join(demiliter),
          );
          return { demiliter, row, chunks };
        }),
        async ({ demiliter, row, chunks }) => {
          const lexer = new LexerTransformer({ demiliter });
          expect(lexer.demiliter).toBe(demiliter);
          const actual = await transform(lexer, chunks);
          const expected = [
            ...row.flatMap((value, index) => [
              ...(value ? [{ type: Field, value }] : []),
              ...(index === row.length - 1
                ? []
                : [{ type: FieldDelimiter, value: demiliter }]),
            ]),
          ];
          expect(actual).toStrictEqual(expected);
        },
      ),
    ));

  it("should treat the field enclosures as double quotes by default", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const row = g(FC.row);
          const chunks = autoChunk(
            g,
            row.map((v) => escapeField(v, { quate: true })).join(","),
          );
          return {
            row,
            chunks,
          };
        }),
        async ({ row, chunks }) => {
          const lexer = new LexerTransformer();
          expect(lexer.quotation).toBe('"');

          const actual = await transform(lexer, chunks);
          const expected = [
            ...row.flatMap((value, index) => [
              { type: Field, value },
              ...(index === row.length - 1
                ? []
                : [{ type: FieldDelimiter, value: "," }]),
            ]),
          ];
          expect(actual).toStrictEqual(expected);
        },
      ),
    ));

  it("should be treated as a field enclosure if there is a user-specified field enclosure", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          // quotation is a string that does not include COMMA.
          const quotation = g(FC.quotation, { excludes: [COMMA] });
          const row = g(FC.row);

          const chunks = autoChunk(
            g,
            row
              .map((v) => escapeField(v, { quotation, quate: true }))
              .join(","),
          );

          return { quotation, row, chunks };
        }),
        async ({ quotation, row, chunks }) => {
          const lexer = new LexerTransformer({ quotation });
          expect(lexer.quotation).toBe(quotation);
          const actual = await transform(lexer, chunks);
          const expected = [
            ...row.flatMap((value, index) => [
              { type: Field, value },
              ...(index === row.length - 1
                ? []
                : [{ type: FieldDelimiter, value: "," }]),
            ]),
          ];
          expect(actual).toStrictEqual(expected);
        },
      ),
      {
        examples: [
          [
            // field endings and delimiters overlap
            {
              row: ["2"],
              quotation: "22",
              chunks: ["22222"],
            },
          ],
          [
            {
              row: ["c21"],
              quotation: "c",
              chunks: ["ccc2", "1", "c"],
            },
          ],
        ],
      },
    ));

  it("should be treated as a record delimiter if EOL", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const data = g(FC.csvData);
          const EOL = g(FC.eol);
          const chunks = autoChunk(
            g,
            data
              .map((row) => row.map((value) => escapeField(value)).join(","))
              .join(EOL) + EOL,
          );
          return {
            data,
            EOL,
            chunks,
          };
        }),
        async ({ data, EOL, chunks }) => {
          const expected = [
            ...data.flatMap((row) => [
              ...(row.length === 0
                ? [{ type: RecordDelimiter, value: EOL }] // If row is empty, add a record delimiter.
                : row.flatMap((value, index) => [
                    ...(value ? [{ type: Field, value }] : []),
                    index === row.length - 1
                      ? { type: RecordDelimiter, value: EOL } // Last field
                      : { type: FieldDelimiter, value: "," }, // Not last field
                  ])),
            ]),
            ...(data.length === 0
              ? [{ type: RecordDelimiter, value: EOL }]
              : []), // If data is empty, add a record delimiter.
          ];
          const actual = await transform(new LexerTransformer(), chunks);
          expect(actual).toStrictEqual(expected);
        },
      ),
    ));
});
