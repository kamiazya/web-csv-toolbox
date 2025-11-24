/**
 * Property-Based Testing: JS vs WASM Implementation Comparison
 *
 * This test suite compares JS and WASM implementations to ensure they produce
 * identical results across Parser, Lexer, and Assembler components.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { loadWASM } from '../../wasm/loaders/loadWASM.node.js';

// JS Implementations
import { FlexibleStringCSVLexer } from './FlexibleStringCSVLexer.js';
import { FlexibleCSVObjectRecordAssembler } from './FlexibleCSVObjectRecordAssembler.js';
import { FlexibleBinaryObjectCSVParser } from './FlexibleBinaryObjectCSVParser.js';

// WASM Implementations
import { WASMBinaryCSVLexer } from './WASMBinaryCSVLexer.js';
import { WASMCSVObjectRecordAssembler } from './WASMCSVRecordAssembler.js';
import { WASMBinaryCSVParser } from './WASMBinaryCSVParser.js';

import type { Token } from '../../core/types.js';

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
  fc.constant(''),
  // Fields with UTF-8 characters
  fc.oneof(
    fc.constant('東京'),
    fc.constant('ニューヨーク'),
    fc.constant('Москва'),
    fc.constant('中文'),
  ),
  // Numeric fields
  fc.integer().map(String),
  fc.float().map(String),
);

/**
 * Generate unique header names (for use as CSV headers)
 * Ensures no duplicate headers by appending index to each field
 */
const csvHeaderArbitrary = fc.array(csvFieldArbitrary, { minLength: 2, maxLength: 5 }).map(headers => {
  // Make headers unique by appending index, and filter out empty strings
  return headers.map((h, i) => {
    const base = h || 'field';
    return `${base}_${i}`;
  });
});

/**
 * Generate a CSV field that needs quoting
 */
const quotedFieldArbitrary = fc.oneof(
  // Fields with delimiters
  fc.constant('value,with,commas'),
  fc.constant('tab\tseparated'),
  // Fields with quotes
  fc.constant('value"with"quotes'),
  fc.constant('value""escaped""quotes'),
  // Fields with newlines
  fc.constant('multi\nline\nvalue'),
  fc.constant('with\r\nCRLF'),
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
      quotedFieldArbitrary.map(field => `"${field.replace(/"/g, '""')}"`),
    ),
    { minLength: numColumns, maxLength: numColumns }
  );

/**
 * Generate a complete CSV dataset with unique headers
 */
const csvDatasetArbitrary = fc.tuple(
  csvHeaderArbitrary,
  fc.nat({ max: 5 })
).chain(([headers, numRows]) =>
  fc.record({
    headers: fc.constant(headers),
    rows: fc.array(csvRecordArbitrary(headers.length), {
      minLength: numRows,
      maxLength: numRows
    }),
  })
);

/**
 * Convert CSV data to string format
 */
function toCSVString(headers: string[], rows: string[][]): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

/**
 * Convert string to Uint8Array
 */
function toUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Normalize token for comparison (remove location metadata and normalize type)
 *
 * JS uses Symbols for token types (e.g., Symbol(web-csv-toolbox.Field))
 * WASM uses strings (e.g., "field")
 * We normalize to string representation for comparison
 */
function normalizeToken(token: Token): { type: string, value: string } {
  let typeStr: string;

  if (typeof token.type === 'symbol') {
    // Convert Symbol to string description
    // Symbol(web-csv-toolbox.Field) -> "field"
    const symbolStr = token.type.toString();
    const match = symbolStr.match(/Symbol\(web-csv-toolbox\.(\w+)\)/);
    if (match) {
      // Convert "Field" to "field", "FieldDelimiter" to "field-delimiter", etc.
      const name = match[1];
      typeStr = name
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '');
    } else {
      typeStr = symbolStr;
    }
  } else {
    typeStr = String(token.type);
  }

  return {
    type: typeStr,
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
  if (typeof record === 'object' && record !== null) {
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

describe('Property-Based Testing: JS vs WASM', () => {
  beforeAll(async () => {
    await loadWASM();
  });

  describe('Lexer Comparison', () => {
    it('should produce identical tokens for simple CSV data', () => {
      fc.assert(
        fc.property(csvDatasetArbitrary, (data) => {
          const { headers, rows } = data;

          // Generate CSV string
          const csvString = toCSVString(headers, rows);
          const csvBytes = toUint8Array(csvString);

          // JS Lexer (string input)
          const jsLexer = new FlexibleStringCSVLexer({ delimiter: ',' });
          const jsTokens = Array.from(jsLexer.lex(csvString));

          // WASM Lexer (binary input)
          const wasmLexer = new WASMBinaryCSVLexer({ delimiter: ',' });
          const wasmTokens = Array.from(wasmLexer.lex(csvBytes));

          // Normalize tokens (remove location metadata and normalize types)
          const normalizedJsTokens = jsTokens.map(normalizeToken);
          const normalizedWasmTokens = wasmTokens.map(normalizeToken);

          // Compare token sequences
          expect(normalizedWasmTokens).toEqual(normalizedJsTokens);
        }),
        { numRuns: 50, seed: 42 }
      );
    });

    it('should handle streaming mode identically', () => {
      fc.assert(
        fc.property(
          csvHeaderArbitrary,
          (headers) => {
            const csvString = headers.join(',') + '\n';
            const csvBytes = toUint8Array(csvString);

            // Split into chunks
            const midpoint = Math.floor(csvString.length / 2);
            const chunk1Str = csvString.slice(0, midpoint);
            const chunk2Str = csvString.slice(midpoint);
            const chunk1Bytes = toUint8Array(chunk1Str);
            const chunk2Bytes = toUint8Array(chunk2Str);

            // JS Lexer - streaming
            const jsLexer = new FlexibleStringCSVLexer({ delimiter: ',' });
            const jsTokens1 = Array.from(jsLexer.lex(chunk1Str, { stream: true }));
            const jsTokens2 = Array.from(jsLexer.lex(chunk2Str, { stream: false }));
            const jsTokensAll = [...jsTokens1, ...jsTokens2];

            // WASM Lexer - streaming
            const wasmLexer = new WASMBinaryCSVLexer({ delimiter: ',' });
            const wasmTokens1 = Array.from(wasmLexer.lex(chunk1Bytes, { stream: true }));
            const wasmTokens2 = Array.from(wasmLexer.lex(chunk2Bytes, { stream: false }));
            const wasmTokensAll = [...wasmTokens1, ...wasmTokens2];

            // Normalize and compare
            const normalizedJs = jsTokensAll.map(normalizeToken);
            const normalizedWasm = wasmTokensAll.map(normalizeToken);

            expect(normalizedWasm).toEqual(normalizedJs);
          }
        ),
        { numRuns: 50, seed: 42 }
      );
    });

    it('should handle quoted fields with special characters identically', () => {
      const testCases = [
        'name,description\n"Alice","Hello, World"\n"Bob","Contains ""quotes"""\n',
        'a,b\n"value,with,commas","normal"\n',
        'a,b\n"multi\nline\ntext","normal"\n',
        'a,b\n"mixed,\nspecial""chars","test"\n',
      ];

      for (const csvString of testCases) {
        const csvBytes = toUint8Array(csvString);

        // JS Lexer
        const jsLexer = new FlexibleStringCSVLexer({ delimiter: ',' });
        const jsTokens = Array.from(jsLexer.lex(csvString));

        // WASM Lexer
        const wasmLexer = new WASMBinaryCSVLexer({ delimiter: ',' });
        const wasmTokens = Array.from(wasmLexer.lex(csvBytes));

        // Normalize and compare
        const normalizedJs = jsTokens.map(normalizeToken);
        const normalizedWasm = wasmTokens.map(normalizeToken);

        expect(normalizedWasm).toEqual(normalizedJs);
      }
    });

    it('should handle UTF-8 characters identically', () => {
      const testCases = [
        'name,city\nAlice,東京\nBob,大阪\n',
        'name,city\nАлиса,Москва\nБоб,Киев\n',
        'name,city\n李明,北京\n王芳,上海\n',
      ];

      for (const csvString of testCases) {
        const csvBytes = toUint8Array(csvString);

        // JS Lexer
        const jsLexer = new FlexibleStringCSVLexer({ delimiter: ',' });
        const jsTokens = Array.from(jsLexer.lex(csvString));

        // WASM Lexer
        const wasmLexer = new WASMBinaryCSVLexer({ delimiter: ',' });
        const wasmTokens = Array.from(wasmLexer.lex(csvBytes));

        // Normalize and compare
        const normalizedJs = jsTokens.map(normalizeToken);
        const normalizedWasm = wasmTokens.map(normalizeToken);

        expect(normalizedWasm).toEqual(normalizedJs);
      }
    });
  });

  describe('Assembler Comparison', () => {
    it('should produce identical records from tokens', () => {
      fc.assert(
        fc.property(
          csvHeaderArbitrary,
          fc.array(
            fc.array(csvFieldArbitrary, { minLength: 2, maxLength: 5 }),
            { minLength: 1, maxLength: 10 }
          ),
          (headers, rows) => {
            // Ensure all rows have same length as headers
            const normalizedRows = rows.map(row =>
              row.slice(0, headers.length)
            );

            const csvString = toCSVString(headers, normalizedRows);
            const csvBytes = toUint8Array(csvString);

            // Get tokens from JS Lexer (as reference)
            const jsLexer = new FlexibleStringCSVLexer({ delimiter: ',' });
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
          }
        ),
        { numRuns: 50, seed: 42 }
      );
    });

    it('should handle missing fields identically', () => {
      const testCases = [
        'name,age,city\nBob\n',
        'name,age,city\nBob,\n',
        'name,age,city\nBob,,\n',
        'name,age,city\n,30,\n',
      ];

      for (const csvString of testCases) {
        // Get tokens
        const jsLexer = new FlexibleStringCSVLexer({ delimiter: ',' });
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

  describe('Parser Comparison (End-to-End)', () => {
    it('should produce identical records for simple CSV data', () => {
      fc.assert(
        fc.property(
          csvHeaderArbitrary,
          fc.array(
            fc.array(csvFieldArbitrary, { minLength: 2, maxLength: 5 }),
            { minLength: 1, maxLength: 10 }
          ),
          (headers, rows) => {
            // Ensure all rows have same length as headers
            const normalizedRows = rows.map(row =>
              row.slice(0, headers.length).concat(
                Array(Math.max(0, headers.length - row.length)).fill('')
              )
            );

            const csvString = toCSVString(headers, normalizedRows);
            const csvBytes = toUint8Array(csvString);

            // JS Parser (binary input)
            const jsParser = new FlexibleBinaryObjectCSVParser({ delimiter: ',' });
            const jsRecords = Array.from(jsParser.parse(csvBytes));

            // WASM Parser (binary input)
            const wasmParser = new WASMBinaryCSVParser({ delimiter: ',' });
            const wasmRecords = Array.from(wasmParser.parse(csvBytes));

            // Normalize records
            const normalizedJs = jsRecords.map(normalizeRecord);
            const normalizedWasm = wasmRecords.map(normalizeRecord);

            expect(normalizedWasm).toEqual(normalizedJs);
          }
        ),
        { numRuns: 50, seed: 42 }
      );
    });

    it('should handle streaming mode identically', () => {
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
            const jsParser = new FlexibleBinaryObjectCSVParser({ delimiter: ',' });
            const jsRecords1 = Array.from(jsParser.parse(chunk1, { stream: true }));
            const jsRecords2 = Array.from(jsParser.parse(chunk2, { stream: false }));
            const jsRecordsAll = [...jsRecords1, ...jsRecords2];

            // WASM Parser - streaming
            const wasmParser = new WASMBinaryCSVParser({ delimiter: ',' });
            const wasmRecords1 = Array.from(wasmParser.parse(chunk1, { stream: true }));
            const wasmRecords2 = Array.from(wasmParser.parse(chunk2, { stream: false }));
            const wasmRecordsAll = [...wasmRecords1, ...wasmRecords2];

            // Normalize and compare
            const normalizedJs = jsRecordsAll.map(normalizeRecord);
            const normalizedWasm = wasmRecordsAll.map(normalizeRecord);

            expect(normalizedWasm).toEqual(normalizedJs);
          }
        ),
        { numRuns: 50, seed: 42 }
      );
    });

    it('should handle quoted fields identically', () => {
      const testCases = [
        'name,description\n"Alice","Hello, World"\n"Bob","Contains ""quotes"""\n',
        'a,b\n"value,with,commas","normal"\n',
        'a,b\n"multi\nline\ntext","normal"\n',
      ];

      for (const csvString of testCases) {
        const csvBytes = toUint8Array(csvString);

        // JS Parser
        const jsParser = new FlexibleBinaryObjectCSVParser({ delimiter: ',' });
        const jsRecords = Array.from(jsParser.parse(csvBytes));

        // WASM Parser
        const wasmParser = new WASMBinaryCSVParser({ delimiter: ',' });
        const wasmRecords = Array.from(wasmParser.parse(csvBytes));

        // Normalize and compare
        const normalizedJs = jsRecords.map(normalizeRecord);
        const normalizedWasm = wasmRecords.map(normalizeRecord);

        expect(normalizedWasm).toEqual(normalizedJs);
      }
    });

    it('should handle UTF-8 characters identically', () => {
      const testCases = [
        'name,city\nAlice,東京\nBob,大阪\n',
        'name,city\nАлиса,Москва\nБоб,Киев\n',
      ];

      for (const csvString of testCases) {
        const csvBytes = toUint8Array(csvString);

        // JS Parser
        const jsParser = new FlexibleBinaryObjectCSVParser({ delimiter: ',' });
        const jsRecords = Array.from(jsParser.parse(csvBytes));

        // WASM Parser
        const wasmParser = new WASMBinaryCSVParser({ delimiter: ',' });
        const wasmRecords = Array.from(wasmParser.parse(csvBytes));

        // Normalize and compare
        const normalizedJs = jsRecords.map(normalizeRecord);
        const normalizedWasm = wasmRecords.map(normalizeRecord);

        expect(normalizedWasm).toEqual(normalizedJs);
      }
    });
  });
});
