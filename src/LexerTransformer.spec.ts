import { fc, it } from "@fast-check/vitest";
import { describe, expect } from "vitest";
import { LexerTransformer } from "./LexerTransformer";
import { FC, autoChunk, chunker } from "./__tests__/helper";
import {
  COMMA,
  CRLF,
  DOUBLE_QUATE,
  Field,
  FieldDelimiter,
  RecordDelimiter,
} from "./common/constants";
import { Token } from "./common/types";
import { escapeRegExp } from "./common/utils";

fc.configureGlobal({
  endOnFailure: true,
});

describe.each(FC.stringKinds)("LexerTransformer(%s)", (kind: FC.StringKind) => {
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
        })
      );
    return tokens;
  }

  it("should be a TransformStream", () => {
    expect(new LexerTransformer()).toBeInstanceOf(TransformStream);
  });

  it.prop([FC.string({ maxLength: 0 })])(
    "should be throw error if quotationMark is not a single character",
    (quotationMark) => {
      expect(
        () => new LexerTransformer({ quotationMark: quotationMark })
      ).toThrow(Error);
    }
  );

  it.prop([FC.string({ maxLength: 0 }).filter((v) => v.length !== 1)])(
    "should be throw error if demiliter is not a single character",
    (demiliter) => {
      expect(() => new LexerTransformer({ demiliter })).toThrow(Error);
    }
  );

  it.prop([fc.gen()])(
    "should be throw error if quotationMark and demiliter is same character",
    (g) => {
      const a = g(FC.string, { kind });
      const b = "".concat(
        g(FC.string, {
          minLength: 0, // Allow empty string
          kind,
        }),
        a,
        g(FC.string, {
          minLength: 0, // Allow empty string
          kind,
        })
      );
      expect(
        () => new LexerTransformer({ quotationMark: a, demiliter: b })
      ).toThrow(Error);
      expect(
        () => new LexerTransformer({ quotationMark: b, demiliter: a })
      ).toThrow(Error);
    }
  );

  it.prop({
    field1: FC.field({
      kind,
      excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
      minLength: 1,
    }),
    field2: FC.field({
      kind,
      excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
      minLength: 1,
    }),
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
    }
  );

  it.prop([fc.gen()], { endOnFailure: true })(
    "should be use given string for CSV field demiliter",
    async (g) => {
      // TODO add kind
      const demiliter = g(FC.demiliter, { excludes: [DOUBLE_QUATE, ...CRLF] });
      const field1 = g(FC.field, {
        excludes: [demiliter, DOUBLE_QUATE, ...CRLF],
        minLength: 1,
        kind,
      });
      const field2 = g(FC.field, {
        excludes: [demiliter, DOUBLE_QUATE, ...CRLF],
        minLength: 1,
        kind,
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
    }
  );

  it.prop([
    FC.field({
      excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
      minLength: 1,
      kind,
    }),
  ])(
    "should be use double quate for CSV field quatation by default",
    async (field) => {
      const lexer = new LexerTransformer();
      expect(lexer.quotationMark).toBe('"');
      expect(await transform(lexer, `"${field}"`)).toStrictEqual([
        {
          type: Field,
          value: field,
        },
      ]);
    }
  );

  it.prop(
    [
      fc.gen().map((g) => {
        const quotationMark = g(FC.quotationMark, {
          kind,
          excludes: [COMMA, ...CRLF],
        });
        const field = g(FC.field, {
          kind,
          excludes: [quotationMark, COMMA, ...CRLF],
          minLength: 1,
        });

        const chunks = chunker(g)`${quotationMark}${field}${quotationMark}`;

        return {
          quotationMark,
          field,
          chunks,
        };
      }),
    ],
  )(
    "should be use given string for CSV field quatation",
    async ({ quotationMark, field, chunks }) => {
      const lexer = new LexerTransformer({
        quotationMark: quotationMark,
      });
      expect(lexer.quotationMark).toBe(quotationMark);
      const actual = await transform(lexer, ...chunks);
      expect(actual).toStrictEqual([
        {
          type: Field,
          value: field,
        },
      ]);
    }
  );

  it.prop([
    fc.gen().map((g) => {
      // generate row what has fileds that not contains deafult demiliter(comma),
      // quotation(double quate), and EOL(LF, CRLF) and has at least one character.
      const row = g(() =>
        FC.row({
          fieldConstraints: {
            kind,
            excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
            minLength: 1,
          },
        })
      );
      // generate chunks from row.
      const chunks = autoChunk(g, row.join(","));
      return {
        row,
        chunks,
      };
    }),
  ])("should parse a single line", async ({ row, chunks }) => {
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

  it.prop([
    fc.gen().map((g) => {
      // generate row what has fileds that not contains deafult demiliter(comma),
      // quotation(double quate), and EOL(LF, CRLF) and has at least one character.
      const row = g(() =>
        FC.row({
          fieldConstraints: {
            kind,
            excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
            minLength: 1,
          },
        })
      );
      // generate EOL(LF, CRLF).
      const EOL = g(() => FC.eol());
      // generate chunks from row.
      const chunks = chunker(g)`${row.join(",")}${EOL}`;
      return {
        row,
        EOL,
        chunks,
      };
    }),
  ])("should parse a single line with EOL", async ({ row, EOL, chunks }) => {
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

  it.prop([
    fc.gen().map((g) => {
      // generate row what has fileds that not contains deafult demiliter(comma),
      // quotation(double quate), and EOL(LF, CRLF) and has at least one character.
      const data = g(() =>
        FC.csvData({
          fieldConstraints: {
            kind,
            minLength: 1,
            excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
          },
        })
      );
      // generate EOL(LF, CRLF).
      const EOL = g(() => FC.eol());
      // generate chunks from data.
      const chunks = autoChunk(
        g,
        data.map((row) => row.join(",")).join(EOL) + EOL
      );
      return {
        data,
        EOL,
        chunks,
      };
    }),
  ])("should parse multiple lines", async ({ data, EOL, chunks }) => {
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

  it.prop([
    fc.gen().map((g) => {
      // generate row what has fileds that not contains deafult demiliter(comma),
      // quotation(double quate), and EOL(LF, CRLF) and has at filed length 0 or more.
      const row = g(() =>
        FC.row({
          sparse: true,
          fieldConstraints: {
            excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
            kind,
          },
        })
      );
      // generate chunks from row.
      const chunks = autoChunk(g, row.join(","));
      return {
        row,
        chunks,
      };
    }),
  ])("should parse empty fields", async ({ row, chunks }) => {
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

  it.prop([
    fc.gen().map((g) => {
      const row = g(() =>
        FC.row({
          fieldConstraints: {
            kind,
            excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
            minLength: 1,
          },
        })
      );
      const chunks = autoChunk(g, row.map((value) => `"${value}"`).join(","));
      return {
        row,
        chunks,
      };
    }),
  ])("should parse quoted strings", async ({ row, chunks }) => {
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
      fieldConstraints: {
        kind,
        excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
        minLength: 1,
      },
    }),
    EOL: FC.eol(),
    g: fc.gen(),
  })("should parse quoted strings with newlines", async ({ data, EOL, g }) => {
    const chunks = autoChunk(
      g,
      data.map((row) => row.map((value) => `"${value}"`).join(",")).join(EOL) +
        EOL
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
  });

  it.prop({
    row: FC.row({
      fieldConstraints: {
        kind,
        excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
      },
    }),
    g: fc.gen(),
  })("should parse quoted strings with escaped quotes", async ({ row, g }) => {
    const chunks = autoChunk(
      g,
      row.map((value) => `"${value.replace(/"/g, '""')}"`).join(",")
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
  });

  it.prop({
    field1: FC.field({
      kind,
      excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
      minLength: 1,
    }),
    field2Prefix: FC.field({ kind, excludes: [COMMA, DOUBLE_QUATE, ...CRLF] }),
    field2Sufix: FC.field({ kind, excludes: [COMMA, DOUBLE_QUATE, ...CRLF] }),
    field3: FC.field({
      kind,
      excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
      minLength: 1,
    }),
    EOL: FC.eol(),
    g: fc.gen(),
  })(
    "should parse quoted strings with newlines",
    async ({ field1, field2Prefix, field2Sufix, field3, EOL, g }) => {
      const chunks = chunker(
        g
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
    }
  );

  it.prop({
    field1: FC.field({
      kind,
      excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
      minLength: 1,
    }),
    field2Prefix: FC.field({ kind, excludes: [COMMA, DOUBLE_QUATE, ...CRLF] }),
    field2Sufix: FC.field({ kind, excludes: [COMMA, DOUBLE_QUATE, ...CRLF] }),
    field3: FC.field({
      kind,
      excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
      minLength: 1,
    }),
    g: fc.gen(),
  })(
    "should parse quoted strings with escaped quotes",
    async ({ field1, field2Prefix, field2Sufix, field3, g }) => {
      // NOTE: filed2 is "field2Prefix""field2Sufix", not "field2Prefix"field2Sufix"
      const chunks = chunker(
        g
      )`${field1},"${field2Prefix}""${field2Sufix}",${field3}`;
      const expected = [
        { type: Field, value: field1 },
        { type: FieldDelimiter, value: "," },
        // Note that the escaped quote is not escaped in the result.
        { type: Field, value: `${field2Prefix}"${field2Sufix}` },
        { type: FieldDelimiter, value: "," },
        { type: Field, value: field3 },
      ];
      const actual = await transform(new LexerTransformer(), ...chunks);
      expect(actual).toStrictEqual(expected);
    }
  );
});
