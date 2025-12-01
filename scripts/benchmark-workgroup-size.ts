/**
 * Workgroup Size Benchmark Script
 *
 * Compares performance of different workgroup sizes (32, 64, 128, 256, 512)
 * for the WebGPU CSV separator indexing backend.
 *
 * Usage:
 *   npx tsx scripts/benchmark-workgroup-size.ts
 */

import webgpu from "webgpu";
import { CSVSeparatorIndexingBackend } from "../src/parser/webgpu/indexing/CSVSeparatorIndexingBackend.ts";
import type { WorkgroupSize } from "../src/webgpu/utils/workgroupSize.ts";

// Install WebGPU globals
Object.assign(globalThis, webgpu.globals);

interface BenchmarkResult {
  workgroupSize: WorkgroupSize;
  iterations: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  throughputMBps: number;
}

async function generateCSVData(sizeBytes: number): Promise<Uint8Array> {
  // Generate realistic CSV data
  const rows: string[] = [];
  rows.push("id,name,email,value,description");

  let currentSize = rows[0]!.length + 1;
  let id = 1;

  while (currentSize < sizeBytes) {
    const row = `${id},"User ${id}",user${id}@example.com,${Math.random() * 1000},"Description for item ${id}"`;
    rows.push(row);
    currentSize += row.length + 1;
    id++;
  }

  const csv = rows.join("\n") + "\n";
  return new TextEncoder().encode(csv);
}

async function runBenchmark(
  gpu: GPU,
  workgroupSize: WorkgroupSize,
  data: Uint8Array,
  iterations: number,
): Promise<BenchmarkResult> {
  const times: number[] = [];

  // Create backend with specific workgroup size
  const backend = await CSVSeparatorIndexingBackend.create({
    gpu,
    workgroupSize,
  });

  try {
    // Warmup
    await backend.run(data, false);
    await backend.run(data, false);

    // Benchmark iterations
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await backend.run(data, false);
      const elapsed = performance.now() - start;
      times.push(elapsed);
    }
  } finally {
    await backend.destroy();
  }

  const avgMs = times.reduce((a, b) => a + b, 0) / times.length;
  const minMs = Math.min(...times);
  const maxMs = Math.max(...times);
  const throughputMBps = (data.length / 1024 / 1024) / (avgMs / 1000);

  return {
    workgroupSize,
    iterations,
    avgMs,
    minMs,
    maxMs,
    throughputMBps,
  };
}

async function main() {
  console.log("=".repeat(60));
  console.log("WebGPU Workgroup Size Benchmark");
  console.log("=".repeat(60));
  console.log();

  // Create GPU instance
  const gpu = webgpu.create([]) as unknown as GPU;
  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    console.error("Failed to get GPU adapter");
    process.exit(1);
  }

  console.log("GPU Adapter Info:");
  console.log(`  Max Workgroup Size X: ${adapter.limits.maxComputeWorkgroupSizeX}`);
  console.log(`  Max Invocations Per Workgroup: ${adapter.limits.maxComputeInvocationsPerWorkgroup}`);
  console.log();

  // Test configurations
  const dataSizes = [
    { name: "1 MB", bytes: 1 * 1024 * 1024 },
    { name: "4 MB", bytes: 4 * 1024 * 1024 },
    { name: "16 MB", bytes: 16 * 1024 * 1024 },
  ];

  const workgroupSizes: WorkgroupSize[] = [32, 64, 128, 256];
  const iterations = 10;

  // Check if 512 is supported
  if (adapter.limits.maxComputeWorkgroupSizeX >= 512 &&
      adapter.limits.maxComputeInvocationsPerWorkgroup >= 512) {
    workgroupSizes.push(512);
  }

  for (const { name, bytes } of dataSizes) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`Data Size: ${name}`);
    console.log("─".repeat(60));

    const data = await generateCSVData(bytes);
    console.log(`  Actual size: ${(data.length / 1024 / 1024).toFixed(2)} MB`);
    console.log();

    const results: BenchmarkResult[] = [];

    for (const wgSize of workgroupSizes) {
      try {
        const result = await runBenchmark(gpu, wgSize, data, iterations);
        results.push(result);

        console.log(`  Workgroup Size: ${wgSize}`);
        console.log(`    Avg: ${result.avgMs.toFixed(2)} ms`);
        console.log(`    Min: ${result.minMs.toFixed(2)} ms`);
        console.log(`    Max: ${result.maxMs.toFixed(2)} ms`);
        console.log(`    Throughput: ${result.throughputMBps.toFixed(2)} MB/s`);
        console.log();
      } catch (error) {
        console.log(`  Workgroup Size: ${wgSize}`);
        console.log(`    ERROR: ${error instanceof Error ? error.message : String(error)}`);
        console.log();
      }
    }

    // Summary table
    if (results.length > 0) {
      console.log("  Summary:");
      console.log("  ┌────────────┬──────────┬──────────────┐");
      console.log("  │ WG Size    │ Avg (ms) │ Throughput   │");
      console.log("  ├────────────┼──────────┼──────────────┤");

      const fastest = results.reduce((a, b) => a.avgMs < b.avgMs ? a : b);

      for (const r of results) {
        const isFastest = r === fastest ? " *" : "  ";
        console.log(
          `  │ ${String(r.workgroupSize).padStart(6)}    │ ${r.avgMs.toFixed(2).padStart(8)} │ ${r.throughputMBps.toFixed(2).padStart(8)} MB/s│${isFastest}`
        );
      }
      console.log("  └────────────┴──────────┴──────────────┘");
      console.log(`  * = fastest`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Benchmark Complete");
  console.log("=".repeat(60));
}

main().catch(console.error);
