import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FC } from "../../../__tests__/helper.ts";
import type { EngineConfig } from "../../../core/types.ts";
import { escapeField } from "../../../utils/serialization/escapeField.ts";
import { parseBinary } from "../binary/parseBinary.ts";

// Test each execution strategy
describe("parseBinary with execution strategies", () => {
  // Note: WASM tests may fail if WASM module is not properly initialized in test environment
  const strategies: Array<{ name: string; engine?: EngineConfig }> = [
    { name: "main thread (default)", engine: undefined },
    { name: "worker", engine: { worker: true } },
  ];

  // TODO: Enable WASM tests when WASM module initialization is fixed in test environment
  // { name: "wasm", engine: { wasm: true } },
  // { name: "worker + wasm", engine: { worker: true, wasm: true } },

  for (const { name, engine } of strategies) {
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
            for await (const row of parseBinary(csv, { engine })) {
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
          // Parse with each execution strategy sequentially to avoid detached ArrayBuffer issues
          // Note: Using Promise.all would cause ArrayBuffer transfer conflicts in workers
          const results = [];
          for (const { engine } of strategies) {
            const records = [];
            // Create a deep copy of the ArrayBuffer for each strategy
            const csvCopy = csv.slice();
            for await (const record of parseBinary(csvCopy, { engine })) {
              records.push(record);
            }
            results.push(records);
          }

          // All results should be identical
          const [mainResult, ...otherResults] = results;
          for (const result of otherResults) {
            expect(result).toEqual(mainResult);
          }
        },
      ),
    ));
});
