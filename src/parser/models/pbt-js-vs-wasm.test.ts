/**
 * Property-Based Testing: JS vs WASM Implementation Comparison
 *
 * This test suite compares JS and WASM implementations to ensure they produce
 * identical results for Parser components.
 *
 * Note: Legacy Lexer and Assembler comparison tests were removed when
 * BinaryCSVLexerLegacy and CSVRecordAssemblerLegacy were removed from WASM.
 */

import * as fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";
import { loadWASM } from "../../wasm/loaders/loadWASM.node.js";
import { FlexibleBinaryObjectCSVParser } from "./FlexibleBinaryObjectCSVParser.js";
// WASM Implementation
import { WASMBinaryObjectCSVParser } from "./WASMBinaryObjectCSVParser.js";

// ===========================
// CSV Data Generators
// ===========================

/**
 * Generate a valid CSV field value
 */
const csvFieldArbitrary = fc.oneof(
  // Simple ASCII fields
  fc.stringMatching(/^[a-zA-Z0-9_-]{0,20}$/),
  // Fields with spaces
  fc.stringMatching(/^[a-zA-Z0-9 ]{0,20}$/),
  // Empty fields
  fc.constant(""),
  // Fields with UTF-8 characters
  fc.oneof(
    fc.constant("東京"),
    fc.constant("ニューヨーク"),
    fc.constant("Москва"),
    fc.constant("中文"),
  ),
  // Numeric fields
  fc
    .integer()
    .map(String),
  fc.float().map(String),
);

/**
 * Generate unique header names (for use as CSV headers)
 * Ensures no duplicate headers by appending index to each field
 */
const csvHeaderArbitrary = fc
  .array(csvFieldArbitrary, { minLength: 2, maxLength: 5 })
  .map((headers) => {
    // Make headers unique by appending index, and filter out empty strings
    return headers.map((h, i) => {
      const base = h || "field";
      return `${base}_${i}`;
    });
  });

/**
 * Convert CSV data to string format
 */
function toCSVString(headers: string[], rows: string[][]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

/**
 * Convert string to Uint8Array
 * Returns Uint8Array<ArrayBuffer> to satisfy BufferSource type requirements
 */
function toUint8Array(str: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(str) as Uint8Array<ArrayBuffer>;
}

/**
 * Normalize record for comparison (deep sort keys for stable comparison)
 */
function normalizeRecord(record: any): any {
  if (Array.isArray(record)) {
    return record;
  }
  if (typeof record === "object" && record !== null) {
    const sorted: any = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = record[key];
    }
    return sorted;
  }
  return record;
}

// ===========================
// Test Suite
// ===========================

describe("Property-Based Testing: JS vs WASM", () => {
  beforeAll(async () => {
    await loadWASM();
  });

  describe("Parser Comparison (End-to-End)", () => {
    it("should produce identical records for simple CSV data", () => {
      fc.assert(
        fc.property(
          csvHeaderArbitrary,
          fc.array(
            fc.array(csvFieldArbitrary, { minLength: 2, maxLength: 5 }),
            { minLength: 1, maxLength: 10 },
          ),
          (headers, rows) => {
            // Ensure all rows have same length as headers
            const normalizedRows = rows.map((row) =>
              row
                .slice(0, headers.length)
                .concat(
                  Array(Math.max(0, headers.length - row.length)).fill(""),
                ),
            );

            const csvString = toCSVString(headers, normalizedRows);
            const csvBytes = toUint8Array(csvString);

            // JS Parser (binary input)
            const jsParser = new FlexibleBinaryObjectCSVParser({
              delimiter: ",",
            });
            const jsRecords = Array.from(jsParser.parse(csvBytes));

            // WASM Parser (binary input)
            const wasmParser = new WASMBinaryObjectCSVParser({
              delimiter: ",",
            });
            const wasmRecords = Array.from(wasmParser.parse(csvBytes));

            // Normalize records
            const normalizedJs = jsRecords.map(normalizeRecord);
            const normalizedWasm = wasmRecords.map(normalizeRecord);

            expect(normalizedWasm).toEqual(normalizedJs);
          },
        ),
        { numRuns: 50 },
      );
    });

    it("should handle streaming mode identically", () => {
      fc.assert(
        fc.property(
          csvHeaderArbitrary,
          fc.array(csvFieldArbitrary, { minLength: 2, maxLength: 5 }),
          (headers, row1) => {
            const normalizedRow1 = row1.slice(0, headers.length);
            const csvString = toCSVString(headers, [normalizedRow1]);
            const csvBytes = toUint8Array(csvString);

            // Split into chunks
            const midpoint = Math.floor(csvBytes.length / 2);
            const chunk1 = csvBytes.slice(0, midpoint);
            const chunk2 = csvBytes.slice(midpoint);

            // JS Parser - streaming
            const jsParser = new FlexibleBinaryObjectCSVParser({
              delimiter: ",",
            });
            const jsRecords1 = Array.from(
              jsParser.parse(chunk1, { stream: true }),
            );
            const jsRecords2 = Array.from(
              jsParser.parse(chunk2, { stream: false }),
            );
            const jsRecordsAll = [...jsRecords1, ...jsRecords2];

            // WASM Parser - streaming
            const wasmParser = new WASMBinaryObjectCSVParser({
              delimiter: ",",
            });
            const wasmRecords1 = Array.from(
              wasmParser.parse(chunk1, { stream: true }),
            );
            const wasmRecords2 = Array.from(
              wasmParser.parse(chunk2, { stream: false }),
            );
            const wasmRecordsAll = [...wasmRecords1, ...wasmRecords2];

            // Normalize and compare
            const normalizedJs = jsRecordsAll.map(normalizeRecord);
            const normalizedWasm = wasmRecordsAll.map(normalizeRecord);

            expect(normalizedWasm).toEqual(normalizedJs);
          },
        ),
        { numRuns: 50 },
      );
    });

    it("should handle quoted fields identically", () => {
      const testCases = [
        'name,description\n"Alice","Hello, World"\n"Bob","Contains ""quotes"""\n',
        'a,b\n"value,with,commas","normal"\n',
        'a,b\n"multi\nline\ntext","normal"\n',
      ];

      for (const csvString of testCases) {
        const csvBytes = toUint8Array(csvString);

        // JS Parser
        const jsParser = new FlexibleBinaryObjectCSVParser({ delimiter: "," });
        const jsRecords = Array.from(jsParser.parse(csvBytes));

        // WASM Parser
        const wasmParser = new WASMBinaryObjectCSVParser({ delimiter: "," });
        const wasmRecords = Array.from(wasmParser.parse(csvBytes));

        // Normalize and compare
        const normalizedJs = jsRecords.map(normalizeRecord);
        const normalizedWasm = wasmRecords.map(normalizeRecord);

        expect(normalizedWasm).toEqual(normalizedJs);
      }
    });

    it("should handle UTF-8 characters identically", () => {
      const testCases = [
        "name,city\nAlice,東京\nBob,大阪\n",
        "name,city\nАлиса,Москва\nБоб,Киев\n",
      ];

      for (const csvString of testCases) {
        const csvBytes = toUint8Array(csvString);

        // JS Parser
        const jsParser = new FlexibleBinaryObjectCSVParser({ delimiter: "," });
        const jsRecords = Array.from(jsParser.parse(csvBytes));

        // WASM Parser
        const wasmParser = new WASMBinaryObjectCSVParser({ delimiter: "," });
        const wasmRecords = Array.from(wasmParser.parse(csvBytes));

        // Normalize and compare
        const normalizedJs = jsRecords.map(normalizeRecord);
        const normalizedWasm = wasmRecords.map(normalizeRecord);

        expect(normalizedWasm).toEqual(normalizedJs);
      }
    });

    it("should return undefined for missing columns (not empty string)", () => {
      // CSV with missing columns (rows have fewer columns than headers)
      const testCases = [
        // 3 columns header, first row has only 1 column
        {
          csv: "name,age,city\nBob\n",
          expectedFields: ["name", "age", "city"],
          expectedUndefinedFields: ["age", "city"],
        },
        // 3 columns header, first row has 2 columns
        {
          csv: "name,age,city\nBob,30\n",
          expectedFields: ["name", "age", "city"],
          expectedUndefinedFields: ["city"],
        },
        // Empty values at the end (should be empty string, not undefined)
        {
          csv: "name,age,city\nBob,30,\n",
          expectedFields: ["name", "age", "city"],
          expectedUndefinedFields: [], // city is present but empty
        },
        // Empty value in the middle (should be empty string, not undefined)
        {
          csv: "name,age,city\nBob,,Tokyo\n",
          expectedFields: ["name", "age", "city"],
          expectedUndefinedFields: [], // age is present but empty
        },
      ];

      for (const {
        csv,
        expectedFields,
        expectedUndefinedFields,
      } of testCases) {
        const csvBytes = toUint8Array(csv);

        // JS Parser
        const jsParser = new FlexibleBinaryObjectCSVParser({ delimiter: "," });
        const jsRecords = Array.from(jsParser.parse(csvBytes));

        // WASM Parser
        const wasmParser = new WASMBinaryObjectCSVParser({ delimiter: "," });
        const wasmRecords = Array.from(wasmParser.parse(csvBytes));

        // Both parsers should return at least 1 record
        expect(jsRecords.length).toBeGreaterThan(0);
        expect(wasmRecords.length).toBeGreaterThan(0);

        // Check JS parser returns undefined for missing fields
        const jsRecord = jsRecords[0] as Record<string, string | undefined>;
        for (const field of expectedFields) {
          expect(field in jsRecord).toBe(true);
        }
        for (const field of expectedUndefinedFields) {
          expect(jsRecord[field]).toBeUndefined();
        }

        // Check WASM parser returns undefined for missing fields (same as JS)
        const wasmRecord = wasmRecords[0] as Record<string, string | undefined>;
        for (const field of expectedFields) {
          expect(field in wasmRecord).toBe(true);
        }
        for (const field of expectedUndefinedFields) {
          expect(wasmRecord[field]).toBeUndefined();
        }

        // Final check: both implementations should be identical
        expect(wasmRecord).toEqual(jsRecord);
      }
    });
  });
});
