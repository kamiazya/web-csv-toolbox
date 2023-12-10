import { fc, it } from "@fast-check/vitest";
import { assert, describe, expect } from "vitest";
import { LexerTransformer } from "./LexerTransformer";
import { FC, autoChunk, chunker } from "./__tests__/helper";
import {
  COMMA,
  CRLF,
  DOUBLE_QUATE,
  Field,
  FieldDelimiter,
  LF,
  RecordDelimiter,
} from "./common/constants";
import { Token } from "./common/types";

describe("LexerTransformer", () => {
  async function transform(transformer: LexerTransformer, ...chunks: string[]) {
    const tokens: Token[] = [];
    await new ReadableStream({
      start(controller) {
        if (chunks.length === 0) {
          controller.close();
          return;
        }
        controller.enqueue(chunks.shift());
      },
      pull(controller) {
        if (chunks.length === 0) {
          controller.close();
          return;
        }
        controller.enqueue(chunks.shift());
      },
    })
      .pipeThrough(transformer)
      .pipeTo(
        new WritableStream({
          write(token) {
            tokens.push(token);
          },
        }),
      );
    return tokens;
  }

  it("should be a TransformStream", () => {
    expect(new LexerTransformer()).toBeInstanceOf(TransformStream);
  });

  it.prop([fc.string().filter((v) => v.length !== 1)])(
    "should be throw error if quoteChar is not a single character",
    (quoteChar) => {
      expect(() => new LexerTransformer({ quoteChar })).toThrow(Error);
    },
  );

  it.prop([fc.string().filter((v) => v.length !== 1)])(
    "should be throw error if demiliter is not a single character",
    (demiliter) => {
      expect(() => new LexerTransformer({ demiliter })).toThrow(Error);
    },
  );

  it.prop([fc.gen()])(
    "should be throw error if quoteChar and demiliter is same character",
    (g) => {
      const quoteChar = g(FC.quoteChar);
      const demiliter = "".concat(
        g(fc.string, {
          minLength: 0, // Allow empty string
        }),
        quoteChar,
        g(fc.string, {
          minLength: 0, // Allow empty string
        }),
      );
      expect(() => new LexerTransformer({ quoteChar, demiliter })).toThrow(
        Error,
      );
    },
  );

  it.prop({
    field1: FC.field({ excludes: [COMMA, DOUBLE_QUATE], minLength: 1 }),
    field2: FC.field({ excludes: [COMMA, DOUBLE_QUATE], minLength: 1 }),
    gen: fc.gen(),
  })(
    "should use comma for CSV field demiliter by default",
    async ({ field1, field2, gen }) => {
      const lexer = new LexerTransformer();
      expect(lexer.demiliter).toBe(",");
      const chunks = autoChunk(gen, `${field1},${field2}`);
      const actual = await transform(lexer, ...chunks);
      expect(actual).toStrictEqual([
        {
          type: Field,
          value: field1,
        },
        {
          type: FieldDelimiter,
          value: ",",
        },
        {
          type: Field,
          value: field2,
        },
      ]);
    },
  );

  it.prop([fc.gen()])(
    "should be use given string for CSV field demiliter",
    async (g) => {
      const demiliter = g(FC.demiliter, { excludes: [DOUBLE_QUATE] });
      const field1 = g(FC.field, {
        excludes: [demiliter, DOUBLE_QUATE],
        minLength: 1,
      });
      const field2 = g(FC.field, {
        excludes: [demiliter, DOUBLE_QUATE],
        minLength: 1,
      });

      const lexer = new LexerTransformer({
        demiliter,
      });
      expect(lexer.demiliter).toBe(demiliter);
      const actual = await transform(lexer, `${field1}${demiliter}${field2}`);
      expect(actual).toStrictEqual([
        {
          type: Field,
          value: field1,
        },
        {
          type: FieldDelimiter,
          value: demiliter,
        },
        {
          type: Field,
          value: field2,
        },
      ]);
    },
  );

  it.prop([
    FC.field({
      excludes: [COMMA, DOUBLE_QUATE],
      minLength: 1,
    }),
  ])(
    "should be use double quate for CSV field quatation by default",
    async (field) => {
      const lexer = new LexerTransformer();
      expect(lexer.quoteChar).toBe('"');
      expect(await transform(lexer, `"${field}"`)).toStrictEqual([
        {
          type: Field,
          value: field,
        },
      ]);
    },
  );

  it.prop([fc.gen()])(
    "should be use given string for CSV field quatation",
    async (g) => {
      const quoteChar = g(FC.quoteChar, { excludes: [COMMA] });
      const field = g(FC.field, { excludes: [quoteChar], minLength: 1 });
      const chunks = chunker(g)`${quoteChar}${field}${quoteChar}`;
      const lexer = new LexerTransformer({
        quoteChar,
      });
      expect(lexer.quoteChar).toBe(quoteChar);

      expect(await transform(lexer, ...chunks)).toStrictEqual([
        {
          type: Field,
          value: field,
        },
      ]);
    },
  );

  describe("single chunk", () => {
    it.prop({
      row: FC.row({
        fieldConstraints: { excludes: [COMMA, DOUBLE_QUATE], minLength: 1 },
      }),
      g: fc.gen(),
    })("should parse a single line", async ({ row, g }) => {
      const chunks = autoChunk(g, row.join(","));
      const expected = [
        ...row.flatMap((value, index) => [
          { type: Field, value },
          ...(index === row.length - 1
            ? [] // Last field
            : [{ type: FieldDelimiter, value: "," }]), // Not last field
        ]),
      ];

      const actual = await transform(new LexerTransformer(), ...chunks);
      expect(actual).toStrictEqual(expected);
    });

    it.prop({
      row: FC.row({
        fieldConstraints: { excludes: [COMMA, DOUBLE_QUATE], minLength: 1 },
      }),
      EOL: FC.eol(),
      g: fc.gen(),
    })("should parse a single line with EOL", async ({ row, EOL, g }) => {
      const chunks = chunker(g)`${row.join(",")}${EOL}`;
      const expected = [
        ...row.flatMap((value, index) => [
          { type: Field, value },
          ...(index === row.length - 1
            ? [] // Last field
            : [{ type: FieldDelimiter, value: "," }]), // Not last field
        ]),
        { type: RecordDelimiter, value: EOL },
      ];
      const actual = await transform(new LexerTransformer(), ...chunks);
      expect(actual).toStrictEqual(expected);
    });

    it.prop({
      data: FC.csvData({
        fieldConstraints: { minLength: 1, excludes: [COMMA, DOUBLE_QUATE] },
      }),
      EOL: FC.eol(),
      g: fc.gen(),
    })("should parse multiple lines", async ({ data, EOL, g }) => {
      const chunks = autoChunk(
        g,
        data.map((row) => row.join(",")).join(EOL) + EOL,
      );
      const actual = await transform(new LexerTransformer(), ...chunks);
      const expected = [
        ...data.flatMap((row) => [
          ...(row.length === 0
            ? [{ type: RecordDelimiter, value: EOL }] // If row is empty, add a record delimiter.
            : row.flatMap((value, index) => [
                // If row is not empty, add fields.
                { type: Field, value },
                index === row.length - 1
                  ? { type: RecordDelimiter, value: EOL } // Last field
                  : { type: FieldDelimiter, value: "," }, // Not last field
              ])),
        ]),
        ...(data.length === 0 ? [{ type: RecordDelimiter, value: EOL }] : []), // If data is empty, add a record delimiter.
      ];
      expect(actual).toStrictEqual(expected);
    });

    it.prop({
      row: FC.row({
        sparse: true,
        fieldConstraints: {
          excludes: [COMMA, DOUBLE_QUATE],
        },
      }),
      g: fc.gen(),
    })("should parse empty fields", async ({ row, g }) => {
      const chunks = autoChunk(g, row.join(","));
      const expected = [
        ...[...row].flatMap((value, index) => [
          ...(value ? [{ type: Field, value }] : []),
          ...(index === row.length - 1
            ? [] // Last field
            : [{ type: FieldDelimiter, value: "," }]), // Not last field
        ]),
      ];
      const actual = await transform(new LexerTransformer(), ...chunks);
      expect(actual).toStrictEqual(expected);
    });

    it.prop({
      row: FC.row({
        fieldConstraints: { excludes: [COMMA, DOUBLE_QUATE], minLength: 1 },
      }),
      g: fc.gen(),
    })("should parse quoted strings", async ({ row, g }) => {
      const chunks = autoChunk(g, row.map((value) => `"${value}"`).join(","));
      const expected = [
        ...row.flatMap((value, index) => [
          { type: Field, value },
          ...(index === row.length - 1
            ? [] // Last field
            : [{ type: FieldDelimiter, value: "," }]), // Not last field
        ]),
      ];
      const actual = await transform(new LexerTransformer(), ...chunks);
      expect(actual).toStrictEqual(expected);
    });

    it.prop({
      data: FC.csvData({
        fieldConstraints: { excludes: [COMMA, DOUBLE_QUATE], minLength: 1 },
      }),
      EOL: FC.eol(),
      g: fc.gen(),
    })(
      "should parse quoted strings with newlines",
      async ({ data, EOL, g }) => {
        const chunks = autoChunk(
          g,
          data
            .map((row) => row.map((value) => `"${value}"`).join(","))
            .join(EOL) + EOL,
        );

        const expected = [
          ...data.flatMap((row) => [
            ...(row.length === 0
              ? [{ type: RecordDelimiter, value: EOL }] // If row is empty, add a record delimiter.
              : row.flatMap((value, index) => [
                  // If row is not empty, add fields.
                  { type: Field, value },
                  index === row.length - 1
                    ? { type: RecordDelimiter, value: EOL } // Last field
                    : { type: FieldDelimiter, value: "," }, // Not last field
                ])),
          ]),
          ...(data.length === 0 ? [{ type: RecordDelimiter, value: EOL }] : []), // If data is empty, add a record delimiter.
        ];
        const actual = await transform(new LexerTransformer(), ...chunks);
        expect(actual).toStrictEqual(expected);
      },
    );

    it.prop({
      row: FC.row({
        fieldConstraints: {
          excludes: [COMMA, DOUBLE_QUATE],
        },
      }),
      g: fc.gen(),
    })(
      "should parse quoted strings with escaped quotes",
      async ({ row, g }) => {
        const chunks = autoChunk(
          g,
          row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","),
        );
        const expected = [
          ...row.flatMap((value, index) => [
            { type: Field, value },
            ...(index === row.length - 1
              ? [] // Last field
              : [{ type: FieldDelimiter, value: "," }]), // Not last field
          ]),
        ];
        const actual = await transform(new LexerTransformer(), ...chunks);
        expect(actual).toStrictEqual(expected);
      },
    );

    it.prop({
      field1: FC.field({ excludes: [COMMA, DOUBLE_QUATE], minLength: 1 }),
      field2Prefix: FC.field({ excludes: [COMMA, DOUBLE_QUATE] }),
      field2Sufix: FC.field({ excludes: [COMMA, DOUBLE_QUATE] }),
      field3: FC.field({ excludes: [COMMA, DOUBLE_QUATE], minLength: 1 }),
      EOL: FC.eol(),
      g: fc.gen(),
    })(
      "should parse quoted strings with newlines",
      async ({ field1, field2Prefix, field2Sufix, field3, EOL, g }) => {
        const chunks = chunker(
          g,
        )`${field1},"${field2Prefix}${EOL}${field2Sufix}",${field3}`;
        const expected = [
          { type: Field, value: field1 },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: `${field2Prefix}${EOL}${field2Sufix}` },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: field3 },
        ];
        const actual = await transform(new LexerTransformer(), ...chunks);
        expect(actual).toStrictEqual(expected);
      },
    );

    it.prop({
      field1: FC.field({ excludes: [COMMA, DOUBLE_QUATE], minLength: 1 }),
      field2Prefix: FC.field({ excludes: [COMMA, DOUBLE_QUATE] }),
      field2Sufix: FC.field({ excludes: [COMMA, DOUBLE_QUATE] }),
      field3: FC.field({ excludes: [COMMA, DOUBLE_QUATE], minLength: 1 }),
      g: fc.gen(),
    })(
      "should parse quoted strings with escaped quotes",
      async ({ field1, field2Prefix, field2Sufix, field3, g }) => {
        // NOTE: filed2 is "field2Prefix""field2Sufix", not "field2Prefix"field2Sufix"
        const chunks = chunker(
          g,
        )`${field1},"${field2Prefix}""${field2Sufix}",${field3}`;
        const expected = [
          { type: Field, value: field1 },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: `${field2Prefix}"${field2Sufix}` },
          { type: FieldDelimiter, value: "," },
          { type: Field, value: field3 },
        ];
        const actual = await transform(new LexerTransformer(), ...chunks);
        expect(actual).toStrictEqual(expected);
      },
    );
  });
});
