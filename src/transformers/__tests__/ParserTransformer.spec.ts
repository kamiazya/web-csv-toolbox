import { fc, it } from "@fast-check/vitest";
import { describe, expect } from "vitest";
import { FC, transform } from "../../__tests__/helper.js";
import {
  COMMA,
  CRLF,
  DOUBLE_QUATE,
  Field,
  FieldDelimiter,
  RecordDelimiter,
} from "../../common/index.js";
import { ParserTransformar } from "../ParserTransformer.js";

describe.concurrent("ParserTransformer", () => {
  it.concurrent.prop(
    [
      fc.gen().map((g) => {
        const EOL = g(FC.eol);
        const header = g(FC.row, {
          fieldConstraints: {
            minLength: 1,
            excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
          },
          columnsConstraints: {
            minLength: 1,
          },
        });
        const rows = g(FC.csvData, {
          fieldConstraints: {
            minLength: 1,
            excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
          },
          columnsConstraints: {
            minLength: header.length,
            maxLength: header.length,
          },
        });
        const tokens = [
          ...header.flatMap((field, i) => [
            { type: Field, value: field },
            i === header.length - 1
              ? { type: RecordDelimiter, value: EOL }
              : { type: FieldDelimiter, value: COMMA },
          ]),

          ...rows.flatMap((row) =>
            row.flatMap((field, j) => [
              { type: Field, value: field },
              { type: FieldDelimiter, value: COMMA },
              ...(j === row.length - 1
                ? [{ type: RecordDelimiter, value: EOL }]
                : []),
            ]),
          ),
        ];
        const expected = rows.map((row) =>
          Object.fromEntries(row.map((field, i) => [header[i], field])),
        );
        return {
          tokens,
          expected,
        };
      }),
    ],
    {
      endOnFailure: true,
    },
  )(
    "should parse a CSV with headers by data",
    async ({ tokens, expected }) => {
      const actual = await transform(new ParserTransformar(), tokens);
      expect(actual).toEqual(expected);
    },
  );

  it.concurrent.prop([
    fc.gen().map((g) => {
      const EOL = g(FC.eol);
      const header = g(FC.row, {
        fieldConstraints: {
          minLength: 1,
          excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
        },
        columnsConstraints: {
          minLength: 1,
        },
      });
      const rows = g(FC.csvData, {
        fieldConstraints: {
          minLength: 1,
          excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
        },
        columnsConstraints: {
          minLength: header.length,
          maxLength: header.length,
        },
      });
      const tokens = [
        ...rows.flatMap((row) =>
          row.flatMap((field, j) => [
            { type: Field, value: field },
            { type: FieldDelimiter, value: COMMA },
            ...(j === row.length - 1
              ? [{ type: RecordDelimiter, value: EOL }]
              : []),
          ]),
        ),
      ];
      const expected = rows.map((row) =>
        Object.fromEntries(row.map((field, i) => [header[i], field])),
      );
      return {
        header,
        EOL,
        tokens,
        expected,
      };
    }),
  ])(
    "should parse a CSV with headers by option",
    async ({ header, tokens, expected }) => {
      const actual = await transform(
        new ParserTransformar({
          header,
        }),
        tokens,
      );
      expect(actual).toEqual(expected);
    },
  );

  it.concurrent.prop([
    fc.gen().map((g) => {
      const EOL = g(FC.eol);
      const header = g(FC.row, {
        fieldConstraints: {
          minLength: 1,
          excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
        },
        columnsConstraints: {
          minLength: 1,
        },
      });
      const rows = g(FC.csvData, {
        sparse: true, // To allow empty fields
        fieldConstraints: {
          minLength: 1,
          excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
        },
        columnsConstraints: {
          minLength: header.length,
          maxLength: header.length,
        },
      });
      const tokens = [
        ...rows.flatMap((row) =>
          row.flatMap((field, j) => [
            ...(field.length === 0 ? [] : [{ type: Field, value: field }]),
            { type: FieldDelimiter, value: COMMA },
            ...(j === row.length - 1
              ? [{ type: RecordDelimiter, value: EOL }]
              : []),
          ]),
        ),
      ];
      const expected = rows.map((row) =>
        Object.fromEntries(row.map((field, i) => [header[i], field])),
      );
      return {
        header,
        EOL,
        tokens,
        expected,
      };
    }),
  ])("should parse empty field", async ({ header, tokens, expected }) => {
    const parser = new ParserTransformar({
      header,
    });
    const actual = await transform(parser, tokens);
    expect(actual).toEqual(expected);
  });
});
