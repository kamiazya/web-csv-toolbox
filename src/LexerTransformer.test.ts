import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";
import { LexerTransformer } from "./LexerTransformer";
import {
  CRLF,
  Field,
  FieldDelimiter,
  LF,
  RecordDelimiter,
} from "./common/constants";

describe("LexerTransformer", () => {
  async function transform(
    transformer: LexerTransformer,
    s: string,
  ): Promise<any[]> {
    const result: any[] = [];
    await new ReadableStream({
      start(controller) {
        controller.enqueue(s);
        controller.close();
      },
    })
      .pipeThrough(transformer)
      .pipeTo(
        new WritableStream({
          write(chunk) {
            result.push(chunk);
          },
        }),
      );
    return result;
  }

  describe("Property Based Testing", () => {
    describe("Field", () => {
      test("string", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .string({ minLength: 1 })
              .filter((s) => /[\",]/gi.test(s) === false),
            async (s) => {
              const result = await transform(new LexerTransformer(), s);
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: s,
                },
              ]);
            },
          ),
        );
      });

      test("string with double quote", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .string({ minLength: 1 })
              .filter((s) => /[\",]/gi.test(s) === false),
            async (s) => {
              const result = await transform(new LexerTransformer(), `"${s}"`);
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: s,
                },
              ]);
            },
          ),
        );
      });

      test("string with comma", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .string({ minLength: 1 })
              .filter((s) => /[\",]/gi.test(s) === false),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s},${s}"`,
              );
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: `${s},${s}`,
                },
              ]);
            },
          ),
        );
      });

      test("unicode string", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString({ minLength: 1 })
              .filter((s) => /[\",\s]/gi.test(s) === false),
            async (s) => {
              const result = await transform(new LexerTransformer(), s);
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: s,
                },
              ]);
            },
          ),
        );
      });

      test("unicode string with double quote", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString({ minLength: 1 })
              .filter((s) => /[\",]/gi.test(s) === false),
            async (s) => {
              const result = await transform(new LexerTransformer(), `"${s}"`);
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: s,
                },
              ]);
            },
          ),
        );
      });

      test("unicode string with comma", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString({ minLength: 1 })
              .filter((s) => /[\",]/gi.test(s) === false),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s},${s}"`,
              );
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: `${s},${s}`,
                },
              ]);
            },
          ),
        );
      });
    });

    describe("FieldDelimiter", () => {
      test("string", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .string({ minLength: 1 })
              .filter((s) => /[\",]/gi.test(s) === false),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `${s},${s}`,
              );
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: s,
                },
                {
                  type: FieldDelimiter,
                  value: ",",
                },
                {
                  type: Field,
                  value: s,
                },
              ]);
            },
          ),
        );
      });

      test("unicode string", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString()
              .filter((s) => /[\",\s]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `${s},${s}`,
              );
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: s,
                },
                {
                  type: FieldDelimiter,
                  value: ",",
                },
                {
                  type: Field,
                  value: s,
                },
              ]);
            },
          ),
        );
      });

      test("string with double quote", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .string({ minLength: 1 })
              .filter((s) => /[\",]/gi.test(s) === false),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s}","${s}"`,
              );
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: s,
                },
                {
                  type: FieldDelimiter,
                  value: ",",
                },
                {
                  type: Field,
                  value: s,
                },
              ]);
            },
          ),
        );
      });

      test("unicode string with double quote", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString({ minLength: 1 })
              .filter((s) => /[\",]/gi.test(s) === false),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s}","${s}"`,
              );
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: s,
                },
                {
                  type: FieldDelimiter,
                  value: ",",
                },
                {
                  type: Field,
                  value: s,
                },
              ]);
            },
          ),
        );
      });

      test("string with comma", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .string({ minLength: 1 })
              .filter((s) => /[\",]/gi.test(s) === false),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s},${s}","${s},${s}"`,
              );
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: `${s},${s}`,
                },
                {
                  type: FieldDelimiter,
                  value: ",",
                },
                {
                  type: Field,
                  value: `${s},${s}`,
                },
              ]);
            },
          ),
        );
      });

      test("unicode string with comma", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString({ minLength: 1 })
              .filter((s) => /[\",]/gi.test(s) === false),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s},${s}","${s},${s}"`,
              );
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: `${s},${s}`,
                },
                {
                  type: FieldDelimiter,
                  value: ",",
                },
                {
                  type: Field,
                  value: `${s},${s}`,
                },
              ]);
            },
          ),
        );
      });

      test("string with double quote and comma", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .string({ minLength: 1 })
              .filter((s) => /[\",]/gi.test(s) === false),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s},${s}","${s},${s}"`,
              );
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: `${s},${s}`,
                },
                {
                  type: FieldDelimiter,
                  value: ",",
                },
                {
                  type: Field,
                  value: `${s},${s}`,
                },
              ]);
            },
          ),
        );
      });

      test("unicode string with double quote and comma", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString({ minLength: 1 })
              .filter((s) => /[\",]/gi.test(s) === false),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s},${s}","${s},${s}"`,
              );
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: `${s},${s}`,
                },
                {
                  type: FieldDelimiter,
                  value: ",",
                },
                {
                  type: Field,
                  value: `${s},${s}`,
                },
              ]);
            },
          ),
        );
      });
    });

    describe.each([
      { title: "EOL=LF, EOF=true", EOL: LF, EOF: true },
      { title: "EOL=LF, EOF=false", EOL: LF, EOF: false },
      { title: "EOL=CRLF, EOF=true", EOL: CRLF, EOF: true },
      { title: "EOL=CRLF, EOF=false", EOL: CRLF, EOF: false },
    ])("RecordDelimiter($title)", ({ EOL, EOF }) => {
      test("string", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .string({ minLength: 1 })
              .filter((s) => /[\",]/gi.test(s) === false),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `${s}${EOL}${s}${EOF ? EOL : ""}`,
              );
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: s,
                },
                {
                  type: RecordDelimiter,
                  value: EOL,
                },
                {
                  type: Field,
                  value: s,
                },
                ...(EOF
                  ? [
                      {
                        type: RecordDelimiter,
                        value: EOL,
                      },
                    ]
                  : []),
              ]);
            },
          ),
        );
      });

      test("unicode string", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString({ minLength: 1 })
              .filter((s) => /[\",\s]/gi.test(s) === false),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `${s}${EOL}${s}${EOF ? EOL : ""}`,
              );
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: s,
                },
                {
                  type: RecordDelimiter,
                  value: EOL,
                },
                {
                  type: Field,
                  value: s,
                },
                ...(EOF
                  ? [
                      {
                        type: RecordDelimiter,
                        value: EOL,
                      },
                    ]
                  : []),
              ]);
            },
          ),
        );
      });

      test("string with double quote", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .string({ minLength: 1 })
              .filter((s) => /[\",]/gi.test(s) === false),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s}"${EOL}"${s}"${EOF ? EOL : ""}`,
              );
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: s,
                },
                {
                  type: RecordDelimiter,
                  value: EOL,
                },
                {
                  type: Field,
                  value: s,
                },
                ...(EOF
                  ? [
                      {
                        type: RecordDelimiter,
                        value: EOL,
                      },
                    ]
                  : []),
              ]);
            },
          ),
        );
      });

      test("unicode string with double quote", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString({ minLength: 1 })
              .filter((s) => /[\",]/gi.test(s) === false),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s}"${EOL}"${s}"${EOF ? EOL : ""}`,
              );
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: s,
                },
                {
                  type: RecordDelimiter,
                  value: EOL,
                },
                {
                  type: Field,
                  value: s,
                },
                ...(EOF
                  ? [
                      {
                        type: RecordDelimiter,
                        value: EOL,
                      },
                    ]
                  : []),
              ]);
            },
          ),
        );
      });
    });
  });
});
