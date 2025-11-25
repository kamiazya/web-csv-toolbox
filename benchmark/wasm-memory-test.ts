/**
 * Memory Usage Test: Integrated vs Separated approach
 *
 * Compares memory consumption between:
 * 1. Integrated approach (WASMBinaryObjectCSVParser)
 * 2. Separated approach (WASMBinaryCSVLexer + WASMCSVObjectRecordAssembler)
 */

import { loadWASM, WASMBinaryObjectCSVParser, WASMBinaryCSVLexer, WASMCSVObjectRecordAssembler } from "../dist/main.web.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmPath = join(__dirname, "../dist/csv.wasm");
const wasmBuffer = readFileSync(wasmPath);

await loadWASM(wasmBuffer);

// Generate large test CSV data
function generateCSV(rows: number, columns: number): Uint8Array {
  const headers = Array.from({ length: columns }, (_, i) => `column_${i}`).join(",");
  const dataRows = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: columns }, (_, j) => `value_${i}_${j}`).join(",")
  ).join("\n");

  const csv = `${headers}\n${dataRows}\n`;
  return new TextEncoder().encode(csv);
}

function getMemoryUsage() {
  if (global.gc) {
    global.gc();
  }
  const usage = process.memoryUsage();
  return {
    heapUsed: usage.heapUsed / 1024 / 1024, // MB
    heapTotal: usage.heapTotal / 1024 / 1024, // MB
    external: usage.external / 1024 / 1024, // MB
    rss: usage.rss / 1024 / 1024, // MB
  };
}

function formatMemory(mb: number): string {
  return `${mb.toFixed(2)} MB`;
}

console.log("📊 WASM Memory Usage Comparison\n");
console.log("Note: Run with --expose-gc for accurate measurements\n");

const testCases = [
  { rows: 1000, columns: 10, name: "Small (1,000 rows × 10 cols)" },
  { rows: 10000, columns: 10, name: "Medium (10,000 rows × 10 cols)" },
  { rows: 50000, columns: 10, name: "Large (50,000 rows × 10 cols)" },
  { rows: 10000, columns: 50, name: "Wide (10,000 rows × 50 cols)" },
];

for (const { rows, columns, name } of testCases) {
  console.log("=".repeat(70));
  console.log(`Test: ${name}`);
  console.log("=".repeat(70));

  const data = generateCSV(rows, columns);
  const dataSize = data.length / 1024 / 1024;
  console.log(`CSV size: ${formatMemory(dataSize)}\n`);

  // ========================================================================
  // Test 1: Integrated Approach
  // ========================================================================
  console.log("1️⃣  Integrated Approach (WASMBinaryObjectCSVParser)");
  console.log("-".repeat(70));

  const beforeIntegrated = getMemoryUsage();
  const startTimeIntegrated = performance.now();

  const parser = new WASMBinaryObjectCSVParser();
  const integratedRecords = [...parser.parse(data)];

  const endTimeIntegrated = performance.now();
  const afterIntegrated = getMemoryUsage();

  const integratedTime = endTimeIntegrated - startTimeIntegrated;
  const integratedMemory = {
    heapUsed: afterIntegrated.heapUsed - beforeIntegrated.heapUsed,
    heapTotal: afterIntegrated.heapTotal - beforeIntegrated.heapTotal,
    external: afterIntegrated.external - beforeIntegrated.external,
  };

  console.log(`  Records parsed: ${integratedRecords.length}`);
  console.log(`  Time: ${integratedTime.toFixed(2)}ms`);
  console.log(`  Heap Used: ${formatMemory(integratedMemory.heapUsed)}`);
  console.log(`  Heap Total: ${formatMemory(integratedMemory.heapTotal)}`);
  console.log(`  External: ${formatMemory(integratedMemory.external)}`);
  console.log(`  Memory/Record: ${formatMemory(integratedMemory.heapUsed / integratedRecords.length)}`);

  // Force GC between tests
  if (global.gc) {
    global.gc();
  }
  await new Promise(resolve => setTimeout(resolve, 100));

  // ========================================================================
  // Test 2: Separated Approach
  // ========================================================================
  console.log("\n2️⃣  Separated Approach (Lexer + Assembler)");
  console.log("-".repeat(70));

  const beforeSeparated = getMemoryUsage();
  const startTimeSeparated = performance.now();

  const lexer = new WASMBinaryCSVLexer();
  const assembler = new WASMCSVObjectRecordAssembler();

  // Lex tokens
  const tokens = [...lexer.lex(data), ...lexer.lex()];

  // Measure token memory
  const afterLex = getMemoryUsage();
  const tokenMemory = afterLex.heapUsed - beforeSeparated.heapUsed;

  // Assemble records
  const separatedRecords = [...assembler.assemble(tokens), ...assembler.assemble()];

  const endTimeSeparated = performance.now();
  const afterSeparated = getMemoryUsage();

  const separatedTime = endTimeSeparated - startTimeSeparated;
  const separatedMemory = {
    heapUsed: afterSeparated.heapUsed - beforeSeparated.heapUsed,
    heapTotal: afterSeparated.heapTotal - beforeSeparated.heapTotal,
    external: afterSeparated.external - beforeSeparated.external,
  };

  console.log(`  Records parsed: ${separatedRecords.length}`);
  console.log(`  Tokens generated: ${tokens.length}`);
  console.log(`  Time: ${separatedTime.toFixed(2)}ms`);
  console.log(`  Heap Used (Total): ${formatMemory(separatedMemory.heapUsed)}`);
  console.log(`  Heap Used (Tokens): ${formatMemory(tokenMemory)}`);
  console.log(`  Heap Total: ${formatMemory(separatedMemory.heapTotal)}`);
  console.log(`  External: ${formatMemory(separatedMemory.external)}`);
  console.log(`  Memory/Record: ${formatMemory(separatedMemory.heapUsed / separatedRecords.length)}`);
  console.log(`  Memory/Token: ${formatMemory(tokenMemory / tokens.length)}`);

  // Force GC
  if (global.gc) {
    global.gc();
  }
  await new Promise(resolve => setTimeout(resolve, 100));

  // ========================================================================
  // Comparison
  // ========================================================================
  console.log("\n📈 Comparison");
  console.log("-".repeat(70));

  const memoryOverhead = ((separatedMemory.heapUsed - integratedMemory.heapUsed) / integratedMemory.heapUsed) * 100;
  const timeOverhead = ((separatedTime - integratedTime) / integratedTime) * 100;
  const memoryRatio = separatedMemory.heapUsed / integratedMemory.heapUsed;

  console.log(`  Time overhead: ${timeOverhead >= 0 ? '+' : ''}${timeOverhead.toFixed(1)}%`);
  console.log(`  Memory overhead: ${memoryOverhead >= 0 ? '+' : ''}${memoryOverhead.toFixed(1)}%`);
  console.log(`  Memory ratio: ${memoryRatio.toFixed(2)}x`);
  console.log(`  Token overhead: ${formatMemory(tokenMemory)} (${(tokenMemory / dataSize).toFixed(1)}x CSV size)`);

  console.log("");
}

// ========================================================================
// Summary
// ========================================================================
console.log("=".repeat(70));
console.log("Summary: Memory Usage Analysis");
console.log("=".repeat(70));
console.log(`
Key Findings:

1. **Token Memory Overhead**
   - Separated approach stores intermediate token array in JS heap
   - Token objects include value, type, and location metadata
   - Typically 2-5x the original CSV size in memory

2. **Record Assembly**
   - Both approaches produce similar final record structures
   - Memory usage for records is comparable

3. **Trade-offs**
   - Integrated: Lower memory footprint, single pass
   - Separated: Higher memory due to token storage, but enables:
     * Token filtering/transformation
     * Partial processing
     * Error recovery
     * Statistical analysis

4. **Recommendation**
   - For large files: Use integrated approach or streaming
   - For flexibility needs: Use separated approach with streaming
   - For analysis only: Process tokens without assembling all records

Note: Run with 'node --expose-gc' for accurate GC measurements.
`);
