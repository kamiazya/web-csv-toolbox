/**
 * Benchmark: WASM Legacy vs Optimized Parser Comparison
 *
 * Compares performance of:
 * 1. CSVParserLegacy (original implementation)
 * 2. CSVParserOptimized (rust-csv inspired implementation with ASCII fast path, bulk copy, etc.)
 *
 * Expected improvements:
 * - 3-8x faster parsing
 * - 70% less memory usage
 * - Better performance on ASCII-heavy data
 */

import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { Bench } from 'tinybench';
import { loadWASM } from "web-csv-toolbox";
// @ts-ignore - Direct import from WASM package
import init, {
  CSVParserLegacy,
  CSVParserOptimized,
} from "web-csv-toolbox-wasm";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Generate CSV with mixed content (some quoted, some not)
function generateMixedCSV(rows: number, columns: number): Uint8Array {
  const headers = Array.from({ length: columns }, (_, i) => `col${i}`).join(",");
  const dataRows = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: columns }, (_, j) =>
      j % 2 === 0 ? `value${i}_${j}` : `"quoted,value${i}_${j}"`
    ).join(",")
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

// Load WASM module before benchmarks
let wasmAvailable = false;
try {
  // Read WASM file from node_modules
  const wasmPath = join(__dirname, "../node_modules/web-csv-toolbox-wasm/web_csv_toolbox_wasm_bg.wasm");
  const wasmBuffer = readFileSync(wasmPath);

  // Initialize WASM module directly to ensure exports are available
  await init(wasmBuffer);
  wasmAvailable = true;
  console.log("✓ WASM module loaded successfully");
} catch (e) {
  console.warn('⚠️  WASM module not available, benchmarks will be skipped');
  console.error(e);
}

async function runBenchmarks() {
  if (!wasmAvailable) {
    console.log("\n❌ Cannot run benchmarks: WASM module not available\n");
    return;
  }

  console.log(`\n${"=".repeat(70)}`);
  console.log("WASM Parser Optimization Benchmark");
  console.log("Comparing Legacy vs Optimized implementations");
  console.log(`${"=".repeat(70)}\n`);

  const testConfigs = [
    {
      name: "Small Dataset (100 rows × 10 cols)",
      rows: 100,
      columns: 10,
      iterations: 20,
    },
    {
      name: "Medium Dataset (1,000 rows × 10 cols)",
      rows: 1000,
      columns: 10,
      iterations: 10,
    },
    {
      name: "Large Dataset (10,000 rows × 10 cols)",
      rows: 10000,
      columns: 10,
      iterations: 5,
    },
    {
      name: "Wide Dataset (1,000 rows × 50 cols)",
      rows: 1000,
      columns: 50,
      iterations: 10,
    },
    {
      name: "Extra Large (100,000 rows × 10 cols)",
      rows: 100000,
      columns: 10,
      iterations: 3,
    },
  ];

  const dataTypes = [
    { name: "Unquoted (ASCII fast path)", generator: generateCSV },
    { name: "Quoted fields", generator: generateQuotedCSV },
    { name: "Mixed content", generator: generateMixedCSV },
  ];

  const results: Array<{
    config: string;
    dataType: string;
    legacyTime: number;
    optimizedTime: number;
    improvement: number;
  }> = [];

  for (const dataType of dataTypes) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`Data Type: ${dataType.name}`);
    console.log(`${"=".repeat(70)}`);

    for (const config of testConfigs) {
      console.log(`\n${"─".repeat(70)}`);
      console.log(`Test: ${config.name}`);
      console.log(`${"─".repeat(70)}`);

      const data = dataType.generator(config.rows, config.columns);
      console.log(`CSV size: ${(data.length / 1024).toFixed(2)} KB\n`);

      // Test 1: Legacy Parser
      const legacyTime = benchmark(
        "Legacy Parser",
        () => {
          const parser = new CSVParserLegacy({});
          const records = [];
          for (const record of parser.processChunkBytes(data)) {
            records.push(record);
          }
          for (const record of parser.flush()) {
            records.push(record);
          }

          if (records.length !== config.rows) {
            throw new Error(`Expected ${config.rows} records, got ${records.length}`);
          }
        },
        config.iterations
      );

      console.log("");

      // Test 2: Optimized Parser
      const optimizedTime = benchmark(
        "Optimized Parser",
        () => {
          const parser = new CSVParserOptimized({});
          const records = [];
          for (const record of parser.processChunkBytes(data)) {
            records.push(record);
          }
          for (const record of parser.flush()) {
            records.push(record);
          }

          if (records.length !== config.rows) {
            throw new Error(`Expected ${config.rows} records, got ${records.length}`);
          }
        },
        config.iterations
      );

      console.log("");

      // Calculate improvement
      const improvement = ((legacyTime - optimizedTime) / legacyTime) * 100;
      const speedup = legacyTime / optimizedTime;

      console.log(`\n📊 Performance Comparison:`);
      console.log(`  Legacy:      ${legacyTime.toFixed(2)}ms`);
      console.log(`  Optimized:   ${optimizedTime.toFixed(2)}ms`);
      console.log(`  Improvement: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}% ${improvement > 0 ? '✓' : '✗'}`);
      console.log(`  Speedup:     ${speedup.toFixed(2)}x`);

      results.push({
        config: config.name,
        dataType: dataType.name,
        legacyTime,
        optimizedTime,
        improvement,
      });
    }
  }

  // Streaming test
  console.log(`\n\n${"=".repeat(70)}`);
  console.log("Streaming Performance Test");
  console.log(`${"=".repeat(70)}`);

  const streamData = generateCSV(10000, 10);
  const chunkSize = 4096; // 4KB chunks

  console.log(`\nDataset: 10,000 rows × 10 cols`);
  console.log(`CSV size: ${(streamData.length / 1024).toFixed(2)} KB`);
  console.log(`Chunk size: ${chunkSize} bytes\n`);

  const legacyStreamTime = benchmark(
    "Legacy - Streaming",
    () => {
      const parser = new CSVParserLegacy({});
      let recordCount = 0;

      for (let offset = 0; offset < streamData.length; offset += chunkSize) {
        const chunk = streamData.slice(offset, offset + chunkSize);
        const records = parser.processChunkBytes(chunk);
        if (Array.isArray(records)) {
          recordCount += records.length;
        }
      }

      const remaining = parser.flush();
      if (Array.isArray(remaining)) {
        recordCount += remaining.length;
      }

      if (recordCount !== 10000) {
        throw new Error(`Expected 10000 records, got ${recordCount}`);
      }
    },
    10
  );

  console.log("");

  const optimizedStreamTime = benchmark(
    "Optimized - Streaming",
    () => {
      const parser = new CSVParserOptimized({});
      let recordCount = 0;

      for (let offset = 0; offset < streamData.length; offset += chunkSize) {
        const chunk = streamData.slice(offset, offset + chunkSize);
        const records = parser.processChunkBytes(chunk);
        if (Array.isArray(records)) {
          recordCount += records.length;
        }
      }

      const remaining = parser.flush();
      if (Array.isArray(remaining)) {
        recordCount += remaining.length;
      }

      if (recordCount !== 10000) {
        throw new Error(`Expected 10000 records, got ${recordCount}`);
      }
    },
    10
  );

  console.log("");

  const streamImprovement = ((legacyStreamTime - optimizedStreamTime) / legacyStreamTime) * 100;
  console.log(`\n📊 Streaming Performance:`);
  console.log(`  Legacy:      ${legacyStreamTime.toFixed(2)}ms`);
  console.log(`  Optimized:   ${optimizedStreamTime.toFixed(2)}ms`);
  console.log(`  Improvement: ${streamImprovement >= 0 ? '+' : ''}${streamImprovement.toFixed(1)}%`);
  console.log(`  Speedup:     ${(legacyStreamTime / optimizedStreamTime).toFixed(2)}x`);

  // Summary
  console.log(`\n\n${"=".repeat(70)}`);
  console.log("Summary");
  console.log(`${"=".repeat(70)}\n`);

  const avgImprovement = results.reduce((sum, r) => sum + r.improvement, 0) / results.length;
  const bestCase = results.reduce((best, r) => r.improvement > best.improvement ? r : best);
  const worstCase = results.reduce((worst, r) => r.improvement < worst.improvement ? r : worst);

  console.log(`Average improvement: ${avgImprovement >= 0 ? '+' : ''}${avgImprovement.toFixed(1)}%`);
  console.log(`\nBest case:`);
  console.log(`  ${bestCase.config} - ${bestCase.dataType}`);
  console.log(`  ${bestCase.improvement >= 0 ? '+' : ''}${bestCase.improvement.toFixed(1)}% (${(bestCase.legacyTime / bestCase.optimizedTime).toFixed(2)}x speedup)`);
  console.log(`\nWorst case:`);
  console.log(`  ${worstCase.config} - ${worstCase.dataType}`);
  console.log(`  ${worstCase.improvement >= 0 ? '+' : ''}${worstCase.improvement.toFixed(1)}% (${(worstCase.legacyTime / worstCase.optimizedTime).toFixed(2)}x speedup)`);

  console.log(`\n${"=".repeat(70)}`);
  console.log("Benchmark completed!");
  console.log(`${"=".repeat(70)}`);
}

// Run benchmarks
runBenchmarks().catch(console.error);
