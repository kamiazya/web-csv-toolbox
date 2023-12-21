import { fc, it as it_ } from "@fast-check/vitest";
import { describe as describe_, expect } from "vitest";
import { FC, transform } from "../../__tests__/helper.js";
import {
  COMMA,
  Field,
  FieldDelimiter,
  RecordDelimiter,
} from "../../common/index.js";
import { ParserTransformar } from "../ParserTransformer.js";

const describe = describe_.concurrent;
const it = it_.concurrent;

describe("ParserTransformer", () => {
  it("should parse a CSV with headers by data", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const EOL = g(FC.eol);
          const header = g(FC.row, {
            columnsConstraints: {
              minLength: 1,
            },
          });
          const rows = g(FC.csvData, {
            columnsConstraints: {
              minLength: header.length,
              maxLength: header.length,
            },
          });
          const tokens = [
            // generate header tokens
            ...header.flatMap((field, i) => [
              { type: Field, value: field },
              i === header.length - 1
                ? { type: RecordDelimiter, value: EOL }
                : { type: FieldDelimiter, value: COMMA },
            ]),
            // generate rows tokens
            ...rows.flatMap((row) =>
              // generate row tokens
              row.flatMap((field, j) => [
                { type: Field, value: field },
                { type: FieldDelimiter, value: COMMA },
                // generate record delimiter token
                ...(j === row.length - 1
                  ? [{ type: RecordDelimiter, value: EOL }]
                  : []),
              ]),
            ),
          ];
          const expected = rows.map((row) =>
            Object.fromEntries(row.map((field, i) => [header[i], field])),
          );
          return { tokens, expected };
        }),
        async ({ tokens, expected }) => {
          const actual = await transform(new ParserTransformar(), tokens);
          expect(actual).toEqual(expected);
        },
      ),
    ));

  it("should parse a CSV with headers by option", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const EOL = g(FC.eol);
          const header = g(FC.row, {
            columnsConstraints: {
              minLength: 1,
            },
          });
          const rows = g(FC.csvData, {
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
        async ({ header, tokens, expected }) => {
          const parser = new ParserTransformar({
            header,
          });
          const actual = await transform(parser, tokens);
          expect(actual).toEqual(expected);
        },
      ),
    ));
});
