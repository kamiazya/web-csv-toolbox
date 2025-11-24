import { loadWASM, WASMBinaryCSVParser, WASMBinaryCSVLexer, WASMCSVObjectRecordAssembler } from "../dist/main.web.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmPath = join(__dirname, "../dist/csv.wasm");
const wasmBuffer = readFileSync(wasmPath);

await loadWASM(wasmBuffer);

// Generate small test data
function generateCSV(rows: number, columns: number): Uint8Array {
  const headers = Array.from({ length: columns }, (_, i) => `col${i}`).join(",");
  const dataRows = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: columns }, (_, j) => `value${i}_${j}`).join(",")
  ).join("\n");

  const csv = `${headers}\n${dataRows}`;
  return new TextEncoder().encode(csv);
}

const data = generateCSV(10, 3);  // Small dataset for debugging
console.log("CSV data:");
console.log(new TextDecoder().decode(data));
console.log("\n" + "=".repeat(60) + "\n");

// Test integrated approach
console.log("Integrated approach:");
const parser = new WASMBinaryCSVParser();
const integratedRecords = [...parser.parse(data)];
console.log(`Records: ${integratedRecords.length}`);
for (const record of integratedRecords) {
  console.log(record);
}

console.log("\n" + "=".repeat(60) + "\n");

// Test separated approach
console.log("Separated approach:");
const lexer = new WASMBinaryCSVLexer();
const assembler = new WASMCSVObjectRecordAssembler();

const tokens = [...lexer.lex(data)];
console.log(`Tokens: ${tokens.length}`);
for (const token of tokens.slice(0, 20)) {  // Show first 20 tokens
  console.log(token);
}
if (tokens.length > 20) {
  console.log(`... and ${tokens.length - 20} more tokens`);
}

console.log("\nAssembling records...");
const separatedRecords = [...assembler.assemble(tokens)];
console.log(`Records: ${separatedRecords.length}`);
for (const record of separatedRecords) {
  console.log(record);
}
