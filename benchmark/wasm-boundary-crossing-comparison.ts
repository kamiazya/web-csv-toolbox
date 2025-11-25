/**
 * Benchmark: WASM Boundary Crossing Comparison
 *
 * Compares different approaches for WASM↔JS data transfer:
 *
 * Method A (Current): JsValue Object creation (Object.new() + Reflect.set() per field)
 *   - Boundary crossings: Record count × (1 + field count)
 *   - Memory: No intermediate serialization
 *
 * Method B (Flat Array): Array-based transfer + JS-side assembly
 *   - Boundary crossings: 2 (headers + values array) + array operations
 *   - Memory: Smaller transfer size, JS-side object creation
 *
 * Method C (Reference): Pure JavaScript implementation (no WASM)
 *   - Boundary crossings: 0
 *   - Memory: All processing in JS
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { CSVParserOptimized, initSync } from "../web-csv-toolbox-wasm/pkg/web_csv_toolbox_wasm.js";

// Load WASM module
const wasmBytes = readFileSync(join(import.meta.dirname!, "../web-csv-toolbox-wasm/pkg/web_csv_toolbox_wasm_bg.wasm"));
initSync({ module: wasmBytes });

// Test data sizes
const SIZES = {
  small: { rows: 100, cols: 10 },
  medium: { rows: 1000, cols: 20 },
  large: { rows: 10000, cols: 50 },
};

/**
 * Generate CSV test data
 */
function generateCSV(rows: number, cols: number): Uint8Array {
  const headers = Array.from({ length: cols }, (_, i) => `col_${i}`).join(",");
  const dataRows = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => `value_${i}_${j}`).join(",")
  );

  const csv = [headers, ...dataRows].join("\n");
  return new TextEncoder().encode(csv);
}

/**
 * Method A: Current approach (JsValue Object creation)
 */
function benchmarkMethodA(data: Uint8Array, label: string): { time: number; records: number } {
  const parser = new CSVParserOptimized({
    delimiter: ",",
  } as any);

  const start = performance.now();
  const records = parser.processChunkBytes(data);
  const flushRecords = parser.flush();
  const end = performance.now();

  const recordCount = records.length + (flushRecords?.length ?? 0);

  return {
    time: end - start,
    records: recordCount,
  };
}

/**
 * Method B: Flat Array approach (processChunkBytesFlat + JS assembly)
 */
function benchmarkMethodB(data: Uint8Array, label: string): { time: number; records: number } {
  const parser = new CSVParserOptimized({
    delimiter: ",",
  } as any);

  const start = performance.now();

  // Get flat format: { headers: string[] | null, records: string[][] }
  const result = (parser as any).processChunkBytesFlat(data);
  const flushResult = (parser as any).processChunkBytesFlat(new Uint8Array(0)); // Flush with empty data

  // Assemble objects in JS
  let assembledRecords = [];
  if (result.headers) {
    assembledRecords = result.records.map((values: string[]) => {
      const obj: Record<string, string> = {};
      result.headers.forEach((header: string, i: number) => {
        obj[header] = values[i];
      });
      return obj;
    });
  }

  const end = performance.now();

  return {
    time: end - start,
    records: assembledRecords.length,
  };
}

/**
 * Run benchmarks for all sizes and methods
 */
function runBenchmarks() {
  console.log("WASM Boundary Crossing Comparison Benchmark\n");
  console.log("=" .repeat(80));

  for (const [sizeName, { rows, cols }] of Object.entries(SIZES)) {
    console.log(`\n${sizeName.toUpperCase()} dataset (${rows} rows × ${cols} columns)`);
    console.log("-".repeat(80));

    const data = generateCSV(rows, cols);
    const dataSizeKB = (data.length / 1024).toFixed(2);
    console.log(`Data size: ${dataSizeKB} KB`);

    // Warmup
    for (let i = 0; i < 5; i++) {
      benchmarkMethodA(data, "warmup");
      benchmarkMethodB(data, "warmup");
    }

    // Method A benchmarks
    const methodAResults = [];
    for (let i = 0; i < 10; i++) {
      methodAResults.push(benchmarkMethodA(data, "A"));
    }
    const avgA = methodAResults.reduce((sum, r) => sum + r.time, 0) / methodAResults.length;
    const minA = Math.min(...methodAResults.map(r => r.time));
    const maxA = Math.max(...methodAResults.map(r => r.time));

    // Method B benchmarks
    const methodBResults = [];
    for (let i = 0; i < 10; i++) {
      methodBResults.push(benchmarkMethodB(data, "B"));
    }
    const avgB = methodBResults.reduce((sum, r) => sum + r.time, 0) / methodBResults.length;
    const minB = Math.min(...methodBResults.map(r => r.time));
    const maxB = Math.max(...methodBResults.map(r => r.time));

    // Calculate speedup
    const speedup = ((avgA - avgB) / avgA * 100).toFixed(1);
    const speedupSign = avgB < avgA ? "faster" : "slower";

    console.log("\nResults:");
    console.log(`  Method A (Object creation):  ${avgA.toFixed(2)}ms (min: ${minA.toFixed(2)}ms, max: ${maxA.toFixed(2)}ms)`);
    console.log(`  Method B (Flat Array):       ${avgB.toFixed(2)}ms (min: ${minB.toFixed(2)}ms, max: ${maxB.toFixed(2)}ms)`);
    console.log(`  Difference: Method B is ${Math.abs(parseFloat(speedup))}% ${speedupSign}`);

    // Boundary crossing analysis
    const totalRecords = methodAResults[0].records;
    const boundaryA = totalRecords * (1 + cols); // Object.new() + Reflect.set() per field
    const boundaryB = 2 + totalRecords; // headers + records array + push per record

    console.log("\nBoundary Crossing Analysis:");
    console.log(`  Method A: ~${boundaryA.toLocaleString()} crossings (${totalRecords} records × ${1 + cols} ops)`);
    console.log(`  Method B: ~${boundaryB.toLocaleString()} crossings (2 initial + ${totalRecords} pushes)`);
    console.log(`  Reduction: ${((boundaryA - boundaryB) / boundaryA * 100).toFixed(1)}%`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("\nConclusion:");
  console.log("  - Flat Array approach reduces WASM↔JS boundary crossings significantly");
  console.log("  - Trade-off: Lower boundary crossing count vs JS-side object assembly overhead");
  console.log("  - Best choice depends on: record size, field count, and use case");
}

runBenchmarks();
