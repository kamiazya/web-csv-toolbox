import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FC } from "./__tests__/helper.ts";
import { escapeField } from "./escapeField.ts";
import { parseResponse } from "./parseResponse.ts";
import { SingleValueReadableStream } from "./utils/SingleValueReadableStream.ts";
import type { ExecutionStrategy } from "./common/types.ts";

describe("parseRequest function", () => {
  it("should throw error if content-type header is not text/csv", async () => {
    const response = new Response("", {
      headers: {
        "content-type": "application/json",
      },
    });
    expect(() => parseResponse(response)).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: Invalid mime type: "application/json"]`,
    );
  });
  it("should throw error if request body is null", async () => {
    const response = new Response(null, {
      headers: {
        "content-type": "text/csv",
      },
    });
    expect(() => parseResponse(response)).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[TypeError: Response body is null]`,
    );
  });

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
          const BOM = g(fc.boolean);
          if (BOM) {
            // Add BOM to the first field.
            header[0] = `\ufeff${header[0]}`;
          }
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
            // csv:
            response: new Response(
              new SingleValueReadableStream(csv).pipeThrough(
                new TextEncoderStream(),
              ),
              {
                headers: {
                  "content-type": "text/csv",
                },
              },
            ),
          };
        }),
        async ({ data, response }) => {
          let i = 0;
          for await (const row of parseResponse(response)) {
            expect(data[i++]).toStrictEqual(row);
          }
        },
      ),
    ));
});

// Test each execution strategy (WASM doesn't support streaming)
describe("parseResponse with execution strategies", () => {
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
            const BOM = g(fc.boolean);
            if (BOM) {
              header[0] = `\ufeff${header[0]}`;
            }
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
            return {
              data,
              response: new Response(
                new SingleValueReadableStream(csv).pipeThrough(
                  new TextEncoderStream(),
                ),
                {
                  headers: {
                    "content-type": "text/csv",
                  },
                },
              ),
            };
          }),
          async ({ data, response }) => {
            let i = 0;
            // parseResponse returns AsyncIterableIterator directly, not Promise<AsyncIterableIterator>
            for await (const row of parseResponse(response, { execution })) {
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
          const BOM = g(fc.boolean);
          if (BOM) {
            header[0] = `\ufeff${header[0]}`;
          }
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
              const response = new Response(
                new SingleValueReadableStream(csv).pipeThrough(
                  new TextEncoderStream(),
                ),
                {
                  headers: {
                    "content-type": "text/csv",
                  },
                },
              );
              for await (const record of parseResponse(response, {
                execution,
              })) {
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
      const response = new Response(
        new SingleValueReadableStream("a,b\n1,2").pipeThrough(
          new TextEncoderStream(),
        ),
        {
          headers: {
            "content-type": "text/csv",
          },
        },
      );
      for await (const _ of parseResponse(response, { execution: ["wasm"] })) {
        // Do nothing
      }
      throw new Error("Should have thrown an error");
    } catch (error: any) {
      expect(error.message).toMatch(/WASM execution does not support streaming/);
    }
  });
});
