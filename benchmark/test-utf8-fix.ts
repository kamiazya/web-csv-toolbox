/**
 * Test UTF-8 handling and missing field handling in CSVParserOptimized
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

console.log("Testing UTF-8 handling...\n");

// Test 1: UTF-8 with ASCII + multi-byte characters
console.log("Test 1: UTF-8 with mixed ASCII and multi-byte characters");
const parser1 = new CSVParserOptimized({});
const csv1 = "name,city\nAlice,東京\nBob,大阪\nCharlie,ニューヨーク\n";
const bytes1 = new TextEncoder().encode(csv1);

const records1 = [];
for (const record of parser1.processChunkBytes(bytes1)) {
  records1.push(record);
}

console.log(`Records: ${records1.length}`);
for (const record of records1) {
  console.log(`  ${JSON.stringify(record)}`);
}

// Verify UTF-8 integrity
const city0 = records1[0].city;
const city1 = records1[1].city;
console.log(`\n✓ City 0: ${city0} (expected: 東京) - ${city0 === "東京" ? "PASS" : "FAIL"}`);
console.log(`✓ City 1: ${city1} (expected: 大阪) - ${city1 === "大阪" ? "PASS" : "FAIL"}`);

// Test 2: Missing fields
console.log("\n\nTest 2: Missing fields handling");
const parser2 = new CSVParserOptimized({});
const csv2 = "name,age,city\nAlice,30,Tokyo\nBob\nCharlie,25\n";
const bytes2 = new TextEncoder().encode(csv2);

const records2 = [];
for (const record of parser2.processChunkBytes(bytes2)) {
  records2.push(record);
}

console.log(`Records: ${records2.length}`);
for (const record of records2) {
  console.log(`  ${JSON.stringify(record)}`);
}

// Verify missing fields are filled with empty strings
const record1 = records2[1];
const record2 = records2[2];

console.log(`\nDEBUG - Record 1 keys: ${Object.keys(record1)}`);
console.log(`DEBUG - Record 1 entries: ${JSON.stringify(Object.entries(record1))}`);
console.log(`DEBUG - "age" in record1: ${"age" in record1}`);
console.log(`DEBUG - record1.age: ${JSON.stringify(record1.age)}`);
console.log(`DEBUG - record1.hasOwnProperty("age"): ${record1.hasOwnProperty("age")}`);

console.log(`\n✓ Record 1 (Bob): age="${record1.age}", city="${record1.city}"`);
console.log(`  Missing fields should be empty strings - ${record1.age === "" && record1.city === "" ? "PASS" : "FAIL"}`);
console.log(`✓ Record 2 (Charlie): city="${record2.city}"`);
console.log(`  Missing city should be empty string - ${record2.city === "" ? "PASS" : "FAIL"}`);

console.log("\n✅ All tests completed!");
