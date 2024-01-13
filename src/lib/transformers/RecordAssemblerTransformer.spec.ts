import { fc } from "@fast-check/vitest";
import { describe as describe_, expect, it as it_ } from "vitest";
import { FC, transform } from "../__tests__/helper.ts";
import { Field, FieldDelimiter, RecordDelimiter } from "../common/constants.ts";
import { Token } from "../common/types.ts";
import { RecordAssemblerTransformer } from "./RecordAssemblerTransformer.ts";

const describe = describe_.concurrent;
const it = it_.concurrent;

describe("RecordAssemblerTransformer", () => {
  it("should throw error if header is empty", () => {
    expect(() => new RecordAssemblerTransformer({ header: [] })).toThrowError(
      "The header must not be empty.",
    );
  });

  it("should throw error if header has duplicated fields", () => {
    expect(
      () => new RecordAssemblerTransformer({ header: ["a", "a"] }),
    ).toThrowError("The header must not contain duplicate fields.");
  });

  it("should parse a CSV with headers by data", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header);
          const rows = g(FC.csvData, {
            columnsConstraints: {
              minLength: header.length,
              maxLength: header.length,
            },
          });
          const tokens: Token[] = [
            // generate header tokens
            ...header.flatMap<Token>((field, i) => [
              { type: Field, value: field },
              i === header.length - 1 ? RecordDelimiter : FieldDelimiter,
            ]),
            // generate rows tokens
            ...rows.flatMap((row) =>
              // generate row tokens
              row.flatMap<Token>((field, j) => [
                { type: Field, value: field },
                FieldDelimiter,
                // generate record delimiter token
                ...((j === row.length - 1 ? [RecordDelimiter] : []) as Token[]),
              ]),
            ),
          ];
          const expected = rows.map((row) =>
            Object.fromEntries(row.map((field, i) => [header[i], field])),
          );
          return { tokens, expected };
        }),
        async ({ tokens, expected }) => {
          const actual = await transform(new RecordAssemblerTransformer(), [
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
          const header = g(FC.header);
          const rows = g(FC.csvData, {
            columnsConstraints: {
              minLength: header.length,
              maxLength: header.length,
            },
          });
          const tokens = [
            ...rows.flatMap<Token>((row) =>
              row.flatMap<Token>((field, j) => [
                { type: Field, value: field },
                FieldDelimiter,
                ...((j === row.length - 1 ? [RecordDelimiter] : []) as Token[]),
              ]),
            ),
          ];
          const expected = rows.map((row) =>
            Object.fromEntries(row.map((field, i) => [header[i], field])),
          );
          return { header, tokens, expected };
        }),
        async ({ header, tokens, expected }) => {
          const parser = new RecordAssemblerTransformer({
            header,
          });
          const actual = await transform(parser, [tokens]);
          expect(actual).toEqual(expected);
        },
      ),
    ));
});
