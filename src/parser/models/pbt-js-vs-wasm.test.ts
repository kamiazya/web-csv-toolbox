/**
 * Property-Based Testing: JS vs WASM Implementation Comparison
 *
 * This test suite compares JS and WASM implementations to ensure they produce
 * identical results across Parser, Lexer, and Assembler components.
 */

import * as fc from "fast-check";
import { beforeAll, describe, expect, it } from "vitest";
import { TokenType } from "../../core/constants.js";
import type { ColumnCountStrategy, Token } from "../../core/types.js";
import { loadWASM } from "../../wasm/loaders/loadWASM.node.js";
import { FlexibleBinaryObjectCSVParser } from "./FlexibleBinaryObjectCSVParser.js";
import { FlexibleCSVArrayRecordAssembler } from "./FlexibleCSVArrayRecordAssembler.js";
import { FlexibleCSVObjectRecordAssembler } from "./FlexibleCSVObjectRecordAssembler.js";
// JS Implementations
import { FlexibleStringCSVLexer } from "./FlexibleStringCSVLexer.js";
// WASM Implementations
import { WASMBinaryCSVLexer } from "./WASMBinaryCSVLexer.js";
import { WASMBinaryObjectCSVParser } from "./WASMBinaryObjectCSVParser.js";
import { WASMCSVArrayRecordAssembler } from "./WASMCSVArrayRecordAssembler.js";
import { WASMCSVObjectRecordAssembler } from "./WASMCSVObjectRecordAssembler.js";

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
 * Generate a CSV field that needs quoting
 */
const quotedFieldArbitrary = fc.oneof(
  // Fields with delimiters
  fc.constant("value,with,commas"),
  fc.constant("tab\tseparated"),
  // Fields with quotes
  fc.constant('value"with"quotes'),
  fc.constant('value""escaped""quotes'),
  // Fields with newlines
  fc.constant("multi\nline\nvalue"),
  fc.constant("with\r\nCRLF"),
  // Mixed
  fc.constant('complex,"mixed",\nfield'),
);

/**
 * Generate a CSV record (array of fields)
 */
const csvRecordArbitrary = (numColumns: number) =>
  fc.array(
    fc.oneof(
      csvFieldArbitrary,
      quotedFieldArbitrary.map((field) => `"${field.replace(/"/g, '""')}"`),
    ),
    { minLength: numColumns, maxLength: numColumns },
  );

/**
 * Generate a complete CSV dataset with unique headers
 */
const csvDatasetArbitrary = fc
  .tuple(csvHeaderArbitrary, fc.nat({ max: 5 }))
  .chain(([headers, numRows]) =>
    fc.record({
      headers: fc.constant(headers),
      rows: fc.array(csvRecordArbitrary(headers.length), {
        minLength: numRows,
        maxLength: numRows,
      }),
    }),
  );

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
 * Normalize token for comparison (remove location metadata and normalize type)
 *
 * Both JS and WASM now use numeric TokenType enum (0=Field, 1=FieldDelimiter, 2=RecordDelimiter)
 * We normalize to string representation for comparison
 */
function normalizeToken(token: Token): { type: string; value: string } {
  // TokenType is now a numeric enum - map to string representation
  const typeMap: Record<TokenType, string> = {
    [TokenType.Field]: "field",
    [TokenType.FieldDelimiter]: "field-delimiter",
    [TokenType.RecordDelimiter]: "record-delimiter",
  };

  return {
    type: typeMap[token.type],
    value: token.value,
  };
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

  describe("Lexer Comparison", () => {
    it("should produce identical tokens for simple CSV data", () => {
      fc.assert(
        fc.property(csvDatasetArbitrary, (data) => {
          const { headers, rows } = data;

          // Generate CSV string
          const csvString = toCSVString(headers, rows);
          const csvBytes = toUint8Array(csvString);

          // JS Lexer (string input)
          const jsLexer = new FlexibleStringCSVLexer({ delimiter: "," });
          const jsTokens = Array.from(jsLexer.lex(csvString));

          // WASM Lexer (binary input)
          const wasmLexer = new WASMBinaryCSVLexer({ delimiter: "," });
          const wasmTokens = Array.from(wasmLexer.lex(csvBytes));

          // Normalize tokens (remove location metadata and normalize types)
          const normalizedJsTokens = jsTokens.map(normalizeToken);
          const normalizedWasmTokens = wasmTokens.map(normalizeToken);

          // Compare token sequences
          expect(normalizedWasmTokens).toEqual(normalizedJsTokens);
        }),
      );
    });

    it("should handle streaming mode identically", () => {
      fc.assert(
        fc.property(csvHeaderArbitrary, (headers) => {
          const csvString = `${headers.join(",")}\n`;

          // Split into chunks
          const midpoint = Math.floor(csvString.length / 2);
          const chunk1Str = csvString.slice(0, midpoint);
          const chunk2Str = csvString.slice(midpoint);
          const chunk1Bytes = toUint8Array(chunk1Str);
          const chunk2Bytes = toUint8Array(chunk2Str);

          // JS Lexer - streaming
          const jsLexer = new FlexibleStringCSVLexer({ delimiter: "," });
          const jsTokens1 = Array.from(
            jsLexer.lex(chunk1Str, { stream: true }),
          );
          const jsTokens2 = Array.from(
            jsLexer.lex(chunk2Str, { stream: false }),
          );
          const jsTokensAll = [...jsTokens1, ...jsTokens2];

          // WASM Lexer - streaming
          const wasmLexer = new WASMBinaryCSVLexer({ delimiter: "," });
          const wasmTokens1 = Array.from(
            wasmLexer.lex(chunk1Bytes, { stream: true }),
          );
          const wasmTokens2 = Array.from(
            wasmLexer.lex(chunk2Bytes, { stream: false }),
          );
          const wasmTokensAll = [...wasmTokens1, ...wasmTokens2];

          // Normalize and compare
          const normalizedJs = jsTokensAll.map(normalizeToken);
          const normalizedWasm = wasmTokensAll.map(normalizeToken);

          expect(normalizedWasm).toEqual(normalizedJs);
        }),
        { numRuns: 50 },
      );
    });

    it("should handle quoted fields with special characters identically", () => {
      const testCases = [
        'name,description\n"Alice","Hello, World"\n"Bob","Contains ""quotes"""\n',
        'a,b\n"value,with,commas","normal"\n',
        'a,b\n"multi\nline\ntext","normal"\n',
        'a,b\n"mixed,\nspecial""chars","test"\n',
      ];

      for (const csvString of testCases) {
        const csvBytes = toUint8Array(csvString);

        // JS Lexer
        const jsLexer = new FlexibleStringCSVLexer({ delimiter: "," });
        const jsTokens = Array.from(jsLexer.lex(csvString));

        // WASM Lexer
        const wasmLexer = new WASMBinaryCSVLexer({ delimiter: "," });
        const wasmTokens = Array.from(wasmLexer.lex(csvBytes));

        // Normalize and compare
        const normalizedJs = jsTokens.map(normalizeToken);
        const normalizedWasm = wasmTokens.map(normalizeToken);

        expect(normalizedWasm).toEqual(normalizedJs);
      }
    });

    it("should handle UTF-8 characters identically", () => {
      const testCases = [
        "name,city\nAlice,東京\nBob,大阪\n",
        "name,city\nАлиса,Москва\nБоб,Киев\n",
        "name,city\n李明,北京\n王芳,上海\n",
      ];

      for (const csvString of testCases) {
        const csvBytes = toUint8Array(csvString);

        // JS Lexer
        const jsLexer = new FlexibleStringCSVLexer({ delimiter: "," });
        const jsTokens = Array.from(jsLexer.lex(csvString));

        // WASM Lexer
        const wasmLexer = new WASMBinaryCSVLexer({ delimiter: "," });
        const wasmTokens = Array.from(wasmLexer.lex(csvBytes));

        // Normalize and compare
        const normalizedJs = jsTokens.map(normalizeToken);
        const normalizedWasm = wasmTokens.map(normalizeToken);

        expect(normalizedWasm).toEqual(normalizedJs);
      }
    });
  });

  describe("Assembler Comparison", () => {
    it("should produce identical records from tokens", () => {
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
              row.slice(0, headers.length),
            );

            const csvString = toCSVString(headers, normalizedRows);

            // Get tokens from JS Lexer (as reference)
            const jsLexer = new FlexibleStringCSVLexer({ delimiter: "," });
            const tokens = Array.from(jsLexer.lex(csvString));

            // JS Assembler
            const jsAssembler = new FlexibleCSVObjectRecordAssembler();
            const jsRecords = Array.from(jsAssembler.assemble(tokens));

            // WASM Assembler
            const wasmAssembler = new WASMCSVObjectRecordAssembler();
            const wasmRecords = Array.from(wasmAssembler.assemble(tokens));

            // Normalize records (sort keys)
            const normalizedJs = jsRecords.map(normalizeRecord);
            const normalizedWasm = wasmRecords.map(normalizeRecord);

            expect(normalizedWasm).toEqual(normalizedJs);
          },
        ),
        { numRuns: 50 },
      );
    });

    it("should handle missing fields identically", () => {
      const testCases = [
        "name,age,city\nBob\n",
        "name,age,city\nBob,\n",
        "name,age,city\nBob,,\n",
        "name,age,city\n,30,\n",
      ];

      for (const csvString of testCases) {
        // Get tokens
        const jsLexer = new FlexibleStringCSVLexer({ delimiter: "," });
        const tokens = Array.from(jsLexer.lex(csvString));

        // JS Assembler
        const jsAssembler = new FlexibleCSVObjectRecordAssembler();
        const jsRecords = Array.from(jsAssembler.assemble(tokens));

        // WASM Assembler
        const wasmAssembler = new WASMCSVObjectRecordAssembler();
        const wasmRecords = Array.from(wasmAssembler.assemble(tokens));

        // Normalize and compare
        const normalizedJs = jsRecords.map(normalizeRecord);
        const normalizedWasm = wasmRecords.map(normalizeRecord);

        expect(normalizedWasm).toEqual(normalizedJs);
      }
    });
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

  // ===========================
  // Options Comparison Tests
  // ===========================

  describe("Assembler Options Comparison", () => {
    describe("skipEmptyLines option", () => {
      it("should handle skipEmptyLines identically for object format", () => {
        const testCases = [
          "name,age\nAlice,30\n\nBob,25\n", // empty line in middle
          "name,age\n\n\nAlice,30\n", // multiple empty lines at start
          "name,age\nAlice,30\n\n", // empty line at end
        ];

        for (const csvString of testCases) {
          // Get tokens from JS Lexer
          const jsLexer = new FlexibleStringCSVLexer({ delimiter: "," });
          const tokens = Array.from(jsLexer.lex(csvString));

          // With skipEmptyLines: false (default)
          const jsAssemblerDefault = new FlexibleCSVObjectRecordAssembler({
            skipEmptyLines: false,
          });
          const wasmAssemblerDefault = new WASMCSVObjectRecordAssembler({
            skipEmptyLines: false,
          });
          const jsRecordsDefault = Array.from(
            jsAssemblerDefault.assemble(tokens),
          );
          const wasmRecordsDefault = Array.from(
            wasmAssemblerDefault.assemble(tokens),
          );
          expect(wasmRecordsDefault.map(normalizeRecord)).toEqual(
            jsRecordsDefault.map(normalizeRecord),
          );

          // With skipEmptyLines: true
          const jsAssemblerSkip = new FlexibleCSVObjectRecordAssembler({
            skipEmptyLines: true,
          });
          const wasmAssemblerSkip = new WASMCSVObjectRecordAssembler({
            skipEmptyLines: true,
          });
          const jsRecordsSkip = Array.from(jsAssemblerSkip.assemble(tokens));
          const wasmRecordsSkip = Array.from(
            wasmAssemblerSkip.assemble(tokens),
          );
          expect(wasmRecordsSkip.map(normalizeRecord)).toEqual(
            jsRecordsSkip.map(normalizeRecord),
          );
        }
      });

      it("should handle skipEmptyLines identically for array format", () => {
        const testCases = [
          "name,age\nAlice,30\n\nBob,25\n",
          "name,age\n\n\nAlice,30\n",
        ];

        for (const csvString of testCases) {
          const jsLexer = new FlexibleStringCSVLexer({ delimiter: "," });
          const tokens = Array.from(jsLexer.lex(csvString));

          // With skipEmptyLines: true
          const jsAssembler = new FlexibleCSVArrayRecordAssembler({
            skipEmptyLines: true,
          });
          const wasmAssembler = new WASMCSVArrayRecordAssembler({
            skipEmptyLines: true,
          });
          const jsRecords = Array.from(jsAssembler.assemble(tokens));
          const wasmRecords = Array.from(wasmAssembler.assemble(tokens));
          expect(wasmRecords).toEqual(jsRecords);
        }
      });
    });

    describe("columnCountStrategy option", () => {
      const csvWithMismatchedColumns =
        "name,age,city\nAlice,30\nBob,25,Tokyo,Extra\nCharlie,35,Osaka\n";

      it("should handle columnCountStrategy 'pad' identically", () => {
        const jsLexer = new FlexibleStringCSVLexer({ delimiter: "," });
        const tokens = Array.from(jsLexer.lex(csvWithMismatchedColumns));

        const header = ["name", "age", "city"] as const;

        // Object format with pad
        const jsObjAssembler = new FlexibleCSVObjectRecordAssembler({
          header,
          columnCountStrategy: "pad",
        });
        const wasmObjAssembler = new WASMCSVObjectRecordAssembler({
          header,
          columnCountStrategy: "pad",
        });
        const jsObjRecords = Array.from(jsObjAssembler.assemble(tokens));
        const wasmObjRecords = Array.from(wasmObjAssembler.assemble(tokens));
        expect(wasmObjRecords.map(normalizeRecord)).toEqual(
          jsObjRecords.map(normalizeRecord),
        );

        // Array format with pad
        const jsArrAssembler = new FlexibleCSVArrayRecordAssembler({
          header,
          columnCountStrategy: "pad",
        });
        const wasmArrAssembler = new WASMCSVArrayRecordAssembler({
          header,
          columnCountStrategy: "pad",
        });
        const jsArrRecords = Array.from(jsArrAssembler.assemble(tokens));
        const wasmArrRecords = Array.from(wasmArrAssembler.assemble(tokens));
        expect(wasmArrRecords).toEqual(jsArrRecords);
      });

      it("should handle columnCountStrategy 'keep' identically for array format", () => {
        const jsLexer = new FlexibleStringCSVLexer({ delimiter: "," });
        const tokens = Array.from(jsLexer.lex(csvWithMismatchedColumns));

        const header = ["name", "age", "city"] as const;

        const jsAssembler = new FlexibleCSVArrayRecordAssembler({
          header,
          columnCountStrategy: "keep",
        });
        const wasmAssembler = new WASMCSVArrayRecordAssembler({
          header,
          columnCountStrategy: "keep",
        });
        const jsRecords = Array.from(jsAssembler.assemble(tokens));
        const wasmRecords = Array.from(wasmAssembler.assemble(tokens));
        expect(wasmRecords).toEqual(jsRecords);
      });

      it("should handle columnCountStrategy 'truncate' identically", () => {
        const jsLexer = new FlexibleStringCSVLexer({ delimiter: "," });
        const tokens = Array.from(jsLexer.lex(csvWithMismatchedColumns));

        const header = ["name", "age", "city"] as const;

        // Object format with truncate
        const jsObjAssembler = new FlexibleCSVObjectRecordAssembler({
          header,
          columnCountStrategy: "truncate",
        });
        const wasmObjAssembler = new WASMCSVObjectRecordAssembler({
          header,
          columnCountStrategy: "truncate",
        });
        const jsObjRecords = Array.from(jsObjAssembler.assemble(tokens));
        const wasmObjRecords = Array.from(wasmObjAssembler.assemble(tokens));
        expect(wasmObjRecords.map(normalizeRecord)).toEqual(
          jsObjRecords.map(normalizeRecord),
        );

        // Array format with truncate
        const jsArrAssembler = new FlexibleCSVArrayRecordAssembler({
          header,
          columnCountStrategy: "truncate",
        });
        const wasmArrAssembler = new WASMCSVArrayRecordAssembler({
          header,
          columnCountStrategy: "truncate",
        });
        const jsArrRecords = Array.from(jsArrAssembler.assemble(tokens));
        const wasmArrRecords = Array.from(wasmArrAssembler.assemble(tokens));
        expect(wasmArrRecords).toEqual(jsArrRecords);
      });

      it("should handle columnCountStrategy 'strict' identically - throw error", () => {
        const jsLexer = new FlexibleStringCSVLexer({ delimiter: "," });
        const tokens = Array.from(jsLexer.lex(csvWithMismatchedColumns));

        const header = ["name", "age", "city"] as const;

        // Object format with strict - should throw
        const jsObjAssembler = new FlexibleCSVObjectRecordAssembler({
          header,
          columnCountStrategy: "strict",
        });
        const wasmObjAssembler = new WASMCSVObjectRecordAssembler({
          header,
          columnCountStrategy: "strict",
        });

        expect(() => Array.from(jsObjAssembler.assemble(tokens))).toThrow();
        expect(() => Array.from(wasmObjAssembler.assemble(tokens))).toThrow();

        // Array format with strict - should throw
        const jsArrAssembler = new FlexibleCSVArrayRecordAssembler({
          header,
          columnCountStrategy: "strict",
        });
        const wasmArrAssembler = new WASMCSVArrayRecordAssembler({
          header,
          columnCountStrategy: "strict",
        });

        expect(() => Array.from(jsArrAssembler.assemble(tokens))).toThrow();
        expect(() => Array.from(wasmArrAssembler.assemble(tokens))).toThrow();
      });
    });

    describe("includeHeader option (array format)", () => {
      it("should include header row when includeHeader is true with explicit header", () => {
        const csvString = "Alice,30\nBob,25\n"; // No header row in CSV
        const jsLexer = new FlexibleStringCSVLexer({ delimiter: "," });
        const tokens = Array.from(jsLexer.lex(csvString));

        const header = ["name", "age"] as const;

        const jsAssembler = new FlexibleCSVArrayRecordAssembler({
          header,
          includeHeader: true,
        });
        const wasmAssembler = new WASMCSVArrayRecordAssembler({
          header,
          includeHeader: true,
        });

        const jsRecords = Array.from(jsAssembler.assemble(tokens));
        const wasmRecords = Array.from(wasmAssembler.assemble(tokens));

        expect(wasmRecords).toEqual(jsRecords);
        // First record should be the header
        expect(jsRecords[0]).toEqual(["name", "age"]);
        // Second record should be data
        expect(jsRecords[1]).toEqual(["Alice", "30"]);
      });

      it("should throw error when includeHeader is true without explicit header for WASM", () => {
        // WASM requires explicit header when includeHeader is true
        expect(() => {
          new WASMCSVArrayRecordAssembler({
            includeHeader: true,
            // No header provided
          });
        }).toThrow(/includeHeader.*requires explicit header/);
      });

      it("should not include header row when includeHeader is false", () => {
        const csvString = "name,age\nAlice,30\nBob,25\n";
        const jsLexer = new FlexibleStringCSVLexer({ delimiter: "," });
        const tokens = Array.from(jsLexer.lex(csvString));

        const jsAssembler = new FlexibleCSVArrayRecordAssembler({
          includeHeader: false,
        });
        const wasmAssembler = new WASMCSVArrayRecordAssembler({
          includeHeader: false,
        });

        const jsRecords = Array.from(jsAssembler.assemble(tokens));
        const wasmRecords = Array.from(wasmAssembler.assemble(tokens));

        expect(wasmRecords).toEqual(jsRecords);
        // First record should be data, not header
        expect(jsRecords[0]).toEqual(["Alice", "30"]);
      });
    });

    describe("explicit header option", () => {
      it("should use explicit header and treat first row as data", () => {
        const csvString = "Alice,30\nBob,25\n"; // No header row
        const jsLexer = new FlexibleStringCSVLexer({ delimiter: "," });
        const tokens = Array.from(jsLexer.lex(csvString));

        const header = ["name", "age"] as const;

        // Object format
        const jsObjAssembler = new FlexibleCSVObjectRecordAssembler({ header });
        const wasmObjAssembler = new WASMCSVObjectRecordAssembler({ header });
        const jsObjRecords = Array.from(jsObjAssembler.assemble(tokens));
        const wasmObjRecords = Array.from(wasmObjAssembler.assemble(tokens));
        expect(wasmObjRecords.map(normalizeRecord)).toEqual(
          jsObjRecords.map(normalizeRecord),
        );
        expect(jsObjRecords[0]).toEqual({ name: "Alice", age: "30" });

        // Array format
        const jsArrAssembler = new FlexibleCSVArrayRecordAssembler({ header });
        const wasmArrAssembler = new WASMCSVArrayRecordAssembler({ header });
        const jsArrRecords = Array.from(jsArrAssembler.assemble(tokens));
        const wasmArrRecords = Array.from(wasmArrAssembler.assemble(tokens));
        expect(wasmArrRecords).toEqual(jsArrRecords);
        expect(jsArrRecords[0]).toEqual(["Alice", "30"]);
      });
    });

    describe("PBT: randomized options comparison", () => {
      const columnCountStrategies: ColumnCountStrategy[] = [
        "keep",
        "pad",
        "truncate",
      ];

      it("should produce identical results with various option combinations", () => {
        fc.assert(
          fc.property(
            csvHeaderArbitrary,
            fc.array(
              fc.array(csvFieldArbitrary, { minLength: 1, maxLength: 6 }),
              { minLength: 1, maxLength: 5 },
            ),
            fc.boolean(), // skipEmptyLines
            fc.constantFrom(...columnCountStrategies), // columnCountStrategy
            fc.boolean(), // includeHeader (for array format)
            (
              headers,
              rows,
              skipEmptyLines,
              columnCountStrategy,
              includeHeader,
            ) => {
              const csvString = toCSVString(headers, rows);

              // Get tokens
              const jsLexer = new FlexibleStringCSVLexer({ delimiter: "," });
              const tokens = Array.from(jsLexer.lex(csvString));

              // Array format with all options
              // Note: WASM requires explicit header when includeHeader is true
              const jsArrAssembler = new FlexibleCSVArrayRecordAssembler({
                header: headers as unknown as readonly string[],
                skipEmptyLines,
                columnCountStrategy,
                includeHeader,
              });
              const wasmArrAssembler = new WASMCSVArrayRecordAssembler({
                header: headers as unknown as readonly string[],
                skipEmptyLines,
                columnCountStrategy,
                includeHeader,
              });

              const jsArrRecords = Array.from(jsArrAssembler.assemble(tokens));
              const wasmArrRecords = Array.from(
                wasmArrAssembler.assemble(tokens),
              );
              expect(wasmArrRecords).toEqual(jsArrRecords);

              // Object format (skip 'keep' strategy as it throws TypeError)
              const objStrategy =
                columnCountStrategy === "keep" ? "pad" : columnCountStrategy;
              const jsObjAssembler = new FlexibleCSVObjectRecordAssembler({
                header: headers as unknown as readonly string[],
                skipEmptyLines,
                columnCountStrategy: objStrategy,
              });
              const wasmObjAssembler = new WASMCSVObjectRecordAssembler({
                header: headers as unknown as readonly string[],
                skipEmptyLines,
                columnCountStrategy: objStrategy,
              });

              const jsObjRecords = Array.from(jsObjAssembler.assemble(tokens));
              const wasmObjRecords = Array.from(
                wasmObjAssembler.assemble(tokens),
              );
              expect(wasmObjRecords.map(normalizeRecord)).toEqual(
                jsObjRecords.map(normalizeRecord),
              );
            },
          ),
          { numRuns: 30 },
        );
      });
    });
  });
});
