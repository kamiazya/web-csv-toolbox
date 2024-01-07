import { fc } from "@fast-check/vitest";
import { describe as describe_, expect, it as it_ } from "vitest";
import { FC, transform } from "../../__tests__/helper.js";
import { Field, FieldDelimiter, RecordDelimiter } from "../../common/index.js";
import { RecordAssemblerTransformar } from "../RecordAssemblerTransformar.js";

const describe = describe_.concurrent;
const it = it_.concurrent;

describe("RecordAssemblerTransformar", () => {
  it("should throw error if header is empty", () => {
    expect(() => new RecordAssemblerTransformar({ header: [] })).toThrowError(
      "The header must not be empty.",
    );
  });

  it("should throw error if header has duplicated fields", () => {
    expect(
      () => new RecordAssemblerTransformar({ header: ["a", "a"] }),
    ).toThrowError("The header must not contain duplicate fields.");
  });

  it("should parse a CSV with headers by data", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const EOL = g(FC.eol);
          const header = g(FC.header);
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
                : { type: FieldDelimiter, value: "," },
            ]),
            // generate rows tokens
            ...rows.flatMap((row) =>
              // generate row tokens
              row.flatMap((field, j) => [
                { type: Field, value: field },
                { type: FieldDelimiter, value: "," },
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
          const actual = await transform(new RecordAssemblerTransformar(), [
            tokens,
          ]);
          expect(actual).toEqual(expected);
        },
      ),
    ));

  it("should parse a CSV with headers by option", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const EOL = g(FC.eol);
          const header = g(FC.header);
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
                { type: FieldDelimiter, value: "," },
                ...(j === row.length - 1
                  ? [{ type: RecordDelimiter, value: EOL }]
                  : []),
              ]),
            ),
          ];
          const expected = rows.map((row) =>
            Object.fromEntries(row.map((field, i) => [header[i], field])),
          );
          return { header, tokens, expected };
        }),
        async ({ header, tokens, expected }) => {
          const parser = new RecordAssemblerTransformar({
            header,
          });
          const actual = await transform(parser, [tokens]);
          expect(actual).toEqual(expected);
        },
      ),
    ));
});
