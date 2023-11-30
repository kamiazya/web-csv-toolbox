import { describe, expect } from "vitest";
import { test, fc } from "@fast-check/vitest";
import { LexerTransformer } from "./LexerTransformer";
import { Field, FieldDelimiter, RecordDelimiter } from "./common/constants";

describe("LexerTransformer", () => {
  async function transform(
    transformer: LexerTransformer,
    s: string
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
        })
      );
    return result;
  }

  describe("Property Based Testing", () => {
    describe("Field", () => {
      test("string", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string().filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(new LexerTransformer(), s);
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: s,
                },
              ]);
            }
          )
        );
      });

      test("string with double quote", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string().filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(new LexerTransformer(), `"${s}"`);
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: s,
                },
              ]);
            }
          )
        );
      });

      test("string with comma", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string().filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s},${s}"`
              );
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: `${s},${s}`,
                },
              ]);
            }
          )
        );
      });

      test("unicode string", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString()
              .filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(new LexerTransformer(), s);
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: s,
                },
              ]);
            }
          )
        );
      });

      test("unicode string with double quote", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString()
              .filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(new LexerTransformer(), `"${s}"`);
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: s,
                },
              ]);
            }
          )
        );
      });

      test("unicode string with comma", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString()
              .filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s},${s}"`
              );
              expect(result).toStrictEqual([
                {
                  type: Field,
                  value: `${s},${s}`,
                },
              ]);
            }
          )
        );
      });
    });

    describe("FieldDelimiter", () => {
      test("string", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string().filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `${s},${s}`
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
            }
          )
        );
      });

      test("unicode string", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString()
              .filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `${s},${s}`
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
            }
          )
        );
      });

      test("string with double quote", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string().filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s}","${s}"`
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
            }
          )
        );
      });

      test("unicode string with double quote", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString()
              .filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s}","${s}"`
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
            }
          )
        );
      });

      test("string with comma", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string().filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s},${s}","${s},${s}"`
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
            }
          )
        );
      });

      test("unicode string with comma", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString()
              .filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s},${s}","${s},${s}"`
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
            }
          )
        );
      });

      test("string with double quote and comma", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string().filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s},${s}","${s},${s}"`
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
            }
          )
        );
      });

      test("unicode string with double quote and comma", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString()
              .filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s},${s}","${s},${s}"`
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
            }
          )
        );
      });
    });

    describe.each([
      { title: "EOL=LF, EOF=true", EOL: "\n", EOF: true },
      { title: "EOL=LF, EOF=false", EOL: "\n", EOF: false },
      { title: "EOL=CRLF, EOF=true", EOL: "\r\n", EOF: true },
      { title: "EOL=CRLF, EOF=false", EOL: "\r\n", EOF: false },
    ])("RecordDelimiter($title)", ({ EOL, EOF }) => {
      test("string", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string().filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `${s}${EOL}${s}`
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
              ]);
            }
          )
        );
      });

      test("unicode string", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString()
              .filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `${s}${EOL}${s}`
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
              ]);
            }
          )
        );
      });

      test("string with double quote", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string().filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s}"${EOL}"${s}"`
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
              ]);
            }
          )
        );
      });

      test("unicode string with double quote", async () => {
        await fc.assert(
          fc.asyncProperty(
            fc
              .unicodeString()
              .filter((s) => /[\",]/gi.test(s) === false && s !== ""),
            async (s) => {
              const result = await transform(
                new LexerTransformer(),
                `"${s}"${EOL}"${s}"`
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
              ]);
            }
          )
        );
      });
    });
  });
});
