import fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";
import { autoChunk, FC } from "../../__tests__/helper.ts";
import { escapeField } from "../../utils/serialization/escapeField.ts";
import { loadWASM } from "../../wasm/loadWASM.ts";
import { CSVLexerTransformer } from "./CSVLexerTransformer.ts";
import { CSVRecordAssemblerTransformer } from "./CSVRecordAssemblerTransformer.ts";
import { WASMCSVStreamTransformer } from "./WASMCSVStreamTransformer.ts";

/**
 * Property-Based Tests for WASM CSV Stream Transformer
 *
 * These tests verify the correctness and robustness of the WASM streaming parser
 * by testing various properties that should hold for all valid inputs.
 *
 * Note: Tests exclude string16bits generation to avoid lone Unicode surrogates (U+D800-U+DFFF),
 * which are handled differently across WASM and JavaScript implementations.
 */
describe.skipIf(typeof window === "undefined")(
  "WASMCSVStreamTransformer (Property-Based Tests)",
  () => {
    beforeAll(async () => {
      await loadWASM();
    });

    describe("Basic parsing properties", () => {
      it("should parse arbitrary CSV data correctly", () =>
        fc.assert(
          fc.asyncProperty(
            fc.gen().map((g) => {
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
                fieldConstraints: {
                  kindExcludes: ["string16bits"],
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
              const expectedData =
                csvData.length >= 1
                  ? csvData.map((row) =>
                      Object.fromEntries(row.map((v, i) => [header[i], v])),
                    )
                  : [];
              return { expectedData, csv };
            }),
            async ({ expectedData, csv }) => {
              const stream = new ReadableStream({
                start(controller) {
                  controller.enqueue(csv);
                  controller.close();
                },
              });

              const records = [];
              for await (const record of stream.pipeThrough(
                new WASMCSVStreamTransformer(),
              )) {
                records.push(record);
              }

              expect(records).toEqual(expectedData);
            },
          ),
          { numRuns: 100 },
        ));

      it("should handle various delimiters correctly", () =>
        fc.assert(
          fc.asyncProperty(
            fc.gen().map((g) => {
              const header = g(FC.header, {
                fieldConstraints: { kindExcludes: ["string16bits"] },
              });
              const delimiter = g(FC.delimiter);
              const EOL = g(FC.eol);
              const csvData = g(FC.csvData, {
                columnsConstraints: {
                  minLength: header.length,
                  maxLength: header.length,
                },
                fieldConstraints: { kindExcludes: ["string16bits"] },
              });
              const csv = [
                header
                  .map((v) => escapeField(v, { quote: true, delimiter }))
                  .join(delimiter),
                ...csvData.map((row) =>
                  row
                    .map((v) => escapeField(v, { quote: true, delimiter }))
                    .join(delimiter),
                ),
              ].join(EOL);
              const expectedData =
                csvData.length >= 1
                  ? csvData.map((row) =>
                      Object.fromEntries(row.map((v, i) => [header[i], v])),
                    )
                  : [];
              return { expectedData, csv, delimiter };
            }),
            async ({ expectedData, csv, delimiter }) => {
              const stream = new ReadableStream({
                start(controller) {
                  controller.enqueue(csv);
                  controller.close();
                },
              });

              const records = [];
              for await (const record of stream.pipeThrough(
                new WASMCSVStreamTransformer({ delimiter }),
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
            fc.gen().map((g) => {
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
                  minLength: 0,
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
              const expectedData =
                csvData.length >= 1
                  ? csvData.map((row) =>
                      Object.fromEntries(row.map((v, i) => [header[i], v])),
                    )
                  : [];
              // Generate random chunks
              const chunks = autoChunk(g, csv, 1);
              return { expectedData, chunks };
            }),
            async ({ expectedData, chunks }) => {
              const stream = new ReadableStream({
                start(controller) {
                  for (const chunk of chunks) {
                    controller.enqueue(chunk);
                  }
                  controller.close();
                },
              });

              const records = [];
              for await (const record of stream.pipeThrough(
                new WASMCSVStreamTransformer(),
              )) {
                records.push(record);
              }

              expect(records).toEqual(expectedData);
            },
          ),
          { numRuns: 100 },
        ));

      it("should handle one character at a time", () =>
        fc.assert(
          fc.asyncProperty(
            fc.gen().map((g) => {
              const header = g(FC.header, {
                columnsConstraints: { minLength: 1, maxLength: 3 },
                fieldConstraints: {
                  maxLength: 5,
                  kindExcludes: ["string16bits"],
                },
              });
              const EOL = g(FC.eol);
              const csvData = g(FC.csvData, {
                columnsConstraints: {
                  minLength: header.length,
                  maxLength: header.length,
                },
                rowsConstraints: { minLength: 0, maxLength: 5 },
                fieldConstraints: {
                  maxLength: 10,
                  kindExcludes: ["string16bits"],
                },
              });
              const csv = [
                header.map((v) => escapeField(v, { quote: true })).join(","),
                ...csvData.map((row) =>
                  row.map((v) => escapeField(v, { quote: true })).join(","),
                ),
              ].join(EOL);
              const expectedData =
                csvData.length >= 1
                  ? csvData.map((row) =>
                      Object.fromEntries(row.map((v, i) => [header[i], v])),
                    )
                  : [];
              return { expectedData, csv };
            }),
            async ({ expectedData, csv }) => {
              const stream = new ReadableStream({
                start(controller) {
                  for (const char of csv) {
                    controller.enqueue(char);
                  }
                  controller.close();
                },
              });

              const records = [];
              for await (const record of stream.pipeThrough(
                new WASMCSVStreamTransformer(),
              )) {
                records.push(record);
              }

              expect(records).toEqual(expectedData);
            },
          ),
          { numRuns: 50 },
        ));
    });

    describe("Consistency with JavaScript implementation", () => {
      it("should produce same results as JavaScript CSV parser", () =>
        fc.assert(
          fc.asyncProperty(
            fc.gen().map((g) => {
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
                  minLength: 0,
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
              // Parse with WASM
              const wasmStream = new ReadableStream({
                start(controller) {
                  for (const chunk of chunks) {
                    controller.enqueue(chunk);
                  }
                  controller.close();
                },
              });
              const wasmRecords = [];
              for await (const record of wasmStream.pipeThrough(
                new WASMCSVStreamTransformer(),
              )) {
                wasmRecords.push(record);
              }

              // Parse with JavaScript
              const jsStream = new ReadableStream({
                start(controller) {
                  for (const chunk of chunks) {
                    controller.enqueue(chunk);
                  }
                  controller.close();
                },
              });
              const jsRecords = [];
              for await (const record of jsStream
                .pipeThrough(new CSVLexerTransformer())
                .pipeThrough(new CSVRecordAssemblerTransformer())) {
                jsRecords.push(record);
              }

              expect(wasmRecords).toEqual(jsRecords);
            },
          ),
          { numRuns: 100 },
        ));
    });

    describe("Edge cases", () => {
      it("should handle empty CSV", () =>
        fc.assert(
          fc.asyncProperty(
            FC.header({ fieldConstraints: { kindExcludes: ["string16bits"] } }),
            async (header) => {
              const csv = header
                .map((v) => escapeField(v, { quote: true }))
                .join(",");

              const stream = new ReadableStream({
                start(controller) {
                  controller.enqueue(csv);
                  controller.close();
                },
              });

              const records = [];
              for await (const record of stream.pipeThrough(
                new WASMCSVStreamTransformer(),
              )) {
                records.push(record);
              }

              expect(records).toEqual([]);
            },
          ),
          { numRuns: 20 },
        ));

      it("should handle CSV with empty fields", () =>
        fc.assert(
          fc.asyncProperty(
            fc.gen().map((g) => {
              const header = g(FC.header, {
                fieldConstraints: { kindExcludes: ["string16bits"] },
              });
              const EOL = g(FC.eol);
              const csvData = g(FC.csvData, {
                columnsConstraints: {
                  minLength: header.length,
                  maxLength: header.length,
                },
                fieldConstraints: { kindExcludes: ["string16bits"] },
                // Note: Don't use sparse arrays as they create unrealistic CSV patterns
              });
              // Create CSV with some empty fields manually
              const csvWithEmptyFields = csvData.map((row) =>
                row.map((v, _i) => {
                  // Randomly make some fields empty
                  if (g(fc.boolean) && v !== "") {
                    return "";
                  }
                  return v;
                }),
              );
              const csv = [
                header.map((v) => escapeField(v, { quote: true })).join(","),
                ...csvWithEmptyFields.map((row) =>
                  row.map((v) => escapeField(v, { quote: true })).join(","),
                ),
              ].join(EOL);
              const expectedData =
                csvWithEmptyFields.length >= 1
                  ? csvWithEmptyFields.map((row) =>
                      Object.fromEntries(row.map((v, i) => [header[i], v])),
                    )
                  : [];
              return { expectedData, csv };
            }),
            async ({ expectedData, csv }) => {
              const stream = new ReadableStream({
                start(controller) {
                  controller.enqueue(csv);
                  controller.close();
                },
              });

              const records = [];
              for await (const record of stream.pipeThrough(
                new WASMCSVStreamTransformer(),
              )) {
                records.push(record);
              }

              expect(records).toEqual(expectedData);
            },
          ),
          { numRuns: 50 },
        ));

      it("should handle various line endings (LF, CRLF)", () =>
        fc.assert(
          fc.asyncProperty(
            fc.gen().map((g) => {
              const header = g(FC.header, {
                fieldConstraints: { kindExcludes: ["string16bits"] },
              });
              const EOL = g(FC.eol); // Randomly choose LF or CRLF
              const csvData = g(FC.csvData, {
                columnsConstraints: {
                  minLength: header.length,
                  maxLength: header.length,
                },
                rowsConstraints: { maxLength: 10 },
                fieldConstraints: { kindExcludes: ["string16bits"] },
              });
              const csv = [
                header.map((v) => escapeField(v, { quote: true })).join(","),
                ...csvData.map((row) =>
                  row.map((v) => escapeField(v, { quote: true })).join(","),
                ),
              ].join(EOL);
              const expectedData =
                csvData.length >= 1
                  ? csvData.map((row) =>
                      Object.fromEntries(row.map((v, i) => [header[i], v])),
                    )
                  : [];
              return { expectedData, csv };
            }),
            async ({ expectedData, csv }) => {
              const stream = new ReadableStream({
                start(controller) {
                  controller.enqueue(csv);
                  controller.close();
                },
              });

              const records = [];
              for await (const record of stream.pipeThrough(
                new WASMCSVStreamTransformer(),
              )) {
                records.push(record);
              }

              expect(records).toEqual(expectedData);
            },
          ),
          { numRuns: 50 },
        ));
    });
  },
);
