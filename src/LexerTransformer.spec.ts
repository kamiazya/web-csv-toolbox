import { fc, it } from "@fast-check/vitest";
import { describe, expect } from "vitest";
import { LexerTransformer } from "./LexerTransformer.js";
import { FC, autoChunk, chunker, transform } from "./__tests__/helper.js";
import {
  COMMA,
  CRLF,
  DOUBLE_QUATE,
  Field,
  FieldDelimiter,
  RecordDelimiter,
} from "./common/index.js";

describe("LexerTransformer", () => {
  it("should be a TransformStream", () => {
    expect(new LexerTransformer()).toBeInstanceOf(TransformStream);
  });

  it.prop([FC.string({ maxLength: 0 })])(
    "should be throw error if quotation is not a single character",
    (quotation) => {
      expect(() => new LexerTransformer({ quotation })).toThrow(Error);
    },
  );

  it.prop([FC.string({ maxLength: 0 }).filter((v) => v.length !== 1)])(
    "should be throw error if demiliter is not a single character",
    (demiliter) => {
      expect(() => new LexerTransformer({ demiliter })).toThrow(Error);
    },
  );

  it.prop([
    fc.gen().map((g) => {
      const kind = g(FC.kind);
      const A = g(FC.string, { kind });
      // B is a string that includes A as a substring.
      const B = "".concat(
        g(FC.string, {
          minLength: 0, // Allow empty string
          kind,
        }),
        A,
        g(FC.string, {
          minLength: 0, // Allow empty string
          kind,
        }),
      );
      return { A, B };
    }),
  ])(
    "should be throw error if demiliter and quotation include each other as a substring",
    ({ A, B }) => {
      expect(
        () => new LexerTransformer({ quotation: A, demiliter: B }),
      ).toThrow(Error);
      expect(
        () => new LexerTransformer({ quotation: B, demiliter: A }),
      ).toThrow(Error);
    },
  );

  it.prop([
    fc.gen().map((g) => {
      const kind = g(FC.kind);
      const field1 = g(FC.field, {
        kind,
        excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
        minLength: 1,
      });
      const field2 = g(FC.field, {
        kind,
        excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
        minLength: 1,
      });
      const chunks = autoChunk(g, `${field1},${field2}`);

      return {
        field1,
        field2,
        chunks,
      };
    }),
  ])(
    "should use comma for CSV field demiliter by default",
    async ({ field1, field2, chunks }) => {
      const lexer = new LexerTransformer();
      expect(lexer.demiliter).toBe(",");
      const actual = await transform(lexer, chunks);
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

  it.prop([
    fc.gen().map((g) => {
      const kind = g(FC.kind);
      const demiliter = g(FC.demiliter, {
        kind,
        excludes: [DOUBLE_QUATE, ...CRLF],
      });
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
      return {
        field1,
        field2,
        demiliter,
      };
    }),
  ])(
    "should be use given string for CSV field demiliter",
    async ({ field1, field2, demiliter }) => {
      const lexer = new LexerTransformer({
        demiliter,
      });
      expect(lexer.demiliter).toBe(demiliter);
      const actual = await transform(lexer, [`${field1}${demiliter}${field2}`]);
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
    fc.gen().map((g) => {
      const kind = g(FC.kind);
      const field = g(FC.field, {
        excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
        minLength: 1,
        kind,
      });
      return {
        field,
      };
    }),
  ])(
    "should be use double quate for CSV field quatation by default",
    async ({ field }) => {
      const lexer = new LexerTransformer();
      expect(lexer.quotation).toBe('"');
      expect(await transform(lexer, [`"${field}"`])).toStrictEqual([
        {
          type: Field,
          value: field,
        },
      ]);
    },
  );

  it.prop(
    [
      fc.gen().map((g) => {
        const kind = g(FC.kind);
        const quotation = g(FC.quotation, {
          kind,
          excludes: [COMMA, ...CRLF],
        });
        const field = g(FC.field, {
          kind,
          excludes: [quotation, COMMA, ...CRLF],
          minLength: 1,
        });

        const chunks = chunker(g)`${quotation}${field}${quotation}`;

        return {
          quotation,
          field,
          chunks,
        };
      }),
    ],
    {
      examples: [
        [
          // field endings and delimiters overlap
          {
            field: "e9d4dac9e8b2",
            quotation: "22",
            chunks: ["22e9d4dac9e8b2", "22"],
          },
        ],
      ],
    },
  )(
    "should be use given string for CSV field quatation",
    async ({ quotation, field, chunks }) => {
      const lexer = new LexerTransformer({
        quotation: quotation,
      });
      expect(lexer.quotation).toBe(quotation);
      const actual = await transform(lexer, chunks);
      expect(actual).toStrictEqual([
        {
          type: Field,
          value: field,
        },
      ]);
    },
  );

  it.prop([
    fc.gen().map((g) => {
      const kind = g(FC.kind);
      // generate row what has fileds that not contains deafult demiliter(comma),
      // quotation(double quate), and EOL(LF, CRLF) and has at least one character.
      const row = g(FC.row, {
        fieldConstraints: {
          kind,
          excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
          minLength: 1,
        },
      });
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

    const actual = await transform(new LexerTransformer(), chunks);
    expect(actual).toStrictEqual(expected);
  });

  it.prop([
    fc.gen().map((g) => {
      const kind = g(FC.kind);
      // generate row what has fileds that not contains deafult demiliter(comma),
      // quotation(double quate), and EOL(LF, CRLF) and has at least one character.
      const row = g(FC.row, {
        fieldConstraints: {
          kind,
          excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
          minLength: 1,
        },
      });
      // generate EOL(LF, CRLF).
      const EOL = g(FC.eol);
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
    const actual = await transform(new LexerTransformer(), chunks);
    expect(actual).toStrictEqual(expected);
  });

  it.prop([
    fc.gen().map((g) => {
      const kind = g(FC.kind);
      // generate row what has fileds that not contains deafult demiliter(comma),
      // quotation(double quate), and EOL(LF, CRLF) and has at least one character.
      const data = g(FC.csvData, {
        fieldConstraints: {
          kind,
          minLength: 1,
          excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
        },
      });
      // generate EOL(LF, CRLF).
      const EOL = g(FC.eol);
      // generate chunks from data.
      const chunks = autoChunk(
        g,
        data.map((row) => row.join(",")).join(EOL) + EOL,
      );
      return {
        data,
        EOL,
        chunks,
      };
    }),
  ])("should parse multiple lines", async ({ data, EOL, chunks }) => {
    const actual = await transform(new LexerTransformer(), chunks);
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
      const kind = g(FC.kind);
      // generate row what has fileds that not contains deafult demiliter(comma),
      // quotation(double quate), and EOL(LF, CRLF) and has at filed length 0 or more.
      const row = g(FC.row, {
        sparse: true,
        fieldConstraints: {
          excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
          kind,
        },
      });
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
    const actual = await transform(new LexerTransformer(), chunks);
    expect(actual).toStrictEqual(expected);
  });

  it.prop([
    fc.gen().map((g) => {
      const kind = g(FC.kind);
      const row = g(FC.row, {
        fieldConstraints: {
          kind,
          excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
          minLength: 1,
        },
      });
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
    const actual = await transform(new LexerTransformer(), chunks);
    expect(actual).toStrictEqual(expected);
  });

  it.prop([
    fc.gen().map((g) => {
      const kind = g(FC.kind);
      const data = g(FC.csvData, {
        fieldConstraints: {
          kind,
          excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
          minLength: 1,
        },
      });
      const EOL = g(FC.eol);
      const chunks = autoChunk(
        g,
        data
          .map((row) => row.map((value) => `"${value}"`).join(","))
          .join(EOL) + EOL,
      );
      return {
        data,
        EOL,
        chunks,
      };
    }),
  ])(
    "should parse quoted strings with newlines",
    async ({ data, EOL, chunks }) => {
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
      const actual = await transform(new LexerTransformer(), chunks);
      expect(actual).toStrictEqual(expected);
    },
  );

  it.prop([
    fc.gen().map((g) => {
      const kind = g(FC.kind);
      const row = g(FC.row, {
        fieldConstraints: {
          kind,
          excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
        },
      });
      const chunks = autoChunk(
        g,
        row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","),
      );
      return {
        row,
        chunks,
      };
    }),
  ])(
    "should parse quoted strings with escaped quotes",
    async ({ row, chunks }) => {
      const expected = [
        ...row.flatMap((value, index) => [
          { type: Field, value },
          ...(index === row.length - 1
            ? [] // Last field
            : [{ type: FieldDelimiter, value: "," }]), // Not last field
        ]),
      ];
      const actual = await transform(new LexerTransformer(), chunks);
      expect(actual).toStrictEqual(expected);
    },
  );

  it.prop([
    fc.gen().map((g) => {
      const kind = g(FC.kind);
      const field1 = g(FC.field, {
        kind,
        excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
        minLength: 1,
      });
      const field2Prefix = g(FC.field, {
        kind,
        excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
      });
      const field2Sufix = g(FC.field, {
        kind,
        excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
      });
      const field3 = g(FC.field, {
        kind,
        excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
        minLength: 1,
      });
      const EOL = g(FC.eol);
      const chunks = chunker(
        g,
      )`${field1},"${field2Prefix}${EOL}${field2Sufix}",${field3}`;
      return {
        field1,
        field2Prefix,
        field2Sufix,
        field3,
        EOL,
        chunks,
      };
    }),
  ])(
    "should parse quoted strings with newlines",
    async ({ field1, field2Prefix, field2Sufix, field3, EOL, chunks }) => {
      const expected = [
        { type: Field, value: field1 },
        { type: FieldDelimiter, value: "," },
        { type: Field, value: `${field2Prefix}${EOL}${field2Sufix}` },
        { type: FieldDelimiter, value: "," },
        { type: Field, value: field3 },
      ];
      const actual = await transform(new LexerTransformer(), chunks);
      expect(actual).toStrictEqual(expected);
    },
  );

  it.prop([
    fc.gen().map((g) => {
      const kind = g(FC.kind);
      const field1 = g(FC.field, {
        kind,
        excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
        minLength: 1,
      });

      const field2Prefix = g(FC.field, {
        kind,
        excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
      });
      const field2Sufix = g(FC.field, {
        kind,
        excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
      });
      const field3 = g(FC.field, {
        kind,
        excludes: [COMMA, DOUBLE_QUATE, ...CRLF],
        minLength: 1,
      });
      // NOTE: filed2 is "field2Prefix""field2Sufix", not "field2Prefix"field2Sufix"
      const chunks = chunker(
        g,
      )`${field1},"${field2Prefix}""${field2Sufix}",${field3}`;

      return {
        field1,
        field2Prefix,
        field2Sufix,
        field3,
        chunks,
      };
    }),
  ])(
    "should parse quoted strings with escaped quotes",
    async ({ field1, field2Prefix, field2Sufix, field3, chunks }) => {
      const expected = [
        { type: Field, value: field1 },
        { type: FieldDelimiter, value: "," },
        // Note that the escaped quote is not escaped in the result.
        { type: Field, value: `${field2Prefix}"${field2Sufix}` },
        { type: FieldDelimiter, value: "," },
        { type: Field, value: field3 },
      ];
      const actual = await transform(new LexerTransformer(), chunks);
      expect(actual).toStrictEqual(expected);
    },
  );
});
