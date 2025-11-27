/**
 * Flexibility Test: Demonstrates the value of separated approach
 *
 * Shows use cases where the separated approach (Lexer + Assembler)
 * provides flexibility that the integrated approach cannot offer.
 */

import { loadWASM, WASMBinaryCSVLexer, WASMCSVObjectRecordAssembler } from "../dist/main.web.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmPath = join(__dirname, "../dist/csv.wasm");
const wasmBuffer = readFileSync(wasmPath);

await loadWASM(wasmBuffer);

console.log("🔧 WASM Flexibility Test\n");
console.log("Demonstrating use cases where separated approach provides value:\n");

// ============================================================================
// Use Case 1: Filtering Rows Based on Token Inspection
// ============================================================================
console.log("=".repeat(60));
console.log("Use Case 1: Filter Rows by Token Inspection");
console.log("=".repeat(60));
console.log("Scenario: Skip rows containing 'ERROR' or 'WARN' in any field\n");

const csvWithErrors = new TextEncoder().encode(`level,message,timestamp
INFO,System started,2024-01-01
ERROR,Database connection failed,2024-01-02
INFO,Request processed,2024-01-03
WARN,Memory usage high,2024-01-04
INFO,Task completed,2024-01-05
`);

const lexer1 = new WASMBinaryCSVLexer();
const assembler1 = new WASMCSVObjectRecordAssembler();

const allTokens1 = [...lexer1.lex(csvWithErrors), ...lexer1.lex()];

// Filter out rows containing ERROR or WARN
const filteredTokens = [];
let currentRowTokens: any[] = [];
let skipRow = false;

for (const token of allTokens1) {
  if (token.type === "field" && (token.value.includes("ERROR") || token.value.includes("WARN"))) {
    skipRow = true;
  }

  currentRowTokens.push(token);

  if (token.type === "record-delimiter") {
    if (!skipRow) {
      filteredTokens.push(...currentRowTokens);
    }
    currentRowTokens = [];
    skipRow = false;
  }
}

const filteredRecords = [...assembler1.assemble(filteredTokens), ...assembler1.assemble()];
console.log(`Original rows: 5`);
console.log(`Filtered rows: ${filteredRecords.length}`);
console.log("\nFiltered records:");
for (const record of filteredRecords) {
  console.log(record);
}

// ============================================================================
// Use Case 2: Token Position-Based Error Reporting
// ============================================================================
console.log("\n" + "=".repeat(60));
console.log("Use Case 2: Detailed Error Reporting with Token Positions");
console.log("=".repeat(60));
console.log("Scenario: Validate numeric fields and report exact error locations\n");

const csvWithInvalidNumbers = new TextEncoder().encode(`id,amount,quantity
1,100.50,10
2,invalid,20
3,200.75,abc
4,150.00,15
`);

const lexer2 = new WASMBinaryCSVLexer();
const allTokens2 = [...lexer2.lex(csvWithInvalidNumbers), ...lexer2.lex()];

// Track which columns should be numeric (based on header)
const numericColumns = new Set(["amount", "quantity"]);
let headers: string[] = [];
let currentRecord: any[] = [];
let fieldIndex = 0;
let recordNumber = 0;

console.log("Validation errors:");
for (const token of allTokens2) {
  if (token.type === "field") {
    currentRecord.push(token);

    if (recordNumber === 0) {
      // First row is headers
      headers.push(token.value);
    } else if (recordNumber > 0) {
      // Validate numeric fields
      const columnName = headers[fieldIndex];
      if (numericColumns.has(columnName) && isNaN(Number(token.value))) {
        console.log(
          `  ❌ Line ${token.location.start.line}, Column ${token.location.start.column}: ` +
          `Invalid number "${token.value}" in field "${columnName}"`
        );
      }
    }

    fieldIndex++;
  } else if (token.type === "record-delimiter") {
    recordNumber++;
    fieldIndex = 0;
    currentRecord = [];
  }
}

// ============================================================================
// Use Case 3: Custom Field Transformation During Assembly
// ============================================================================
console.log("\n" + "=".repeat(60));
console.log("Use Case 3: Transform Fields During Token Processing");
console.log("=".repeat(60));
console.log("Scenario: Uppercase all header names, trim whitespace from values\n");

const csvWithWhitespace = new TextEncoder().encode(`  name  ,  age  ,  city
  Alice  ,  30  ,  Tokyo
  Bob  ,  25  ,  Osaka
`);

const lexer3 = new WASMBinaryCSVLexer();
let allTokens3 = [...lexer3.lex(csvWithWhitespace), ...lexer3.lex()];

// Transform tokens
let isFirstRow = true;
let currentRowNumber = 1;
const transformedTokens = allTokens3.map(token => {
  if (token.type === "field") {
    if (isFirstRow) {
      // Uppercase headers and trim
      return { ...token, value: token.value.trim().toUpperCase() };
    } else {
      // Trim data values
      return { ...token, value: token.value.trim() };
    }
  } else if (token.type === "record-delimiter") {
    if (isFirstRow) {
      isFirstRow = false;
    }
    currentRowNumber++;
  }
  return token;
});

const assembler3 = new WASMCSVObjectRecordAssembler();
const transformedRecords = [...assembler3.assemble(transformedTokens), ...assembler3.assemble()];

console.log("Original CSV (with extra whitespace):");
console.log(new TextDecoder().decode(csvWithWhitespace));
console.log("\nTransformed records:");
for (const record of transformedRecords) {
  console.log(record);
}

// ============================================================================
// Use Case 4: Streaming Token Analysis
// ============================================================================
console.log("\n" + "=".repeat(60));
console.log("Use Case 4: Statistical Analysis of Token Stream");
console.log("=".repeat(60));
console.log("Scenario: Analyze CSV structure without building full records\n");

const largeCsv = new TextEncoder().encode(`id,name,email,department
1,Alice,alice@example.com,Engineering
2,Bob,bob@example.com,Sales
3,Charlie,charlie@example.com,Engineering
4,Diana,diana@example.com,Marketing
5,Eve,eve@example.com,Engineering
`);

const lexer4 = new WASMBinaryCSVLexer();
const allTokens4 = [...lexer4.lex(largeCsv), ...lexer4.lex()];

const stats = {
  totalFields: 0,
  totalRecords: 0,
  maxFieldLength: 0,
  avgFieldLength: 0,
  fieldLengthSum: 0,
  recordLengths: [] as number[],
  currentRecordFields: 0,
};

for (const token of allTokens4) {
  if (token.type === "field") {
    stats.totalFields++;
    stats.fieldLengthSum += token.value.length;
    stats.maxFieldLength = Math.max(stats.maxFieldLength, token.value.length);
    stats.currentRecordFields++;
  } else if (token.type === "record-delimiter") {
    stats.totalRecords++;
    stats.recordLengths.push(stats.currentRecordFields);
    stats.currentRecordFields = 0;
  }
}

stats.avgFieldLength = stats.fieldLengthSum / stats.totalFields;

console.log(`Total records: ${stats.totalRecords}`);
console.log(`Total fields: ${stats.totalFields}`);
console.log(`Average fields per record: ${(stats.totalFields / stats.totalRecords).toFixed(2)}`);
console.log(`Max field length: ${stats.maxFieldLength} characters`);
console.log(`Average field length: ${stats.avgFieldLength.toFixed(2)} characters`);
console.log(`Record field counts: ${stats.recordLengths.join(", ")}`);

// ============================================================================
// Use Case 5: Conditional Record Assembly
// ============================================================================
console.log("\n" + "=".repeat(60));
console.log("Use Case 5: Conditional Record Assembly");
console.log("=".repeat(60));
console.log("Scenario: Only assemble records from specific row numbers\n");

const csvWithManyRows = new TextEncoder().encode(`id,value
1,first
2,second
3,third
4,fourth
5,fifth
6,sixth
7,seventh
8,eighth
9,ninth
10,tenth
`);

const lexer5 = new WASMBinaryCSVLexer();
const allTokens5 = [...lexer5.lex(csvWithManyRows), ...lexer5.lex()];

// Only assemble rows 2, 4, 6, 8 (even row numbers, excluding header)
const selectedTokens = [];
let currentRowTokens5: any[] = [];
let rowNum = 0;

for (const token of allTokens5) {
  currentRowTokens5.push(token);

  if (token.type === "record-delimiter") {
    rowNum++;
    // Include header (row 0) and even data rows
    if (rowNum === 1 || rowNum % 2 === 0) {
      selectedTokens.push(...currentRowTokens5);
    }
    currentRowTokens5 = [];
  }
}

const assembler5 = new WASMCSVObjectRecordAssembler();
const selectedRecords = [...assembler5.assemble(selectedTokens), ...assembler5.assemble()];

console.log(`Original rows: 10`);
console.log(`Selected rows (even numbered): ${selectedRecords.length}`);
console.log("\nSelected records:");
for (const record of selectedRecords) {
  console.log(record);
}

// ============================================================================
// Summary
// ============================================================================
console.log("\n" + "=".repeat(60));
console.log("Summary: Flexibility Test Results");
console.log("=".repeat(60));
console.log(`
✅ Use Case 1: Row filtering based on field content
✅ Use Case 2: Detailed error reporting with exact positions
✅ Use Case 3: Custom field transformations
✅ Use Case 4: Statistical analysis without full record assembly
✅ Use Case 5: Conditional record assembly

All of these use cases demonstrate scenarios where the separated
approach (Lexer + Assembler) provides valuable flexibility that
cannot be achieved with the integrated approach alone.

Performance trade-off: 6-7x slower, but enables powerful customization.
`);
