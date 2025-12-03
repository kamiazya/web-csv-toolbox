import fc from "fast-check";
import { describe as describe_, expect, it as it_, vi } from "vitest";
import { FC, transform } from "@/__tests__/helper.ts";
import { Delimiter } from "@/core/constants.ts";
import type { AnyToken } from "@/core/types.ts";
import { createCSVRecordAssembler } from "@/parser/api/model/createCSVRecordAssembler.ts";
import { CSVRecordAssemblerTransformer } from "@/parser/stream/CSVRecordAssemblerTransformer.ts";

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

describe("CSVRecordAssemblerTransformer", () => {
  it("should throw error if header is empty", () => {
    expect(() =>
      createCSVRecordAssembler({ header: [] }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Headerless mode (header: []) is not supported for outputFormat: 'object'. Use outputFormat: 'array' for headerless CSV, or provide a non-empty header for object format.]`,
    );
  });

  it("should throw error if header has duplicated fields", () => {
    expect(() =>
      createCSVRecordAssembler({ header: ["a", "a"] }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[ParseError: The header must not contain duplicate fields.]`,
    );
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
          const assembler = createCSVRecordAssembler({});
          const actual = await transform(
            new CSVRecordAssemblerTransformer(assembler),
            tokens,
          );
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
          const parser = new CSVRecordAssemblerTransformer(assembler);
          const actual = await transform(parser, tokens);
          expect(actual).toEqual(expected);
        },
      ),
    ));

  it("should throw an error if throws error during transform", async () => {
    const assembler = createCSVRecordAssembler({});
    const transformer = new CSVRecordAssemblerTransformer(assembler);
    vi.spyOn(transformer.assembler, "assemble").mockImplementationOnce(
      // biome-ignore lint/correctness/useYield: Test mock that throws error before yielding
      function* () {
        throw new Error("test");
      },
    );
    const tokens: AnyToken[] = [
      {
        value: "test",
        delimiter: Delimiter.Record,
        delimiterLength: 0,
        location: LOCATION_SHAPE,
      },
    ];
    await expect(async () => {
      await transform(transformer, tokens);
    }).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: test]`);
  });

  it("should throw an error if throws error during flush", async () => {
    const assembler = createCSVRecordAssembler({});
    const transformer = new CSVRecordAssemblerTransformer(assembler);
    // Mock the assemble method to throw error during flush
    vi.spyOn(transformer.assembler, "assemble").mockImplementationOnce(
      // biome-ignore lint/correctness/useYield: Test mock that throws error before yielding
      function* () {
        throw new Error("test");
      },
    );
    await expect(async () => {
      await transform(transformer, []);
    }).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: test]`);
  });
});
