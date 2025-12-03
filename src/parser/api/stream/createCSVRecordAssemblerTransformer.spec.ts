import fc from "fast-check";
import { describe as describe_, expect, it as it_ } from "vitest";
import { FC, transform } from "@/__tests__/helper.ts";
import { Delimiter } from "@/core/constants.ts";
import type { AnyToken } from "@/core/types.ts";
import { createCSVRecordAssemblerTransformer } from "@/parser/api/stream/createCSVRecordAssemblerTransformer.ts";
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

describe("createCSVRecordAssemblerTransformer", () => {
  it("should return a CSVRecordAssemblerTransformer instance", () => {
    const transformer = createCSVRecordAssemblerTransformer();
    expect(transformer).toBeInstanceOf(CSVRecordAssemblerTransformer);
    expect(transformer).toBeInstanceOf(TransformStream);
  });

  it("should create transformer with default options", async () => {
    const transformer = createCSVRecordAssemblerTransformer();

    // New unified token format: each field token includes what follows (delimiter info)
    const tokens: AnyToken[] = [
      { value: "name", delimiter: Delimiter.Field, delimiterLength: 1 },
      { value: "age", delimiter: Delimiter.Record, delimiterLength: 1 },
      { value: "Alice", delimiter: Delimiter.Field, delimiterLength: 1 },
      { value: "20", delimiter: Delimiter.Record, delimiterLength: 1 },
    ];

    const records = await transform(transformer, tokens);
    expect(records).toEqual([{ name: "Alice", age: "20" }]);
  });

  it("should create transformer with predefined header", async () => {
    const transformer = createCSVRecordAssemblerTransformer({
      header: ["name", "age"] as const,
    });

    const tokens: AnyToken[] = [
      { value: "Alice", delimiter: Delimiter.Field, delimiterLength: 1 },
      { value: "20", delimiter: Delimiter.Record, delimiterLength: 1 },
      { value: "Bob", delimiter: Delimiter.Field, delimiterLength: 1 },
      { value: "25", delimiter: Delimiter.Record, delimiterLength: 1 },
    ];

    const records = await transform(transformer, tokens);
    expect(records).toEqual([
      { name: "Alice", age: "20" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("should create transformer with array output format", async () => {
    const transformer = createCSVRecordAssemblerTransformer({
      outputFormat: "array",
    });

    const tokens: AnyToken[] = [
      { value: "name", delimiter: Delimiter.Field, delimiterLength: 1 },
      { value: "age", delimiter: Delimiter.Record, delimiterLength: 1 },
      { value: "Alice", delimiter: Delimiter.Field, delimiterLength: 1 },
      { value: "20", delimiter: Delimiter.Record, delimiterLength: 1 },
    ];

    const records = await transform(transformer, tokens);
    expect(records).toEqual([["Alice", "20"]]);
  });

  it("should throw error if header is empty for object format", () => {
    expect(() =>
      createCSVRecordAssemblerTransformer({ header: [] }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[Error: Headerless mode (header: []) is not supported for outputFormat: 'object'. Use outputFormat: 'array' for headerless CSV, or provide a non-empty header for object format.]`,
    );
  });

  it("should throw error if header has duplicated fields", () => {
    expect(() =>
      createCSVRecordAssemblerTransformer({ header: ["a", "a"] }),
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
          // New unified token format
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
          const transformer = createCSVRecordAssemblerTransformer();
          const actual = await transform(transformer, tokens);
          expect(actual).toMatchObject(expected);
        },
      ),
    ));

  it("should accept stream options", () => {
    const transformer = createCSVRecordAssemblerTransformer(
      {},
      { backpressureCheckInterval: 20 },
    );
    expect(transformer).toBeInstanceOf(CSVRecordAssemblerTransformer);
  });

  it("should accept custom queuing strategies", () => {
    const writableStrategy = new CountQueuingStrategy({ highWaterMark: 2048 });
    const readableStrategy = new CountQueuingStrategy({ highWaterMark: 512 });

    const transformer = createCSVRecordAssemblerTransformer(
      {},
      {},
      writableStrategy,
      readableStrategy,
    );
    expect(transformer).toBeInstanceOf(CSVRecordAssemblerTransformer);
  });
});
