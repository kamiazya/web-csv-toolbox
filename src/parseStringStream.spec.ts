import fc from "fast-check";
import { describe, expect, it, test } from "vitest";
import { FC } from "./__tests__/helper.ts";
import { escapeField } from "./escapeField.ts";
import { parseStringStream } from "./parseStringStream.ts";
import { SingleValueReadableStream } from "./utils/SingleValueReadableStream.ts";
import type { ExecutionStrategy } from "./common/types.ts";

describe("parseStringStream function", () => {
  it("should parse CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header);
          const EOL = g(FC.eol);
          const csvData = g(FC.csvData, {
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
          return { data, csv: new SingleValueReadableStream(csv), header };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for await (const row of parseStringStream(csv)) {
            expect(data[i++]).toEqual(row);
          }
        },
      ),
    ));
});

test("throws an error if invalid input", async () => {
  await expect(async () => {
    for await (const _ of parseStringStream(
      new SingleValueReadableStream('a\n"'),
    )) {
      // Do nothing
    }
  }).rejects.toThrowErrorMatchingInlineSnapshot(
    // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
    `[ParseError: Unexpected EOF while parsing quoted field.]`,
  );
});

// Test each execution strategy (WASM doesn't support streaming)
describe("parseStringStream with execution strategies", () => {
  const strategies: Array<{ name: string; execution: ExecutionStrategy[] }> = [
    { name: "main thread (default)", execution: [] },
    { name: "worker", execution: ["worker"] },
  ];

  for (const { name, execution } of strategies) {
    it(`should parse CSV with ${name}`, () =>
      fc.assert(
        fc.asyncProperty(
          fc.gen().map((g) => {
            const header = g(FC.header);
            const EOL = g(FC.eol);
            const csvData = g(FC.csvData, {
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
            return { data, csv: new SingleValueReadableStream(csv), header };
          }),
          async ({ data, csv }) => {
            let i = 0;
            const result = parseStringStream(csv, { execution });
            const iterator = result instanceof Promise ? await result : result;
            for await (const row of iterator) {
              expect(data[i++]).toEqual(row);
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
          const header = g(FC.header);
          const EOL = g(FC.eol);
          const csvData = g(FC.csvData, {
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
              const result = parseStringStream(
                new SingleValueReadableStream(csv),
                { execution },
              );
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
      const result = parseStringStream(
        new SingleValueReadableStream("a,b\n1,2"),
        { execution: ["wasm"] },
      );
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
