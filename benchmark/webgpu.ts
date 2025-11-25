/**
 * WebGPU CSV Parser Benchmark for Node.js
 *
 * Uses the `webgpu` npm package (Google Dawn) to benchmark the WebGPU parser
 * via the public parseString API with EnginePresets.gpuAccelerated().
 *
 * Run with: pnpm tsx benchmark/webgpu.ts
 */

import { create, globals } from "webgpu";
import { Bench } from "tinybench";
import { EnginePresets, parseString } from "../src/main.shared.ts";

// Install WebGPU globals
Object.assign(globalThis, globals);

// Create GPU instance and make it available as navigator.gpu
const gpu = create([]) as unknown as GPU;
Object.defineProperty(globalThis, "navigator", {
  value: { gpu },
  writable: true,
});

// Check if WebGPU is available
const adapter = await gpu.requestAdapter();
if (!adapter) {
  console.error("❌ WebGPU adapter not available. Exiting.");
  process.exit(1);
}

console.log("=== WebGPU CSV Parser Benchmark (Node.js) ===\n");
console.log("Using Google Dawn via webgpu npm package\n");
console.log("Parsing via parseString() with EnginePresets.gpuAccelerated()\n");

// Helper to generate CSV data
function generateCSV(rows: number, cols: number, fieldLength = 10): string {
  const header = Array.from({ length: cols }, (_, i) => `col${i}`).join(",");
  const dataRows = Array.from({ length: rows }, (_, rowIdx) =>
    Array.from({ length: cols }, (_, colIdx) => `${"x".repeat(fieldLength)}`).join(","),
  );
  return [header, ...dataRows].join("\n");
}

// Helper to generate CSV with long quoted fields (tests two-pass algorithm)
function generateLongQuotedCSV(rows: number, fieldLength: number): string {
  const header = "id,name,content";
  const dataRows = Array.from(
    { length: rows },
    (_, i) => `${i},"Name${i}","${"a".repeat(fieldLength)}"`,
  );
  return [header, ...dataRows].join("\n");
}

// Helper to parse CSV with WebGPU via public API
async function parseWithWebGPU(csvData: string): Promise<number> {
  let recordCount = 0;

  for await (const _record of parseString(csvData, {
    engine: EnginePresets.gpuAccelerated(),
  })) {
    recordCount++;
  }

  return recordCount;
}

// Generate test datasets
const small = generateCSV(100, 10);
const medium = generateCSV(1000, 10);
const large = generateCSV(10000, 10);

// Long quoted fields (tests two-pass algorithm)
const longQuoted300 = generateLongQuotedCSV(100, 300); // 300 bytes per field
const longQuoted1K = generateLongQuotedCSV(100, 1000); // 1KB per field
const longQuoted10K = generateLongQuotedCSV(10, 10000); // 10KB per field

console.log("Dataset sizes:");
console.log(`  - small: ${(small.length / 1024).toFixed(1)} KB (100 rows)`);
console.log(`  - medium: ${(medium.length / 1024).toFixed(1)} KB (1000 rows)`);
console.log(`  - large: ${(large.length / 1024).toFixed(1)} KB (10000 rows)`);
console.log(
  `  - longQuoted300: ${(longQuoted300.length / 1024).toFixed(1)} KB (300-byte quoted fields)`,
);
console.log(
  `  - longQuoted1K: ${(longQuoted1K.length / 1024).toFixed(1)} KB (1KB quoted fields)`,
);
console.log(
  `  - longQuoted10K: ${(longQuoted10K.length / 1024).toFixed(1)} KB (10KB quoted fields)`,
);
console.log();

// Warmup
console.log("Warming up GPU...");
await parseWithWebGPU(small);
await parseWithWebGPU(small);
console.log("Warmup complete.\n");

const bench = new Bench({ iterations: 20 });

bench
  .add("WebGPU: small (100 rows)", async () => {
    await parseWithWebGPU(small);
  })
  .add("WebGPU: medium (1000 rows)", async () => {
    await parseWithWebGPU(medium);
  })
  .add("WebGPU: large (10000 rows)", async () => {
    await parseWithWebGPU(large);
  })
  .add("WebGPU: longQuoted 300B (two-pass)", async () => {
    await parseWithWebGPU(longQuoted300);
  })
  .add("WebGPU: longQuoted 1KB (two-pass)", async () => {
    await parseWithWebGPU(longQuoted1K);
  })
  .add("WebGPU: longQuoted 10KB (two-pass)", async () => {
    await parseWithWebGPU(longQuoted10K);
  });

console.log("Running benchmarks...\n");
await bench.run();

console.log("=== Results ===\n");
console.table(bench.table());

// Calculate throughput
console.log("\n=== Throughput Analysis ===\n");
for (const task of bench.tasks) {
  if (!task.result) continue;

  const datasetSize =
    task.name.includes("small")
      ? small.length
      : task.name.includes("medium")
        ? medium.length
        : task.name.includes("large")
          ? large.length
          : task.name.includes("300B")
            ? longQuoted300.length
            : task.name.includes("1KB")
              ? longQuoted1K.length
              : longQuoted10K.length;

  const opsPerSec = 1000 / task.result.mean;
  const throughputMBps = (datasetSize * opsPerSec) / (1024 * 1024);

  console.log(`${task.name}:`);
  console.log(`  - Avg time: ${task.result.mean.toFixed(2)} ms`);
  console.log(`  - Ops/sec: ${opsPerSec.toFixed(1)}`);
  console.log(`  - Throughput: ${throughputMBps.toFixed(2)} MB/s`);
  console.log();
}

console.log("=== Two-Pass Algorithm Performance ===");
console.log(
  "Long quoted fields (>256 bytes) require the two-pass algorithm for correct parsing.",
);
console.log(
  "Compare throughput between regular and long-quoted tests to measure overhead.\n",
);
