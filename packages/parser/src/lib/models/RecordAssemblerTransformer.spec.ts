import fc from "fast-check";
import { describe as describe_, expect, it as it_, vi } from "vitest";

import { FC, transform } from "#/tests/utils/helper";

import {
  Field,
  FieldDelimiter,
  RecordDelimiter,
  type Token,
} from "@web-csv-toolbox/common";

import { RecordAssemblerTransformer } from "./RecordAssemblerTransformer.ts";

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

describe("RecordAssemblerTransformer", () => {
  it("should throw error if header is empty", () => {
    expect(
      () => new RecordAssemblerTransformer({ header: [] }),
    ).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[ParseError: The header must not be empty.]`,
    );
  });

  it("should throw error if header has duplicated fields", () => {
    expect(
      () => new RecordAssemblerTransformer({ header: ["a", "a"] }),
    ).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
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
          const tokens: Token[] = [
            // generate header tokens
            ...header.flatMap<Token>((field, i) => [
              { type: Field, value: field, location: LOCATION_SHAPE },
              i === header.length - 1
                ? {
                    type: RecordDelimiter,
                    value: "\n",
                    location: LOCATION_SHAPE,
                  }
                : {
                    type: FieldDelimiter,
                    value: ",",
                    location: LOCATION_SHAPE,
                  },
            ]),
            // generate rows tokens
            ...rows.flatMap((row) =>
              // generate row tokens
              row.flatMap<Token>((field, j) => [
                { type: Field, value: field, location: LOCATION_SHAPE },
                {
                  type: FieldDelimiter,
                  value: ",",
                  location: LOCATION_SHAPE,
                },
                // generate record delimiter token
                ...((j === row.length - 1
                  ? [
                      {
                        type: RecordDelimiter,
                        value: "\n",
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
                { type: Field, value: field, location: LOCATION_SHAPE },
                {
                  type: FieldDelimiter,
                  value: ",",
                  location: LOCATION_SHAPE,
                },
                ...((j === row.length - 1
                  ? [
                      {
                        type: RecordDelimiter,
                        value: "\n",
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
          const parser = new RecordAssemblerTransformer({
            header,
          });
          const actual = await transform(parser, [tokens]);
          expect(actual).toEqual(expected);
        },
      ),
    ));

  it("should throw an error if throws error on assemble", async () => {
    const transformer = new RecordAssemblerTransformer();
    vi.spyOn(transformer.assembler, "assemble").mockImplementationOnce(() => {
      throw new Error("test");
    });
    expect(async () => {
      await transform(transformer, [[]]);
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[Error: test]`,
    );
  });

  it("should throw an error if throws error on flush", async () => {
    const transformer = new RecordAssemblerTransformer();
    vi.spyOn(transformer.assembler, "flush").mockImplementationOnce(() => {
      throw new Error("test");
    });
    expect(async () => {
      await transform(transformer, [[]]);
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[Error: test]`,
    );
  });
});
