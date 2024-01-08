import { fc } from "@fast-check/vitest";
import { describe as describe_, expect, it as it_ } from "vitest";
import { FC, autoChunk, transform } from "../../__tests__/helper.js";
import { Field, FieldDelimiter, RecordDelimiter } from "../../common/index.js";
import { escapeField } from "../../internal/escapeField.js";
import { LexerTransformer } from "../LexerTransformer.js";

const describe = describe_.concurrent;
const it = it_.concurrent;

describe("LexerTransformer", () => {
  it("should be a TransformStream", () => {
    expect(new LexerTransformer()).toBeInstanceOf(TransformStream);
  });

  it("should separate fields by commas by default", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const row = g(FC.row);
          const quate = g(FC.quate);
          const chunks = autoChunk(
            g,
            row.map((v) => escapeField(v, { quate })).join(","),
          );
          const expected = [
            ...row.flatMap((value, index) => [
              // If the field is empty or quate is true, add a field.
              ...(quate || value ? [{ type: Field, value }] : []),
              // If the field is not the last field, add a field delimiter.
              ...(index === row.length - 1 ? [] : [FieldDelimiter]),
            ]),
          ];
          return { row, chunks, expected };
        }),
        async ({ chunks, expected }) => {
          const lexer = new LexerTransformer();
          const actual = (await transform(lexer, chunks)).flat();
          expect(actual).toStrictEqual(expected);
        },
      ),
    );
  });

  it("should treat the field enclosures as double quotes by default", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const row = g(FC.row);
          const chunks = autoChunk(
            g,
            row.map((v) => escapeField(v, { quate: true })).join(","),
          );
          const expected = [
            ...row.flatMap((value, index) => [
              { type: Field, value },
              ...(index === row.length - 1 ? [] : [FieldDelimiter]),
            ]),
          ];
          return { expected, chunks };
        }),
        async ({ expected, chunks }) => {
          const lexer = new LexerTransformer();
          const actual = (await transform(lexer, chunks)).flat();
          expect(actual).toStrictEqual(expected);
        },
      ),
    );
  });

  it("should parse csv with user options", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const options = g(FC.commonOptions);
          const quate = g(FC.quate);
          const data = g(FC.csvData);
          const eol = g(FC.eol);
          const EOF = g(fc.boolean);
          const csv =
            data
              .map((row) =>
                row
                  .map((value) => escapeField(value, { quate, ...options }))
                  .join(options.delimiter),
              )
              .join(eol) + (EOF ? eol : "");
          const chunks = autoChunk(g, csv);
          const expected = [
            ...data.flatMap((row, i) => [
              // If row is empty, add a record delimiter.
              ...row.flatMap((value, j) => [
                // If the field is empty or quate is true, add a field.
                ...(quate || value !== "" ? [{ type: Field, value }] : []),
                // If the field is not the last field, add a field delimiter.
                ...(row.length - 1 !== j ? [FieldDelimiter] : []),
              ]),
              // if EOF or row is not last row, it should be followed by a record delimiter.
              ...(data.length - 1 !== i ? [RecordDelimiter] : []),
            ]),
            // if EOF line delimiter is present,
            // it should be followed by a record delimiter.
            ...(EOF ? [RecordDelimiter] : []),
          ];
          return { options, chunks, expected };
        }),
        async ({ options, chunks, expected }) => {
          const lexer = new LexerTransformer(options);
          const actual = (await transform(lexer, chunks)).flat();
          expect(actual).toStrictEqual(expected);
        },
      ),
    );
  });
});
