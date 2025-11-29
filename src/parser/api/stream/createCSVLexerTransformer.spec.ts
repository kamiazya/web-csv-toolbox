import fc from "fast-check";
import { describe as describe_, expect, it as it_ } from "vitest";
import { autoChunk, FC, transform } from "@/__tests__/helper.ts";
import { Field, FieldDelimiter, RecordDelimiter } from "@/core/constants.ts";
import { createCSVLexerTransformer } from "@/parser/api/stream/createCSVLexerTransformer.ts";
import { CSVLexerTransformer } from "@/parser/stream/CSVLexerTransformer.ts";
import { escapeField } from "@/utils/serialization/escapeField.ts";

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

describe("createCSVLexerTransformer", () => {
  it("should return a CSVLexerTransformer instance", () => {
    const transformer = createCSVLexerTransformer();
    expect(transformer).toBeInstanceOf(CSVLexerTransformer);
    expect(transformer).toBeInstanceOf(TransformStream);
  });

  it("should create transformer with default options", async () => {
    const transformer = createCSVLexerTransformer();
    const chunks = ["name,age\r\n", "Alice,20\r\n"];

    const tokens = await transform(transformer, chunks);
    const flat = tokens.flat();

    // Should have fields and delimiters
    expect(flat.some((t) => t.type === Field)).toBe(true);
    expect(flat.some((t) => t.type === FieldDelimiter)).toBe(true);
    expect(flat.some((t) => t.type === RecordDelimiter)).toBe(true);
  });

  it("should create transformer with custom delimiter", async () => {
    const transformer = createCSVLexerTransformer({ delimiter: "\t" });
    const chunks = ["name\tage\r\n", "Alice\t20\r\n"];

    const tokens = await transform(transformer, chunks);
    const flat = tokens.flat();

    // Field delimiter should be tab
    const fieldDelimiters = flat.filter((t) => t.type === FieldDelimiter);
    expect(fieldDelimiters.length).toBeGreaterThan(0);
    expect(fieldDelimiters[0]?.value).toBe("\t");
  });

  it("should create transformer with custom quotation", async () => {
    const transformer = createCSVLexerTransformer({ quotation: "'" });
    const chunks = ["'name','age'\r\n", "'Alice','20'\r\n"];

    const tokens = await transform(transformer, chunks);
    const flat = tokens.flat();

    // Fields should be extracted correctly
    const fields = flat.filter((t) => t.type === Field);
    expect(fields.map((f) => f.value)).toContain("name");
    expect(fields.map((f) => f.value)).toContain("age");
  });

  it("should separate fields by commas by default", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const row = g(FC.row);
          const quote = g(FC.quote);
          const chunks = autoChunk(
            g,
            row.map((v) => escapeField(v, { quote })).join(","),
          );
          const expected = [
            ...row.flatMap((value, index) => [
              ...(quote || value
                ? [{ type: Field, value, location: LOCATION_SHAPE }]
                : []),
              ...(index === row.length - 1
                ? []
                : [
                    {
                      type: FieldDelimiter,
                      value: ",",
                      location: LOCATION_SHAPE,
                    },
                  ]),
            ]),
          ];
          return { row, chunks, expected };
        }),
        async ({ chunks, expected }) => {
          const transformer = createCSVLexerTransformer();
          const actual = (await transform(transformer, chunks)).flat();
          expect(actual).toMatchObject(expected);
        },
      ),
    );
  });

  it("should parse csv with user options", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const options = g(FC.commonOptions);
          const quote = g(FC.quote);
          const data = g(FC.csvData, {
            fieldConstraints: { minLength: 1 },
            rowsConstraints: { minLength: 1 },
            columnsConstraints: { minLength: 1 },
          });
          const eol = g(FC.eol);
          const EOF = g(fc.boolean);
          const csv =
            data
              .map((row) =>
                row
                  .map((value) => escapeField(value, { quote, ...options }))
                  .join(options.delimiter),
              )
              .join(eol) + (EOF ? eol : "");
          const chunks = autoChunk(g, csv);
          const expected = [
            ...data.flatMap((row, i) => [
              ...row.flatMap((value, j) => [
                ...(quote || value !== "" ? [{ type: Field, value }] : []),
                ...(row.length - 1 !== j
                  ? [
                      {
                        type: FieldDelimiter,
                        value: options.delimiter,
                        location: LOCATION_SHAPE,
                      },
                    ]
                  : []),
              ]),
              ...(data.length - 1 !== i
                ? [
                    {
                      type: RecordDelimiter,
                      value: eol,
                      location: LOCATION_SHAPE,
                    },
                  ]
                : []),
            ]),
          ];
          return { options, chunks, expected };
        }),
        async ({ options, chunks, expected }) => {
          const transformer = createCSVLexerTransformer(options);
          const actual = (await transform(transformer, chunks)).flat();
          expect(actual).toMatchObject(expected);
        },
      ),
    );
  });

  it("should accept stream options", () => {
    const transformer = createCSVLexerTransformer(
      { delimiter: "," },
      { backpressureCheckInterval: 50 },
    );
    expect(transformer).toBeInstanceOf(CSVLexerTransformer);
  });

  it("should accept custom queuing strategies", () => {
    const writableStrategy: QueuingStrategy<string> = {
      highWaterMark: 131072,
      size: (chunk) => chunk.length,
    };
    const readableStrategy = new CountQueuingStrategy({ highWaterMark: 2048 });

    const transformer = createCSVLexerTransformer(
      { delimiter: "," },
      {},
      writableStrategy,
      readableStrategy,
    );
    expect(transformer).toBeInstanceOf(CSVLexerTransformer);
  });
});
