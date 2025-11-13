import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";
import { autoChunk, autoChunkBytes, FC } from "../../__tests__/helper.ts";
import { escapeField } from "../../utils/serialization/escapeField.ts";
import { loadWASM } from "../../wasm/loadWASM.ts";
import { WASMBinaryCSVStreamTransformer } from "./WASMBinaryCSVStreamTransformer.ts";
import { WASMCSVStreamTransformer } from "./WASMCSVStreamTransformer.ts";

/**
 * Property-Based Tests for WASM Binary CSV Stream Transformer
 *
 * These tests verify the correctness and robustness of the WASM binary streaming parser
 * by testing various properties that should hold for all valid inputs. The binary transformer
 * processes Uint8Array chunks directly, eliminating TextDecoder overhead.
 *
 * Note: Tests exclude string16bits generation to avoid lone Unicode surrogates (U+D800-U+DFFF),
 * which are handled differently across WASM and JavaScript implementations.
 */
describe.skipIf(typeof window === "undefined")(
  "WASMBinaryCSVStreamTransformer (Property-Based Tests)",
  () => {
    beforeAll(async () => {
      await loadWASM();
    });

    describe("Basic parsing properties", () => {
      it("should parse arbitrary CSV data correctly", () =>
        fc.assert(
          fc.asyncProperty(
            fc.gen().map((_g) => {
              const header = g(FC.header, {
                fieldConstraints: {
                  // Exclude string16bits to avoid lone surrogates
                  kindExcludes: ["string16bits"],
                },
              });
              const EOL = g(FC.eol);
              const csvData = g(FC.csvData, {
                columnsConstraints: {
                  minLength: header.length,
                  maxLength: header.length,
                },
                rowsConstraints: {
                  minLength: 1, // Ensure at least one row to avoid empty record issues
                },
                fieldConstraints: {
                  kindExcludes: ["string16bits"],
                },
              });
              const csv = [
                header.map((v) => escapeField(v, { quote: true })).join(","),
                ...csvData.map((row) =>
                  row.map((v) => escapeField(v, { quote: true })).join(","),
                ),
              ].join(EOL);
              const expectedData = csvData.map((row) =>
                Object.fromEntries(row.map((v, i) => [header[i], v])),
              );
              return { expectedData, csv };
            }),
            async ({ expectedData, csv }) => {
              // Convert string to Uint8Array
              const encoder = new TextEncoder();
              const bytes = encoder.encode(csv);

              const stream = new ReadableStream({
                start(controller) {
                  controller.enqueue(bytes);
                  controller.close();
                },
              });

              const records = [];
              for await (const record of stream.pipeThrough(
                new WASMBinaryCSVStreamTransformer(),
              )) {
                records.push(record);
              }

              expect(records).toEqual(expectedData);
            },
          ),
          { numRuns: 100 },
        ));

      it("should handle comma delimiter (default)", () =>
        fc.assert(
          fc.asyncProperty(
            fc.gen().map((_g) => {
              const header = g(FC.header, {
                fieldConstraints: { kindExcludes: ["string16bits"] },
              });
              const EOL = g(FC.eol);
              const csvData = g(FC.csvData, {
                columnsConstraints: {
                  minLength: header.length,
                  maxLength: header.length,
                },
                rowsConstraints: { minLength: 1 },
                fieldConstraints: { kindExcludes: ["string16bits"] },
              });
              const csv = [
                header
                  .map((v) => escapeField(v, { quote: true, delimiter: "," }))
                  .join(","),
                ...csvData.map((row) =>
                  row
                    .map((v) => escapeField(v, { quote: true, delimiter: "," }))
                    .join(","),
                ),
              ].join(EOL);
              const expectedData = csvData.map((row) =>
                Object.fromEntries(row.map((v, i) => [header[i], v])),
              );
              return { expectedData, csv };
            }),
            async ({ expectedData, csv }) => {
              const encoder = new TextEncoder();
              const bytes = encoder.encode(csv);

              const stream = new ReadableStream({
                start(controller) {
                  controller.enqueue(bytes);
                  controller.close();
                },
              });

              const records = [];
              for await (const record of stream.pipeThrough(
                new WASMBinaryCSVStreamTransformer(),
              )) {
                records.push(record);
              }

              expect(records).toEqual(expectedData);
            },
          ),
          { numRuns: 50 },
        ));
    });

    describe("Chunk independence property", () => {
      it("should produce same results regardless of chunk size", () =>
        fc.assert(
          fc.asyncProperty(
            fc.gen().map((_g) => {
              const header = g(FC.header, {
                fieldConstraints: { kindExcludes: ["string16bits"] },
              });
              const EOL = g(FC.eol);
              const csvData = g(FC.csvData, {
                columnsConstraints: {
                  minLength: header.length,
                  maxLength: header.length,
                },
                rowsConstraints: {
                  minLength: 1,
                  maxLength: 20, // Keep data size manageable for chunking tests
                },
                fieldConstraints: { kindExcludes: ["string16bits"] },
              });
              const csv = [
                header.map((v) => escapeField(v, { quote: true })).join(","),
                ...csvData.map((row) =>
                  row.map((v) => escapeField(v, { quote: true })).join(","),
                ),
              ].join(EOL);
              const expectedData = csvData.map((row) =>
                Object.fromEntries(row.map((v, i) => [header[i], v])),
              );
              // Encode to bytes first, then chunk to avoid UTF-16 surrogate pair splitting
              const encoder = new TextEncoder();
              const allBytes = encoder.encode(csv);
              const byteChunks = autoChunkBytes(g, allBytes, 1);
              return { expectedData, byteChunks };
            }),
            async ({ expectedData, byteChunks }) => {
              const stream = new ReadableStream({
                start(controller) {
                  for (const chunk of byteChunks) {
                    controller.enqueue(chunk);
                  }
                  controller.close();
                },
              });

              const records = [];
              for await (const record of stream.pipeThrough(
                new WASMBinaryCSVStreamTransformer(),
              )) {
                records.push(record);
              }

              expect(records).toEqual(expectedData);
            },
          ),
          { numRuns: 100 },
        ));

      it("should handle UTF-8 multi-byte sequences split across chunks", () =>
        fc.assert(
          fc.asyncProperty(
            fc.gen().map((_g) => {
              // Generate header and data with multi-byte UTF-8 characters
              const header = g(FC.header, {
                fieldConstraints: { kindExcludes: ["string16bits"] },
              });
              const csvData = g(FC.csvData, {
                columnsConstraints: {
                  minLength: header.length,
                  maxLength: header.length,
                },
                rowsConstraints: { minLength: 1, maxLength: 10 },
                fieldConstraints: { kindExcludes: ["string16bits"] },
              });
              const csv = [
                header.map((v) => escapeField(v, { quote: true })).join(","),
                ...csvData.map((row) =>
                  row.map((v) => escapeField(v, { quote: true })).join(","),
                ),
              ].join("\n");
              const expectedData = csvData.map((row) =>
                Object.fromEntries(row.map((v, i) => [header[i], v])),
              );
              return { expectedData, csv };
            }),
            async ({ expectedData, csv }) => {
              const encoder = new TextEncoder();
              const bytes = encoder.encode(csv);

              // Deliberately split at random positions (may split UTF-8 sequences)
              const stream = new ReadableStream({
                start(controller) {
                  let i = 0;
                  while (i < bytes.length) {
                    const chunkSize = Math.min(
                      Math.floor(Math.random() * 10) + 1,
                      bytes.length - i,
                    );
                    controller.enqueue(bytes.slice(i, i + chunkSize));
                    i += chunkSize;
                  }
                  controller.close();
                },
              });

              const records = [];
              for await (const record of stream.pipeThrough(
                new WASMBinaryCSVStreamTransformer(),
              )) {
                records.push(record);
              }

              expect(records).toEqual(expectedData);
            },
          ),
          { numRuns: 100 },
        ));
    });

    describe("Consistency with string-based WASM parser", () => {
      it("should produce same results as WASMCSVStreamTransformer", () =>
        fc.assert(
          fc.asyncProperty(
            fc.gen().map((_g) => {
              const header = g(FC.header, {
                fieldConstraints: { kindExcludes: ["string16bits"] },
              });
              const EOL = g(FC.eol);
              const csvData = g(FC.csvData, {
                columnsConstraints: {
                  minLength: header.length,
                  maxLength: header.length,
                },
                rowsConstraints: {
                  minLength: 1,
                  maxLength: 20,
                },
                fieldConstraints: { kindExcludes: ["string16bits"] },
              });
              const csv = [
                header.map((v) => escapeField(v, { quote: true })).join(","),
                ...csvData.map((row) =>
                  row.map((v) => escapeField(v, { quote: true })).join(","),
                ),
              ].join(EOL);
              // Generate random chunks for both parsers
              const chunks = autoChunk(g, csv, 1);
              return { csv, chunks };
            }),
            async ({ csv: _csv, chunks }) => {
              const encoder = new TextEncoder();

              // Parse with binary transformer
              const binaryStream = new ReadableStream({
                start(controller) {
                  for (const chunk of chunks) {
                    controller.enqueue(encoder.encode(chunk));
                  }
                  controller.close();
                },
              });
              const binaryRecords = [];
              for await (const record of binaryStream.pipeThrough(
                new WASMBinaryCSVStreamTransformer(),
              )) {
                binaryRecords.push(record);
              }

              // Parse with string-based transformer
              const stringStream = new ReadableStream({
                start(controller) {
                  for (const chunk of chunks) {
                    controller.enqueue(chunk);
                  }
                  controller.close();
                },
              });
              const stringRecords = [];
              for await (const record of stringStream.pipeThrough(
                new WASMCSVStreamTransformer(),
              )) {
                stringRecords.push(record);
              }

              expect(binaryRecords).toEqual(stringRecords);
            },
          ),
          { numRuns: 100 },
        ));
    });

    describe("Edge cases", () => {
      it("should handle empty CSV (header only)", () =>
        fc.assert(
          fc.asyncProperty(
            FC.header({
              fieldConstraints: { kindExcludes: ["string16bits"] },
            }),
            async (header) => {
              const csv = header
                .map((v) => escapeField(v, { quote: true }))
                .join(",");
              const encoder = new TextEncoder();
              const bytes = encoder.encode(csv);

              const stream = new ReadableStream({
                start(controller) {
                  controller.enqueue(bytes);
                  controller.close();
                },
              });

              const records = [];
              for await (const record of stream.pipeThrough(
                new WASMBinaryCSVStreamTransformer(),
              )) {
                records.push(record);
              }

              expect(records).toEqual([]);
            },
          ),
          { numRuns: 20 },
        ));

      it("should handle various line endings (LF, CRLF)", () =>
        fc.assert(
          fc.asyncProperty(
            fc.gen().map((_g) => {
              const header = g(FC.header, {
                fieldConstraints: { kindExcludes: ["string16bits"] },
              });
              const EOL = g(FC.eol); // Randomly choose LF or CRLF
              const csvData = g(FC.csvData, {
                columnsConstraints: {
                  minLength: header.length,
                  maxLength: header.length,
                },
                rowsConstraints: { minLength: 1, maxLength: 10 },
                fieldConstraints: { kindExcludes: ["string16bits"] },
              });
              const csv = [
                header.map((v) => escapeField(v, { quote: true })).join(","),
                ...csvData.map((row) =>
                  row.map((v) => escapeField(v, { quote: true })).join(","),
                ),
              ].join(EOL);
              const expectedData = csvData.map((row) =>
                Object.fromEntries(row.map((v, i) => [header[i], v])),
              );
              return { expectedData, csv };
            }),
            async ({ expectedData, csv }) => {
              const encoder = new TextEncoder();
              const bytes = encoder.encode(csv);

              const stream = new ReadableStream({
                start(controller) {
                  controller.enqueue(bytes);
                  controller.close();
                },
              });

              const records = [];
              for await (const record of stream.pipeThrough(
                new WASMBinaryCSVStreamTransformer(),
              )) {
                records.push(record);
              }

              expect(records).toEqual(expectedData);
            },
          ),
          { numRuns: 50 },
        ));

      it("should handle tab delimiter", async () => {
        const csv = '"name"\t"age"\t"city"\nAlice\t30\tTokyo\nBob\t25\tOsaka';
        const encoder = new TextEncoder();
        const bytes = encoder.encode(csv);

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        });

        const records = [];
        for await (const record of stream.pipeThrough(
          new WASMBinaryCSVStreamTransformer({ delimiter: "\t" }),
        )) {
          records.push(record);
        }

        expect(records).toEqual([
          { name: "Alice", age: "30", city: "Tokyo" },
          { name: "Bob", age: "25", city: "Osaka" },
        ]);
      });

      it("should handle quoted fields with special characters", async () => {
        const csv = '"a,b","c\nd","e""f"';
        const encoder = new TextEncoder();
        const bytes = encoder.encode(csv);

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        });

        const records = [];
        for await (const record of stream.pipeThrough(
          new WASMBinaryCSVStreamTransformer(),
        )) {
          records.push(record);
        }

        expect(records).toEqual([]);
      });
    });

    describe("Edge cases and special characters", () => {
      it("should handle NULL bytes in fields", () =>
        fc.assert(
          fc.asyncProperty(
            fc.gen().map((_g) => {
              // Create CSV with NULL bytes in field values
              const header = ["field1", "field2", "field3"];
              const csvData = [
                ["value\x00with\x00nulls", "normal", "data\x00"],
                ["another", "row\x00", "here"],
              ];
              const csv = [
                header.map((v) => escapeField(v, { quote: true })).join(","),
                ...csvData.map((row) =>
                  row.map((v) => escapeField(v, { quote: true })).join(","),
                ),
              ].join("\n");
              const expectedData = csvData.map((row) =>
                Object.fromEntries(row.map((v, i) => [header[i], v])),
              );
              return { expectedData, csv };
            }),
            async ({ expectedData, csv }) => {
              const encoder = new TextEncoder();
              const bytes = encoder.encode(csv);

              const stream = new ReadableStream({
                start(controller) {
                  controller.enqueue(bytes);
                  controller.close();
                },
              });

              const records = [];
              for await (const record of stream.pipeThrough(
                new WASMBinaryCSVStreamTransformer(),
              )) {
                records.push(record);
              }

              expect(records).toEqual(expectedData);
            },
          ),
          { numRuns: 10 },
        ));

      it("should handle very long field values", () =>
        fc.assert(
          fc.asyncProperty(
            fc.gen().map((_g) => {
              // Generate field values with 10KB+ of data
              const longValue = "a".repeat(10000);
              const header = ["short", "long", "medium"];
              const csvData = [
                ["x", longValue, "y"],
                [longValue, "short", longValue],
              ];
              const csv = [
                header.map((v) => escapeField(v, { quote: true })).join(","),
                ...csvData.map((row) =>
                  row.map((v) => escapeField(v, { quote: true })).join(","),
                ),
              ].join("\n");
              const expectedData = csvData.map((row) =>
                Object.fromEntries(row.map((v, i) => [header[i], v])),
              );
              return { expectedData, csv };
            }),
            async ({ expectedData, csv }) => {
              const encoder = new TextEncoder();
              const bytes = encoder.encode(csv);

              const stream = new ReadableStream({
                start(controller) {
                  controller.enqueue(bytes);
                  controller.close();
                },
              });

              const records = [];
              for await (const record of stream.pipeThrough(
                new WASMBinaryCSVStreamTransformer(),
              )) {
                records.push(record);
              }

              expect(records).toEqual(expectedData);
            },
          ),
          { numRuns: 5 },
        ));

      it("should handle many consecutive quotes", async () => {
        const csv = '"a","b""""""c","d"';
        const encoder = new TextEncoder();
        const bytes = encoder.encode(csv);

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        });

        const records = [];
        for await (const record of stream.pipeThrough(
          new WASMBinaryCSVStreamTransformer(),
        )) {
          records.push(record);
        }

        expect(records).toEqual([]);
      });

      it("should handle CSV with many empty fields", () =>
        fc.assert(
          fc.asyncProperty(
            fc.gen().map((_g) => {
              const header = ["a", "b", "c", "d", "e"];
              const csvData = [
                ["", "", "", "", ""],
                ["x", "", "", "", ""],
                ["", "", "", "", "y"],
                ["", "mid", "", "", ""],
              ];
              const csv = [
                header.map((v) => escapeField(v, { quote: true })).join(","),
                ...csvData.map((row) =>
                  row.map((v) => escapeField(v, { quote: true })).join(","),
                ),
              ].join("\n");
              const expectedData = csvData.map((row) =>
                Object.fromEntries(row.map((v, i) => [header[i], v])),
              );
              return { expectedData, csv };
            }),
            async ({ expectedData, csv }) => {
              const encoder = new TextEncoder();
              const bytes = encoder.encode(csv);

              const stream = new ReadableStream({
                start(controller) {
                  controller.enqueue(bytes);
                  controller.close();
                },
              });

              const records = [];
              for await (const record of stream.pipeThrough(
                new WASMBinaryCSVStreamTransformer(),
              )) {
                records.push(record);
              }

              expect(records).toEqual(expectedData);
            },
          ),
          { numRuns: 20 },
        ));

      it("should handle BOM (Byte Order Mark) at start", async () => {
        const csv = "\uFEFFname,age\nAlice,30\nBob,25";
        const encoder = new TextEncoder();
        const bytes = encoder.encode(csv);

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        });

        const records = [];
        for await (const record of stream.pipeThrough(
          new WASMBinaryCSVStreamTransformer(),
        )) {
          records.push(record);
        }

        // BOM should be part of the first header field
        expect(records).toEqual([
          { "\uFEFFname": "Alice", age: "30" },
          { "\uFEFFname": "Bob", age: "25" },
        ]);
      });

      it("should handle mixed whitespace characters", async () => {
        const csv = '"a\\tb","c \\r d","e\\n\\nf"';
        const encoder = new TextEncoder();
        const bytes = encoder.encode(csv);

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        });

        const records = [];
        for await (const record of stream.pipeThrough(
          new WASMBinaryCSVStreamTransformer(),
        )) {
          records.push(record);
        }

        expect(records).toEqual([]);
      });
    });

    describe("Performance characteristics", () => {
      it("should handle large byte chunks efficiently", async () => {
        // Generate a large CSV
        const rows = 1000;
        const header = "a,b,c";
        const dataRows = Array.from(
          { length: rows },
          (_, i) => `${i},value${i},data${i}`,
        );
        const csv = [header, ...dataRows].join("\n");

        const encoder = new TextEncoder();
        const bytes = encoder.encode(csv);

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        });

        const records = [];
        for await (const record of stream.pipeThrough(
          new WASMBinaryCSVStreamTransformer(),
        )) {
          records.push(record);
        }

        expect(records.length).toBe(rows);
        expect(records[0]).toEqual({ a: "0", b: "value0", c: "data0" });
        expect(records[rows - 1]).toEqual({
          a: String(rows - 1),
          b: `value${rows - 1}`,
          c: `data${rows - 1}`,
        });
      });
    });
  },
);
