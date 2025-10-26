import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FC } from "./__tests__/helper.ts";
import { escapeField } from "./escapeField.ts";
import { parseBinary } from "./parseBinary.ts";
import type { ExecutionStrategy } from "./common/types.ts";

describe("parseBinary function", () => {
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
            csv: new TextEncoder().encode(csv),
          };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for await (const row of parseBinary(csv)) {
            expect(data[i++]).toStrictEqual(row);
          }
        },
      ),
    ));
});

// Test each execution strategy
describe("parseBinary with execution strategies", () => {
  // Note: WASM tests may fail if WASM module is not properly initialized in test environment
  const strategies: Array<{ name: string; execution: ExecutionStrategy[] }> = [
    { name: "main thread (default)", execution: [] },
    { name: "worker", execution: ["worker"] },
  ];

  // TODO: Enable WASM tests when WASM module initialization is fixed in test environment
  // { name: "wasm", execution: ["wasm"] },
  // { name: "worker + wasm", execution: ["worker", "wasm"] },

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
              csv: new TextEncoder().encode(csv),
            };
          }),
          async ({ data, csv }) => {
            let i = 0;
            for await (const row of parseBinary(csv, { execution })) {
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
          return {
            csv: new TextEncoder().encode(csv),
          };
        }),
        async ({ csv }) => {
          // Parse with all execution strategies
          const results = await Promise.all(
            strategies.map(async ({ execution }) => {
              const records = [];
              for await (const record of parseBinary(csv, { execution })) {
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
});
