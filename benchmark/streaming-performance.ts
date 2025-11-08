/**
 * Performance benchmark comparing WASM streaming parsers vs JavaScript streaming parser
 *
 * Run with: npx tsx benchmark/streaming-performance.ts
 */

import { loadWASM, WASMCSVStreamTransformer, WASMBinaryCSVStreamTransformer, CSVLexerTransformer, CSVRecordAssemblerTransformer } from "web-csv-toolbox";

// Generate test CSV data
function generateCSV(rows: number): string {
  const headers = "id,name,email,age,country,city,zipcode,status";
  const lines = [headers];

  for (let i = 0; i < rows; i++) {
    const line = `${i},User${i},user${i}@example.com,${20 + (i % 50)},Country${i % 10},City${i % 20},${10000 + i},active`;
    lines.push(line);
  }

  return lines.join("\n");
}

// Measure performance of a parser
async function measureParser(
  name: string,
  csv: string,
  createStream: (csv: string) => ReadableStream<any>
): Promise<{ time: number; records: number; throughput: number }> {
  const startMemory = (process as any).memoryUsage?.()?.heapUsed || 0;
  const startTime = performance.now();

  let recordCount = 0;

  try {
    for await (const _record of createStream(csv)) {
      recordCount++;
    }
  } catch (error) {
    console.error(`Error in ${name}:`, error);
    throw error;
  }

  const endTime = performance.now();
  const endMemory = (process as any).memoryUsage?.()?.heapUsed || 0;

  const time = endTime - startTime;
  const sizeInMB = Buffer.byteLength(csv, 'utf8') / (1024 * 1024);
  const throughput = sizeInMB / (time / 1000); // MB/s
  const memoryDelta = (endMemory - startMemory) / (1024 * 1024); // MB

  return { time, records: recordCount, throughput, memoryDelta };
}

// Create WASM streaming parser (string-based)
function createWASMStream(csv: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      // Split into chunks of ~8KB for realistic streaming simulation
      const chunkSize = 8192;
      for (let i = 0; i < csv.length; i += chunkSize) {
        controller.enqueue(csv.slice(i, i + chunkSize));
      }
      controller.close();
    }
  }).pipeThrough(new WASMCSVStreamTransformer());
}

// Create WASM streaming parser (binary-based, no TextDecoder)
function createWASMBinaryStream(csv: string): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      // Split into chunks of ~8KB for realistic streaming simulation
      const chunkSize = 8192;
      for (let i = 0; i < csv.length; i += chunkSize) {
        const chunk = csv.slice(i, i + chunkSize);
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  }).pipeThrough(new WASMBinaryCSVStreamTransformer());
}

// Create JavaScript streaming parser
function createJSStream(csv: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      // Split into chunks of ~8KB
      const chunkSize = 8192;
      for (let i = 0; i < csv.length; i += chunkSize) {
        controller.enqueue(csv.slice(i, i + chunkSize));
      }
      controller.close();
    }
  })
    .pipeThrough(new CSVLexerTransformer())
    .pipeThrough(new CSVRecordAssemblerTransformer());
}

// Run benchmark for a specific row count
async function runBenchmark(rows: number, iterations: number = 3) {
  console.log(`\n${"=".repeat(90)}`);
  console.log(`Benchmark: ${rows.toLocaleString()} rows`);
  console.log(`${"=".repeat(90)}`);

  const csv = generateCSV(rows);
  const sizeInMB = (Buffer.byteLength(csv, 'utf8') / (1024 * 1024)).toFixed(2);
  console.log(`CSV size: ${sizeInMB} MB`);

  const wasmResults = [];
  const wasmBinaryResults = [];
  const jsResults = [];

  for (let i = 0; i < iterations; i++) {
    console.log(`\nIteration ${i + 1}/${iterations}`);

    // Warm up
    if (i === 0) {
      console.log("Warming up...");
      await measureParser("WASM String warmup", csv, createWASMStream);
      await measureParser("WASM Binary warmup", csv, createWASMBinaryStream);
      await measureParser("JS warmup", csv, createJSStream);
    }

    // Run WASM String benchmark
    const wasmResult = await measureParser("WASM String", csv, createWASMStream);
    wasmResults.push(wasmResult);
    console.log(`  WASM String: ${wasmResult.time.toFixed(2)}ms (${wasmResult.throughput.toFixed(2)} MB/s)`);

    // Run WASM Binary benchmark
    const wasmBinaryResult = await measureParser("WASM Binary", csv, createWASMBinaryStream);
    wasmBinaryResults.push(wasmBinaryResult);
    console.log(`  WASM Binary: ${wasmBinaryResult.time.toFixed(2)}ms (${wasmBinaryResult.throughput.toFixed(2)} MB/s)`);

    // Run JavaScript benchmark
    const jsResult = await measureParser("JavaScript", csv, createJSStream);
    jsResults.push(jsResult);
    console.log(`  JS:          ${jsResult.time.toFixed(2)}ms (${jsResult.throughput.toFixed(2)} MB/s)`);

    const speedupString = jsResult.time / wasmResult.time;
    const speedupBinary = jsResult.time / wasmBinaryResult.time;
    const binaryVsString = wasmResult.time / wasmBinaryResult.time;
    console.log(`  Speedup (String): ${speedupString.toFixed(2)}x`);
    console.log(`  Speedup (Binary): ${speedupBinary.toFixed(2)}x`);
    console.log(`  Binary vs String: ${binaryVsString.toFixed(2)}x`);
  }

  // Calculate averages
  const avgWasmTime = wasmResults.reduce((sum, r) => sum + r.time, 0) / iterations;
  const avgWasmBinaryTime = wasmBinaryResults.reduce((sum, r) => sum + r.time, 0) / iterations;
  const avgJsTime = jsResults.reduce((sum, r) => sum + r.time, 0) / iterations;
  const avgWasmThroughput = wasmResults.reduce((sum, r) => sum + r.throughput, 0) / iterations;
  const avgWasmBinaryThroughput = wasmBinaryResults.reduce((sum, r) => sum + r.throughput, 0) / iterations;
  const avgJsThroughput = jsResults.reduce((sum, r) => sum + r.throughput, 0) / iterations;
  const avgSpeedupString = avgJsTime / avgWasmTime;
  const avgSpeedupBinary = avgJsTime / avgWasmBinaryTime;
  const avgBinaryVsString = avgWasmTime / avgWasmBinaryTime;

  console.log(`\n${"─".repeat(90)}`);
  console.log("Average Results:");
  console.log(`  WASM String: ${avgWasmTime.toFixed(2)}ms (${avgWasmThroughput.toFixed(2)} MB/s)`);
  console.log(`  WASM Binary: ${avgWasmBinaryTime.toFixed(2)}ms (${avgWasmBinaryThroughput.toFixed(2)} MB/s)`);
  console.log(`  JS:          ${avgJsTime.toFixed(2)}ms (${avgJsThroughput.toFixed(2)} MB/s)`);
  console.log(`  Speedup (String): ${avgSpeedupString.toFixed(2)}x`);
  console.log(`  Speedup (Binary): ${avgSpeedupBinary.toFixed(2)}x`);
  console.log(`  Binary vs String: ${avgBinaryVsString.toFixed(2)}x (${((avgBinaryVsString - 1) * 100).toFixed(1)}% improvement)`);

  return {
    rows,
    sizeInMB: parseFloat(sizeInMB),
    wasmTime: avgWasmTime,
    wasmBinaryTime: avgWasmBinaryTime,
    jsTime: avgJsTime,
    wasmThroughput: avgWasmThroughput,
    wasmBinaryThroughput: avgWasmBinaryThroughput,
    jsThroughput: avgJsThroughput,
    speedupString: avgSpeedupString,
    speedupBinary: avgSpeedupBinary,
    binaryVsString: avgBinaryVsString
  };
}

// Main benchmark suite
async function main() {
  console.log("=".repeat(70));
  console.log("WASM Streaming Parser Performance Benchmark");
  console.log("=".repeat(70));
  console.log(`Node version: ${process.version}`);
  console.log(`Platform: ${process.platform} ${process.arch}`);

  // Load WASM module
  console.log("\nLoading WASM module...");
  await loadWASM();
  console.log("WASM module loaded successfully");

  // Run benchmarks for different sizes
  const testCases = [
    { rows: 1_000, iterations: 5 },     // ~100 KB
    { rows: 10_000, iterations: 5 },    // ~1 MB
    { rows: 100_000, iterations: 3 },   // ~10 MB
    { rows: 1_000_000, iterations: 3 }, // ~100 MB
  ];

  const results = [];

  for (const { rows, iterations } of testCases) {
    const result = await runBenchmark(rows, iterations);
    results.push(result);

    // Give some time between benchmarks
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Print summary table
  console.log("\n\n" + "=".repeat(120));
  console.log("SUMMARY TABLE");
  console.log("=".repeat(120));
  console.log();
  console.log("│ Rows      │ Size   │ WASM Str │ WASM Bin │ JS (ms)  │ Str vs JS │ Bin vs JS │ Bin vs Str │ Bin (MB/s) │ JS (MB/s) │");
  console.log("├───────────┼────────┼──────────┼──────────┼──────────┼───────────┼───────────┼────────────┼────────────┼───────────┤");

  for (const r of results) {
    const rows = r.rows.toLocaleString().padEnd(9);
    const size = `${r.sizeInMB.toFixed(1)} MB`.padEnd(6);
    const wasmTime = r.wasmTime.toFixed(1).padStart(6);
    const wasmBinTime = r.wasmBinaryTime.toFixed(1).padStart(6);
    const jsTime = r.jsTime.toFixed(1).padStart(6);
    const speedupStr = `${r.speedupString.toFixed(2)}x`.padStart(7);
    const speedupBin = `${r.speedupBinary.toFixed(2)}x`.padStart(7);
    const binVsStr = `${r.binaryVsString.toFixed(2)}x`.padStart(8);
    const binTp = r.wasmBinaryThroughput.toFixed(1).padStart(8);
    const jsTp = r.jsThroughput.toFixed(1).padStart(7);

    console.log(`│ ${rows} │ ${size} │ ${wasmTime}  │ ${wasmBinTime}  │ ${jsTime}  │ ${speedupStr}   │ ${speedupBin}   │ ${binVsStr}    │ ${binTp}   │ ${jsTp}   │`);
  }

  console.log("└───────────┴────────┴──────────┴──────────┴──────────┴───────────┴───────────┴────────────┴────────────┴───────────┘");

  // Print performance insights
  console.log("\n" + "=".repeat(120));
  console.log("PERFORMANCE INSIGHTS");
  console.log("=".repeat(120));

  const avgSpeedupBinary = results.reduce((sum, r) => sum + r.speedupBinary, 0) / results.length;
  const avgSpeedupString = results.reduce((sum, r) => sum + r.speedupString, 0) / results.length;
  const avgBinaryVsString = results.reduce((sum, r) => sum + r.binaryVsString, 0) / results.length;
  const minSpeedupBinary = Math.min(...results.map(r => r.speedupBinary));
  const maxSpeedupBinary = Math.max(...results.map(r => r.speedupBinary));

  console.log(`\nWASM Binary vs JavaScript:`);
  console.log(`  Average speedup: ${avgSpeedupBinary.toFixed(2)}x`);
  console.log(`  Speedup range: ${minSpeedupBinary.toFixed(2)}x - ${maxSpeedupBinary.toFixed(2)}x`);

  console.log(`\nWASM String vs JavaScript:`);
  console.log(`  Average speedup: ${avgSpeedupString.toFixed(2)}x`);

  console.log(`\nWASM Binary vs String:`);
  console.log(`  Average improvement: ${avgBinaryVsString.toFixed(2)}x (${((avgBinaryVsString - 1) * 100).toFixed(1)}%)`);

  if (avgSpeedupBinary >= 2.5) {
    console.log("\n✅ WASM Binary parser is significantly faster (2.5x+ speedup vs JS)");
  } else if (avgSpeedupBinary >= 2) {
    console.log("\n✅ WASM Binary parser is significantly faster (2x+ speedup vs JS)");
  } else if (avgSpeedupBinary >= 1.5) {
    console.log("\n✅ WASM Binary parser shows good performance improvement (1.5-2x speedup vs JS)");
  } else if (avgSpeedupBinary >= 1.2) {
    console.log("\n⚠️  WASM Binary parser is faster but with moderate gains (1.2-1.5x speedup vs JS)");
  } else {
    console.log("\n⚠️  WASM Binary parser performance is similar to JavaScript");
  }

  if (avgBinaryVsString >= 1.2) {
    console.log(`✅ Binary processing provides ${((avgBinaryVsString - 1) * 100).toFixed(1)}% improvement over string processing`);
  } else if (avgBinaryVsString >= 1.1) {
    console.log(`⚠️  Binary processing provides modest ${((avgBinaryVsString - 1) * 100).toFixed(1)}% improvement over string processing`);
  } else {
    console.log(`⚠️  Binary processing performance is similar to string processing`);
  }

  console.log("\nRecommendations:");
  console.log("  • Use WASM Binary streaming parser for best performance (eliminates TextDecoder overhead)");
  console.log("  • Use WASM String streaming parser when you already have string chunks");
  console.log("  • Use WASM parsers for files > 1 MB for significant performance gains");
  console.log("  • Use WASM parsers in CPU-intensive workloads");
  console.log("  • All parsers use O(1) memory per record (streaming)");

  console.log("\n" + "=".repeat(120));
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as runBenchmark };
