/**
 * Benchmark: JavaScript vs WASM Parser Comparison
 *
 * Compares performance of:
 * 1. FlexibleBinaryObjectCSVParser (JavaScript)
 * 2. WASMBinaryObjectCSVParser (WebAssembly Optimized)
 */

import { loadWASM } from "../src/wasm/WasmInstance.main.web.ts";
import { WASMBinaryObjectCSVParser } from "../src/parser/models/WASMBinaryObjectCSVParser.ts";
import { FlexibleBinaryObjectCSVParser } from "../src/parser/models/FlexibleBinaryObjectCSVParser.ts";

// Generate test CSV data
function generateCSV(rows: number, columns: number): Uint8Array {
  const headers = Array.from({ length: columns }, (_, i) => `col${i}`).join(",");
  const dataRows = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: columns }, (_, j) => `value${i}_${j}`).join(",")
  ).join("\n");

  const csv = `${headers}\n${dataRows}`;
  return new TextEncoder().encode(csv);
}

// Generate CSV with quoted fields
function generateQuotedCSV(rows: number, columns: number): Uint8Array {
  const headers = Array.from({ length: columns }, (_, i) => `col${i}`).join(",");
  const dataRows = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: columns }, (_, j) => `"value${i}_${j}"`).join(",")
  ).join("\n");

  const csv = `${headers}\n${dataRows}`;
  return new TextEncoder().encode(csv);
}

// Benchmark function
function benchmark(name: string, fn: () => void, iterations: number = 10): number {
  // Warmup
  for (let i = 0; i < 3; i++) {
    fn();
  }

  // Measure
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];

  console.log(`${name}:`);
  console.log(`  Avg: ${avg.toFixed(2)}ms`);
  console.log(`  Min: ${min.toFixed(2)}ms`);
  console.log(`  Max: ${max.toFixed(2)}ms`);
  console.log(`  Median: ${median.toFixed(2)}ms`);

  return avg;
}

async function runBenchmarks() {
  console.log("\n======================================================================");
  console.log("JavaScript vs WASM Parser Benchmark");
  console.log("======================================================================\n");

  console.log("Loading WASM...");
  await loadWASM();
  console.log("✓ WASM loaded.\n");

  const testSizes = [
    { rows: 100, columns: 10, name: "Small (100 rows × 10 cols)" },
    { rows: 1000, columns: 10, name: "Medium (1,000 rows × 10 cols)" },
    { rows: 10000, columns: 10, name: "Large (10,000 rows × 10 cols)" },
    { rows: 1000, columns: 50, name: "Wide (1,000 rows × 50 cols)" },
  ];

  console.log("======================================================================");
  console.log("Unquoted Fields");
  console.log("======================================================================\n");

  for (const { rows, columns, name } of testSizes) {
    console.log("──────────────────────────────────────────────────────────────────────");
    console.log(`Test: ${name}`);
    console.log("──────────────────────────────────────────────────────────────────────");

    const data = generateCSV(rows, columns);
    console.log(`CSV size: ${(data.length / 1024).toFixed(2)} KB\n`);

    // Test 1: JavaScript parser
    const jsTime = benchmark(
      "JavaScript Parser",
      () => {
        const parser = new FlexibleBinaryObjectCSVParser();
        const records = [...parser.parse(data)];
        if (records.length !== rows) {
          throw new Error(`Expected ${rows} records, got ${records.length}`);
        }
      },
      10
    );

    console.log("");

    // Test 2: WASM parser
    const wasmTime = benchmark(
      "WASM Parser",
      () => {
        const parser = new WASMBinaryObjectCSVParser();
        const records = [...parser.parse(data)];
        if (records.length !== rows) {
          throw new Error(`Expected ${rows} records, got ${records.length}`);
        }
      },
      10
    );

    const improvement = ((jsTime - wasmTime) / jsTime) * 100;
    const speedup = jsTime / wasmTime;

    console.log("\n📊 Performance Comparison:");
    console.log(`  JavaScript:  ${jsTime.toFixed(2)}ms`);
    console.log(`  WASM:        ${wasmTime.toFixed(2)}ms`);
    console.log(`  Improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}% ${improvement > 0 ? '✓' : '✗'}`);
    console.log(`  Speedup:     ${speedup.toFixed(2)}x`);
    console.log("");
  }

  console.log("\n======================================================================");
  console.log("Quoted Fields");
  console.log("======================================================================\n");

  for (const { rows, columns, name } of testSizes) {
    console.log("──────────────────────────────────────────────────────────────────────");
    console.log(`Test: ${name}`);
    console.log("──────────────────────────────────────────────────────────────────────");

    const data = generateQuotedCSV(rows, columns);
    console.log(`CSV size: ${(data.length / 1024).toFixed(2)} KB\n`);

    // Test 1: JavaScript parser
    const jsTime = benchmark(
      "JavaScript Parser",
      () => {
        const parser = new FlexibleBinaryObjectCSVParser();
        const records = [...parser.parse(data)];
        if (records.length !== rows) {
          throw new Error(`Expected ${rows} records, got ${records.length}`);
        }
      },
      10
    );

    console.log("");

    // Test 2: WASM parser
    const wasmTime = benchmark(
      "WASM Parser",
      () => {
        const parser = new WASMBinaryObjectCSVParser();
        const records = [...parser.parse(data)];
        if (records.length !== rows) {
          throw new Error(`Expected ${rows} records, got ${records.length}`);
        }
      },
      10
    );

    const improvement = ((jsTime - wasmTime) / jsTime) * 100;
    const speedup = jsTime / wasmTime;

    console.log("\n📊 Performance Comparison:");
    console.log(`  JavaScript:  ${jsTime.toFixed(2)}ms`);
    console.log(`  WASM:        ${wasmTime.toFixed(2)}ms`);
    console.log(`  Improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}% ${improvement > 0 ? '✓' : '✗'}`);
    console.log(`  Speedup:     ${speedup.toFixed(2)}x`);
    console.log("");
  }

  console.log("\n======================================================================");
  console.log("Benchmark completed!");
  console.log("======================================================================\n");
}

runBenchmarks().catch(console.error);
