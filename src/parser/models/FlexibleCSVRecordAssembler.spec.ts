import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FC } from "@/__tests__/helper.ts";
import { Delimiter } from "@/core/constants.ts";
import type { AnyToken } from "@/core/types.ts";
import { createCSVRecordAssembler } from "@/parser/api/model/createCSVRecordAssembler.ts";

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
    expect(() =>
      createCSVRecordAssembler({ header: [] }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Headerless mode (header: []) is not supported for outputFormat: 'object'. Use outputFormat: 'array' for headerless CSV, or provide a non-empty header for object format.]`,
    );
  });

  it("should throw an error for duplicate headers", () => {
    expect(() =>
      createCSVRecordAssembler({ header: ["a", "a"] }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[ParseError: The header must not contain duplicate fields.]`,
    );
  });

  it("should parse a CSV with headers by data", () => {
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
          // In unified token format, each token represents a field with its following delimiter
          const tokens: AnyToken[] = [
            // generate header tokens
            ...header.map<AnyToken>((field, i) => ({
              value: field,
              delimiter:
                i === header.length - 1 ? Delimiter.Record : Delimiter.Field,
              delimiterLength: 1,
              location: LOCATION_SHAPE,
            })),
            // generate rows tokens
            ...rows.flatMap((row) =>
              row.map<AnyToken>((field, j) => ({
                value: field,
                delimiter:
                  j === row.length - 1 ? Delimiter.Record : Delimiter.Field,
                delimiterLength: 1,
                location: LOCATION_SHAPE,
              })),
            ),
          ];
          const expected = rows.map((row) =>
            Object.fromEntries(row.map((field, i) => [header[i], field])),
          );
          return { tokens, expected };
        }),
        async ({ tokens, expected }) => {
          const assembler = createCSVRecordAssembler();
          const actual = [...assembler.assemble(tokens)];
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
          // In unified token format, each token represents a field with its following delimiter
          const tokens: AnyToken[] = rows.flatMap((row) =>
            row.map<AnyToken>((field, j) => ({
              value: field,
              delimiter:
                j === row.length - 1 ? Delimiter.Record : Delimiter.Field,
              delimiterLength: 1,
              location: LOCATION_SHAPE,
            })),
          );
          const expected = rows.map((row) =>
            Object.fromEntries(row.map((field, i) => [header[i], field])),
          );
          return { header, tokens, expected };
        }),
        async ({ header, tokens, expected }) => {
          const assembler = createCSVRecordAssembler({ header });
          const actual = [...assembler.assemble(tokens)];
          expect(actual).toEqual(expected);
        },
      ),
    );
  });
});
