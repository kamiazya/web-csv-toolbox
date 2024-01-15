import { fc } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";
import { RecordAssembler } from "./RecordAssembler.ts";
import { FC } from "./__tests__/helper.ts";
import { Field, FieldDelimiter, RecordDelimiter } from "./common/constants.ts";
import { Token } from "./common/types.ts";

describe("class RecordAssembler", () => {
  it("should throw an error for empty headers", () => {
    expect(() => new RecordAssembler({ header: [] })).toThrowError(
      "The header must not be empty.",
    );
  });

  it("should throw an error for duplicate headers", () => {
    expect(() => new RecordAssembler({ header: ["a", "a"] })).toThrowError(
      "The header must not contain duplicate fields.",
    );
  });

  it("should parse a CSV with headers by data", () => {
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
            ...header.flatMap<Token>((field, i) => [
              { type: Field, value: field },
              i === header.length - 1 ? RecordDelimiter : FieldDelimiter,
            ]),
            // generate rows tokens
            ...rows.flatMap<Token>((row) =>
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
          const assembler = new RecordAssembler();
          const actual = [...assembler.assemble(tokens, true)];
          expect(actual).toEqual(expected);
        },
      ),
    );
  });

  it("should parse a CSV with headers by option", () => {
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
          const assembler = new RecordAssembler({ header });
          const actual = [...assembler.assemble(tokens, true)];
          expect(actual).toEqual(expected);
        },
      ),
    );
  });
});
