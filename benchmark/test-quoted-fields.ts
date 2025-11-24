/**
 * Test quoted field handling in CSVParserOptimized
 * Specifically tests delimiters and newlines inside quoted fields
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// @ts-ignore - Direct import from WASM package
import init, { CSVParserOptimized } from "web-csv-toolbox-wasm";

// Load WASM module directly from pkg directory (latest build)
const wasmPath = join(__dirname, "../web-csv-toolbox-wasm/pkg/web_csv_toolbox_wasm_bg.wasm");
const wasmBuffer = readFileSync(wasmPath);
await init(wasmBuffer);

console.log("Testing quoted field handling...\n");

// Test 1: Delimiter inside quoted field
console.log("Test 1: Delimiter inside quoted field");
const parser1 = new CSVParserOptimized({});
const csv1 = 'name,description\nAlice,"Hello, World"\nBob,"Value1,Value2,Value3"\n';
const bytes1 = new TextEncoder().encode(csv1);

const records1 = [];
for (const record of parser1.processChunkBytes(bytes1)) {
  records1.push(record);
}

console.log(`Records: ${records1.length}`);
for (const record of records1) {
  console.log(`  ${JSON.stringify(record)}`);
}

const desc0 = records1[0].description;
const desc1 = records1[1].description;
console.log(`\n✓ Record 0 description: "${desc0}"`);
console.log(`  Expected: "Hello, World" - ${desc0 === "Hello, World" ? "PASS" : "FAIL"}`);
console.log(`✓ Record 1 description: "${desc1}"`);
console.log(`  Expected: "Value1,Value2,Value3" - ${desc1 === "Value1,Value2,Value3" ? "PASS" : "FAIL"}`);

// Test 2: Newline inside quoted field
console.log("\n\nTest 2: Newline inside quoted field");
const parser2 = new CSVParserOptimized({});
const csv2 = 'name,address\nAlice,"123 Main St\nApt 4B\nNew York"\nBob,"456 Elm St"\n';
const bytes2 = new TextEncoder().encode(csv2);

const records2 = [];
for (const record of parser2.processChunkBytes(bytes2)) {
  records2.push(record);
}

console.log(`Records: ${records2.length}`);
for (const record of records2) {
  console.log(`  ${JSON.stringify(record)}`);
}

const addr0 = records2[0].address;
const addr1 = records2[1].address;
console.log(`\n✓ Record 0 address: ${JSON.stringify(addr0)}`);
console.log(`  Expected: "123 Main St\\nApt 4B\\nNew York" - ${addr0 === "123 Main St\nApt 4B\nNew York" ? "PASS" : "FAIL"}`);
console.log(`✓ Record 1 address: ${JSON.stringify(addr1)}`);
console.log(`  Expected: "456 Elm St" - ${addr1 === "456 Elm St" ? "PASS" : "FAIL"}`);

// Test 3: Escaped quotes
console.log("\n\nTest 3: Escaped quotes");
const parser3 = new CSVParserOptimized({});
const csv3 = 'name,quote\nAlice,"She said ""Hello"""\nBob,"He said ""Bye"""\n';
const bytes3 = new TextEncoder().encode(csv3);

const records3 = [];
for (const record of parser3.processChunkBytes(bytes3)) {
  records3.push(record);
}

console.log(`Records: ${records3.length}`);
for (const record of records3) {
  console.log(`  ${JSON.stringify(record)}`);
}

const quote0 = records3[0].quote;
const quote1 = records3[1].quote;
console.log(`\n✓ Record 0 quote: ${JSON.stringify(quote0)}`);
console.log(`  Expected: 'She said "Hello"' - ${quote0 === 'She said "Hello"' ? "PASS" : "FAIL"}`);
console.log(`✓ Record 1 quote: ${JSON.stringify(quote1)}`);
console.log(`  Expected: 'He said "Bye"' - ${quote1 === 'He said "Bye"' ? "PASS" : "FAIL"}`);

// Test 4: Complex case - mixed delimiters, newlines, and quotes
console.log("\n\nTest 4: Complex quoted fields");
const parser4 = new CSVParserOptimized({});
const csv4 = 'id,data\n1,"Line1\nLine2,with,commas\nLine3 ""quoted"""\n2,"Simple"\n';
const bytes4 = new TextEncoder().encode(csv4);

const records4 = [];
for (const record of parser4.processChunkBytes(bytes4)) {
  records4.push(record);
}

console.log(`Records: ${records4.length}`);
for (const record of records4) {
  console.log(`  ${JSON.stringify(record)}`);
}

const data0 = records4[0].data;
console.log(`\n✓ Record 0 data: ${JSON.stringify(data0)}`);
const expected = 'Line1\nLine2,with,commas\nLine3 "quoted"';
console.log(`  Expected: ${JSON.stringify(expected)} - ${data0 === expected ? "PASS" : "FAIL"}`);

console.log("\n✅ All tests completed!");
