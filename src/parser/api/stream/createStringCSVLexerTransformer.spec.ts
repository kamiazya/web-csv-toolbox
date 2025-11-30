import fc from "fast-check";
import { describe as describe_, expect, it as it_ } from "vitest";
import { autoChunk, FC, transform } from "@/__tests__/helper.ts";
import { Delimiter } from "@/core/constants.ts";
import { createStringCSVLexerTransformer } from "@/parser/api/stream/createStringCSVLexerTransformer.ts";
import { StringCSVLexerTransformer } from "@/parser/stream/StringCSVLexerTransformer.ts";
import { escapeField } from "@/utils/serialization/escapeField.ts";

const describe = describe_.concurrent;
const it = it_.concurrent;

describe("createStringCSVLexerTransformer", () => {
  it("should return a StringCSVLexerTransformer instance", () => {
    const transformer = createStringCSVLexerTransformer();
    expect(transformer).toBeInstanceOf(StringCSVLexerTransformer);
    expect(transformer).toBeInstanceOf(TransformStream);
  });

  it("should create transformer with default options", async () => {
    const transformer = createStringCSVLexerTransformer();
    const chunks = ["name,age\r\n", "Alice,20\r\n"];

    const tokens = await transform(transformer, chunks);
    const flat = tokens.flat();

    // New unified token format: tokens have 'delimiter' property
    // Field delimiter tokens have delimiter: Delimiter.Field
    // Record delimiter tokens have delimiter: Delimiter.Record
    expect(flat.some((t) => t.delimiter === Delimiter.Field)).toBe(true);
    expect(flat.some((t) => t.delimiter === Delimiter.Record)).toBe(true);
  });

  it("should create transformer with custom delimiter", async () => {
    const transformer = createStringCSVLexerTransformer({ delimiter: "\t" });
    const chunks = ["name\tage\r\n", "Alice\t20\r\n"];

    const tokens = await transform(transformer, chunks);
    const flat = tokens.flat();

    // Field tokens followed by field delimiter should have delimiter: Delimiter.Field
    const fieldDelimiterTokens = flat.filter(
      (t) => t.delimiter === Delimiter.Field,
    );
    expect(fieldDelimiterTokens.length).toBeGreaterThan(0);
    // The delimiterLength should be 1 for tab
    expect(fieldDelimiterTokens[0]?.delimiterLength).toBe(1);
  });

  it("should create transformer with custom quotation", async () => {
    const transformer = createStringCSVLexerTransformer({ quotation: "'" });
    const chunks = ["'name','age'\r\n", "'Alice','20'\r\n"];

    const tokens = await transform(transformer, chunks);
    const flat = tokens.flat();

    // Fields should be extracted correctly (value property)
    const values = flat.map((f) => f.value);
    expect(values).toContain("name");
    expect(values).toContain("age");
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
          // New unified format: each field token includes delimiter info
          const expected = row.map((value, index) => ({
            value,
            delimiter:
              index === row.length - 1 ? Delimiter.EOF : Delimiter.Field,
            delimiterLength: index === row.length - 1 ? 0 : 1,
          }));
          return { row, chunks, expected };
        }),
        async ({ chunks, expected }) => {
          const transformer = createStringCSVLexerTransformer();
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
          // New unified format
          const expected = data.flatMap((row, i) =>
            row.map((value, j) => {
              const isLastField = j === row.length - 1;
              const isLastRow = i === data.length - 1;
              let delimiter: typeof Delimiter.Field | typeof Delimiter.Record | typeof Delimiter.EOF;
              let delimiterLength: number;

              if (isLastField) {
                if (isLastRow && !EOF) {
                  delimiter = Delimiter.EOF;
                  delimiterLength = 0;
                } else {
                  delimiter = Delimiter.Record;
                  delimiterLength = eol.length;
                }
              } else {
                delimiter = Delimiter.Field;
                delimiterLength = options.delimiter.length;
              }

              return { value, delimiter, delimiterLength };
            }),
          );
          return { options, chunks, expected };
        }),
        async ({ options, chunks, expected }) => {
          const transformer = createStringCSVLexerTransformer(options);
          const actual = (await transform(transformer, chunks)).flat();
          expect(actual).toMatchObject(expected);
        },
      ),
    );
  });

  it("should accept stream options", () => {
    const transformer = createStringCSVLexerTransformer(
      { delimiter: "," },
      { backpressureCheckInterval: 50 },
    );
    expect(transformer).toBeInstanceOf(StringCSVLexerTransformer);
  });

  it("should accept custom queuing strategies", () => {
    const writableStrategy: QueuingStrategy<string> = {
      highWaterMark: 131072,
      size: (chunk) => chunk.length,
    };
    const readableStrategy = new CountQueuingStrategy({ highWaterMark: 2048 });

    const transformer = createStringCSVLexerTransformer(
      { delimiter: "," },
      {},
      writableStrategy,
      readableStrategy,
    );
    expect(transformer).toBeInstanceOf(StringCSVLexerTransformer);
  });
});
