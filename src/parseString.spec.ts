import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FC } from "./__tests__/helper.ts";
import { escapeField } from "./escapeField.ts";
import { parseString } from "./parseString.ts";
import type { ExecutionStrategy } from "./common/types.ts";

describe("parseString function", () => {
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
          return { data, csv, header };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for await (const record of parseString(csv)) {
            expect(data[i++]).toEqual(record);
          }
        },
      ),
    ));

  it("should throw an error if the CSV is invalid", () => {
    expect(async () => {
      for await (const _ of parseString('a\na"')) {
        // Do nothing.
      }
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[ParseError: Unexpected EOF while parsing quoted field.]`,
    );
  });

  it("should throw an error if options is invalid", () => {
    expect(async () => {
      for await (const _ of parseString("", { delimiter: "" as string })) {
        // Do nothing.
      }
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[RangeError: delimiter must not be empty]`,
    );
  });
});

describe("parseString.toArray function", () => {
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
          return { data, csv, header };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for (const record of await parseString.toArray(csv)) {
            expect(data[i++]).toEqual(record);
          }
        },
      ),
    ));
});

describe("parseString.toArraySync function", () => {
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
          return { data, csv, header };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for (const record of parseString.toArraySync(csv)) {
            expect(data[i++]).toEqual(record);
          }
        },
      ),
    ));
});

describe("parseString.toIterableIterator function", () => {
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
          return { data, csv, header };
        }),
        async ({ data, csv }) => {
          let i = 0;
          for (const record of parseString.toIterableIterator(csv)) {
            expect(data[i++]).toEqual(record);
          }
        },
      ),
    ));
});

describe("parseString.toStream function", () => {
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
          return { data, csv, header };
        }),
        async ({ data, csv }) => {
          let i = 0;
          await parseString.toStream(csv).pipeTo(
            new WritableStream({
              write(record) {
                expect(record).toEqual(data[i++]);
              },
            }),
          );
        },
      ),
    ));
});

// Test each execution strategy
describe("parseString with execution strategies", () => {
  // Note: WASM tests may fail if WASM module is not properly initialized in test environment
  // Worker tests are skipped in Node.js environment and only run in browser tests
  const strategies: Array<{ name: string; execution: ExecutionStrategy[] }> = [
    { name: "main thread (default)", execution: [] },
    { name: "worker", execution: ["worker"] },
  ];

  // TODO: Enable WASM tests when WASM module initialization is fixed in test environment
  // { name: "wasm", execution: ["wasm"] },
  // { name: "worker + wasm", execution: ["worker", "wasm"] },

  for (const { name, execution } of strategies) {
    it.skipIf(execution.includes("worker") && typeof window === "undefined")(
      `should parse CSV with ${name}`,
      () =>
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
              return { data, csv, header };
            }),
            async ({ data, csv }) => {
              let i = 0;
              for await (const record of parseString(csv, { execution })) {
                expect(data[i++]).toEqual(record);
              }
            },
          ),
        ),
    );
  }

  // Error handling tests for worker execution
  it.skipIf(typeof window === "undefined")("should handle errors properly in worker execution", async () => {
    await expect(async () => {
      for await (const _ of parseString('a\na"', { execution: ["worker"] })) {
        // Do nothing.
      }
    }).rejects.toThrow();
  });

  it.skipIf(typeof window === "undefined")("should handle invalid options in worker execution", async () => {
    await expect(async () => {
      for await (const _ of parseString("", { execution: ["worker"], delimiter: "" as string })) {
        // Do nothing.
      }
    }).rejects.toThrow();
  });

  // Property-based test: all execution strategies should produce identical results
  it.skipIf(typeof window === "undefined")("should produce identical results across all execution strategies", () =>
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
              for await (const record of parseString(csv, { execution })) {
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

  // Concurrent execution test
  it.skipIf(typeof window === "undefined")("should handle concurrent parsing requests in worker", async () => {
    const csv1 = "a,b,c\n1,2,3\n4,5,6";
    const csv2 = "x,y,z\n7,8,9\n10,11,12";
    const csv3 = "p,q,r\n13,14,15\n16,17,18";

    // Parse multiple CSVs concurrently using the same worker
    const [result1, result2, result3] = await Promise.all([
      (async () => {
        const records = [];
        for await (const record of parseString(csv1, { execution: ["worker"] })) {
          records.push(record);
        }
        return records;
      })(),
      (async () => {
        const records = [];
        for await (const record of parseString(csv2, { execution: ["worker"] })) {
          records.push(record);
        }
        return records;
      })(),
      (async () => {
        const records = [];
        for await (const record of parseString(csv3, { execution: ["worker"] })) {
          records.push(record);
        }
        return records;
      })(),
    ]);

    // Verify each result is correct
    expect(result1).toEqual([
      { a: "1", b: "2", c: "3" },
      { a: "4", b: "5", c: "6" },
    ]);
    expect(result2).toEqual([
      { x: "7", y: "8", z: "9" },
      { x: "10", y: "11", z: "12" },
    ]);
    expect(result3).toEqual([
      { p: "13", q: "14", r: "15" },
      { p: "16", q: "17", r: "18" },
    ]);
  });
});
