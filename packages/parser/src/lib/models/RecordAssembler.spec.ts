import { fc } from "@fast-check/vitest";
import { describe, expect, it } from "vitest";

import { FC } from "#/tests/utils/helper";

import {
  Field,
  FieldDelimiter,
  LF,
  RecordDelimiter,
  type Token,
} from "@web-csv-toolbox/common";

import { RecordAssembler } from "./RecordAssembler.ts";

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

describe("class RecordAssembler", () => {
  it("should throw an error for empty headers", () => {
    expect(
      () => new RecordAssembler({ header: [] }),
    ).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[ParseError: The header must not be empty.]`,
    );
  });

  it("should throw an error for duplicate headers", () => {
    expect(
      () => new RecordAssembler({ header: ["a", "a"] }),
    ).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[ParseError: The header must not contain duplicate fields.]`,
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
              { type: Field, value: field, location: LOCATION_SHAPE },
              i === header.length - 1
                ? {
                    type: RecordDelimiter,
                    value: EOL,
                    location: LOCATION_SHAPE,
                  }
                : {
                    type: FieldDelimiter,
                    value: ",",
                    location: LOCATION_SHAPE,
                  },
            ]),
            // generate rows tokens
            ...rows.flatMap<Token>((row) =>
              // generate row tokens
              row.flatMap<Token>((field, j) => [
                { type: Field, value: field, location: LOCATION_SHAPE },
                { type: FieldDelimiter, value: ",", location: LOCATION_SHAPE },
                // generate record delimiter token
                ...((j === row.length - 1
                  ? [
                      {
                        type: RecordDelimiter,
                        value: LF,
                      },
                    ]
                  : []) as Token[]),
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
                { type: Field, value: field, location: LOCATION_SHAPE },
                { type: FieldDelimiter, value: ",", location: LOCATION_SHAPE },
                ...((j === row.length - 1
                  ? [
                      {
                        type: RecordDelimiter,
                        value: LF,
                      },
                    ]
                  : []) as Token[]),
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
