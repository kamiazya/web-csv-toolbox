import fc from "fast-check";
import { describe, expect, it, test } from "vitest";
import { FC } from "./__tests__/helper.ts";
import { escapeField } from "./escapeField.ts";
import { parseUint8ArrayStream } from "./parseUint8ArrayStream.ts";
import { SingleValueReadableStream } from "./utils/SingleValueReadableStream.ts";
import type { ExecutionStrategy } from "./common/types.ts";

describe("parseUint8ArrayStream function", () => {
  it("should parse CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            // TextEncoderStream can't handle utf-16 string.
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
          });
          const EOL = g(FC.eol);
          const csvData = g(FC.csvData, {
            // TextEncoderStream can't handle utf-16 string.
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
            columnsConstraints: {
              minLength: header.length,
              maxLength: header.length,
            },
          });
          const EOF = g(fc.boolean);
          const csv = [
            header.map((v) => escapeField(v, { quote: true })).join(","),
            ...csvData.map((row) =>
              row.map((v) => escapeField(v, { quote: true })).join(","),
            ),
            ...(EOF ? [""] : []),
          ].join(EOL);
          const data =
            csvData.length >= 1
              ? csvData.map((row) =>
                  Object.fromEntries(row.map((v, i) => [header[i], v])),
                )
              : [];
          return {
            data,
            csv: new SingleValueReadableStream(csv).pipeThrough(
              new TextEncoderStream(),
            ),
          };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for await (const row of parseUint8ArrayStream(csv)) {
            expect(data[i++]).toStrictEqual(row);
          }
        },
      ),
    ));

  it("should parse CSV with BOM", async () => {
    const csv = new SingleValueReadableStream("\uFEFFa,b,c\n1,2,3").pipeThrough(
      new TextEncoderStream(),
    );
    const expected = [{ a: "1", b: "2", c: "3" }];
    let i = 0;
    for await (const row of parseUint8ArrayStream(csv)) {
      expect(row).toStrictEqual(expected[i++]);
    }
  });

  it("should parse CSV with BOM and EOL", async () => {
    const csv = new SingleValueReadableStream(
      "\uFEFFa,b,c\r\n1,2,3\r\n",
    ).pipeThrough(new TextEncoderStream());
    const expected = [{ a: "1", b: "2", c: "3" }];
    let i = 0;
    for await (const row of parseUint8ArrayStream(csv)) {
      expect(row).toStrictEqual(expected[i++]);
    }
  });

  it("should parse decompressed CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            // TextEncoderStream can't handle utf-16 string.
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
          });
          const EOL = g(FC.eol);
          const csvData = g(FC.csvData, {
            // TextEncoderStream can't handle utf-16 string.
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
            columnsConstraints: {
              minLength: header.length,
              maxLength: header.length,
            },
          });
          const EOF = g(fc.boolean);
          const csv = [
            header.map((v) => escapeField(v, { quote: true })).join(","),
            ...csvData.map((row) =>
              row.map((v) => escapeField(v, { quote: true })).join(","),
            ),
            ...(EOF ? [""] : []),
          ].join(EOL);
          const data =
            csvData.length >= 1
              ? csvData.map((row) =>
                  Object.fromEntries(row.map((v, i) => [header[i], v])),
                )
              : [];
          const decompression = g(() =>
            fc.constantFrom<CompressionFormat>(
              "gzip",
              "deflate",
              // NOTE: Node.js doesn't support raw deflate.
              // "deflate-raw",
            ),
          );
          return {
            data,
            csv: new SingleValueReadableStream(csv)
              .pipeThrough(new TextEncoderStream())
              .pipeThrough(new CompressionStream(decompression)),
            decompression: decompression,
          };
        }),
        async ({ data, csv, decompression }) => {
          let i = 0;
          for await (const row of parseUint8ArrayStream(csv, {
            decomposition: decompression,
          })) {
            expect(data[i++]).toStrictEqual(row);
          }
        },
      ),
    ));
});

test("throws an error if the CSV is invalid", async () => {
  await expect(async () => {
    for await (const _ of parseUint8ArrayStream(
      new SingleValueReadableStream('a\n"').pipeThrough(
        new TextEncoderStream(),
      ),
    )) {
      // Do nothing
    }
  }).rejects.toThrowErrorMatchingInlineSnapshot(
    // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
    `[ParseError: Unexpected EOF while parsing quoted field.]`,
  );
});

// Test each execution strategy (WASM doesn't support streaming)
describe("parseUint8ArrayStream with execution strategies", () => {
  const strategies: Array<{ name: string; execution: ExecutionStrategy[] }> = [
    { name: "main thread (default)", execution: [] },
    { name: "worker", execution: ["worker"] },
  ];

  for (const { name, execution } of strategies) {
    it(`should parse CSV with ${name}`, () =>
      fc.assert(
        fc.asyncProperty(
          fc.gen().map((g) => {
            const header = g(FC.header, {
              fieldConstraints: {
                kindExcludes: ["string16bits"],
              },
            });
            const EOL = g(FC.eol);
            const csvData = g(FC.csvData, {
              fieldConstraints: {
                kindExcludes: ["string16bits"],
              },
              columnsConstraints: {
                minLength: header.length,
                maxLength: header.length,
              },
            });
            const EOF = g(fc.boolean);
            const csv = [
              header.map((v) => escapeField(v, { quote: true })).join(","),
              ...csvData.map((row) =>
                row.map((v) => escapeField(v, { quote: true })).join(","),
              ),
              ...(EOF ? [""] : []),
            ].join(EOL);
            const data =
              csvData.length >= 1
                ? csvData.map((row) =>
                    Object.fromEntries(row.map((v, i) => [header[i], v])),
                  )
                : [];
            return { data, csv };
          }),
          async ({ data, csv }) => {
            let i = 0;
            const stream = new SingleValueReadableStream(csv).pipeThrough(
              new TextEncoderStream(),
            );
            const result = parseUint8ArrayStream(stream, { execution });
            const iterator = result instanceof Promise ? await result : result;
            for await (const row of iterator) {
              expect(data[i++]).toStrictEqual(row);
            }
          },
        ),
      ));
  }

  // Property-based test: all execution strategies should produce identical results
  it("should produce identical results across all execution strategies", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
          });
          const EOL = g(FC.eol);
          const csvData = g(FC.csvData, {
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
            columnsConstraints: {
              minLength: header.length,
              maxLength: header.length,
            },
          });
          const EOF = g(fc.boolean);
          const csv = [
            header.map((v) => escapeField(v, { quote: true })).join(","),
            ...csvData.map((row) =>
              row.map((v) => escapeField(v, { quote: true })).join(","),
            ),
            ...(EOF ? [""] : []),
          ].join(EOL);
          return { csv };
        }),
        async ({ csv }) => {
          // Parse with all execution strategies
          const results = await Promise.all(
            strategies.map(async ({ execution }) => {
              const records = [];
              const stream = new SingleValueReadableStream(csv).pipeThrough(
                new TextEncoderStream(),
              );
              const result = parseUint8ArrayStream(stream, { execution });
              const iterator = result instanceof Promise ? await result : result;
              for await (const record of iterator) {
                records.push(record);
              }
              return records;
            }),
          );

          // All results should be identical
          const [mainResult, ...otherResults] = results;
          for (const result of otherResults) {
            expect(result).toEqual(mainResult);
          }
        },
      ),
    ));

  // Test that WASM execution throws an error for streams
  it("should throw error when using WASM with streams", async () => {
    try {
      const stream = new SingleValueReadableStream("a,b\n1,2").pipeThrough(
        new TextEncoderStream(),
      );
      const result = parseUint8ArrayStream(stream, { execution: ["wasm"] });
      const iterator = result instanceof Promise ? await result : result;
      for await (const _ of iterator) {
        // Do nothing
      }
      throw new Error("Should have thrown an error");
    } catch (error: any) {
      expect(error.message).toMatch(/WASM execution does not support streaming/);
    }
  });
});
