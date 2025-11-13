import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FC } from "../../../__tests__/helper.ts";
import { escapeField } from "../../../utils/serialization/escapeField.ts";
import type { EngineConfig } from "../../core/types.ts";
import { parseStringStream } from "./parseStringStream.ts";

// Test each execution strategy (WASM doesn't support streaming)
describe("parseStringStream with execution strategies", () => {
  const strategies: Array<{ name: string; engine?: EngineConfig }> = [
    { name: "main thread (default)", engine: undefined },
    { name: "worker", engine: { worker: true } },
  ];

  for (const { name, engine } of strategies) {
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
            return {
              data,
              csv: new ReadableStream({
                start(controller) {
                  controller.enqueue(csv);
                  controller.close();
                },
              }),
              header,
            };
          }),
          async ({ data, csv }) => {
            let i = 0;
            for await (const row of parseStringStream(csv, { engine })) {
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
            strategies.map(async ({ engine }) => {
              const records = [];
              for await (const record of parseStringStream(
                new ReadableStream({
                  start(controller) {
                    controller.enqueue(csv);
                    controller.close();
                  },
                }),
                { engine },
              )) {
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

  // Test that WASM with streams falls back to main thread execution
  it("should work with WASM by falling back to main thread for streams", async () => {
    // WASM doesn't support streams, so it automatically falls back to main thread
    const records = [];
    for await (const record of parseStringStream(
      new ReadableStream({
        start(controller) {
          controller.enqueue("a,b\n1,2");
          controller.close();
        },
      }),
      { engine: { wasm: true } },
    )) {
      records.push(record);
    }
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual({ a: "1", b: "2" });
  });
});
