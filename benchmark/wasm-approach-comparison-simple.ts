/**
 * Benchmark: WASM Integrated vs Separated approach comparison
 *
 * Compares performance of:
 * 1. Integrated approach (WASMBinaryObjectCSVParser)
 * 2. Separated approach (WASMBinaryCSVLexer + WASMCSVObjectRecordAssembler)
 */

import { loadWASM, WASMBinaryObjectCSVParser, WASMBinaryCSVLexer, WASMCSVObjectRecordAssembler } from "../dist/main.web.js";

// Generate test CSV data
function generateCSV(rows: number, columns: number): Uint8Array {
  const headers = Array.from({ length: columns }, (_, i) => `col${i}`).join(",");
  const dataRows = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: columns }, (_, j) => `value${i}_${j}`).join(",")
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
  console.log("Loading WASM...");
  // For Node.js, we need to read the WASM file manually
  const { readFileSync } = await import("fs");
  const { join, dirname } = await import("path");
  const { fileURLToPath } = await import("url");

  // Get the directory of this file
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const wasmPath = join(__dirname, "../dist/csv.wasm");
  const wasmBuffer = readFileSync(wasmPath);

  await loadWASM(wasmBuffer);
  console.log("WASM loaded.\n");

  const testSizes = [
    { rows: 100, columns: 10, name: "Small (100 rows × 10 cols)" },
    { rows: 1000, columns: 10, name: "Medium (1,000 rows × 10 cols)" },
    { rows: 10000, columns: 10, name: "Large (10,000 rows × 10 cols)" },
    { rows: 1000, columns: 50, name: "Wide (1,000 rows × 50 cols)" },
  ];

  for (const { rows, columns, name } of testSizes) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Test: ${name}`);
    console.log(`${"=".repeat(60)}`);

    const data = generateCSV(rows, columns);
    console.log(`CSV size: ${(data.length / 1024).toFixed(2)} KB\n`);

    // Test 1: Integrated approach
    const integratedTime = benchmark(
      "Integrated (WASMBinaryObjectCSVParser)",
      () => {
        const parser = new WASMBinaryObjectCSVParser();
        const records = [...parser.parse(data)];
        // Parser returns data rows only (header is consumed)
        if (records.length !== rows) {
          throw new Error(`Expected ${rows} records, got ${records.length}`);
        }
      },
      10
    );

    console.log("");

    // Test 2: Separated approach
    const separatedTime = benchmark(
      "Separated (Lexer + Assembler)",
      () => {
        const lexer = new WASMBinaryCSVLexer();
        const assembler = new WASMCSVObjectRecordAssembler();

        // Lex all tokens
        const tokens = [...lexer.lex(data)];
        // Flush lexer to get any remaining tokens
        const finalTokens = [...lexer.lex()];

        // Assemble tokens into records
        let records = [...assembler.assemble([...tokens, ...finalTokens])];
        // Flush assembler to get the final record (in case CSV doesn't end with newline)
        const finalRecords = [...assembler.assemble()];
        records = [...records, ...finalRecords];

        // Parser returns data rows only (header is consumed)
        if (records.length !== rows) {
          throw new Error(`Expected ${rows} records, got ${records.length}`);
        }
      },
      10
    );

    console.log("");

    // Calculate overhead
    const overhead = ((separatedTime - integratedTime) / integratedTime) * 100;
    console.log(`\n📊 Performance Comparison:`);
    console.log(`  Integrated:  ${integratedTime.toFixed(2)}ms`);
    console.log(`  Separated:   ${separatedTime.toFixed(2)}ms`);
    console.log(`  Overhead:    ${overhead >= 0 ? '+' : ''}${overhead.toFixed(1)}%`);
    console.log(`  Ratio:       ${(separatedTime / integratedTime).toFixed(2)}x`);
  }

  // Additional test: Streaming vs one-shot
  console.log(`\n${"=".repeat(60)}`);
  console.log("Test: Streaming vs One-shot (Medium dataset)");
  console.log(`${"=".repeat(60)}`);

  const streamData = generateCSV(1000, 10);
  const chunkSize = 1024; // 1KB chunks

  const oneShot = benchmark(
    "One-shot processing",
    () => {
      const parser = new WASMBinaryObjectCSVParser();
      const records = [...parser.parse(streamData)];
      if (records.length !== 1000) {
        throw new Error(`Expected 1000 records, got ${records.length}`);
      }
    },
    10
  );

  console.log("");

  const streaming = benchmark(
    "Streaming processing",
    () => {
      const parser = new WASMBinaryObjectCSVParser();
      let recordCount = 0;

      for (let offset = 0; offset < streamData.length; offset += chunkSize) {
        const chunk = streamData.slice(offset, offset + chunkSize);
        const isLastChunk = offset + chunkSize >= streamData.length;

        const records = [...parser.parse(chunk, { stream: !isLastChunk })];
        recordCount += records.length;
      }

      // Flush
      const remaining = [...parser.parse()];
      recordCount += remaining.length;

      if (recordCount !== 1000) {
        throw new Error(`Expected 1000 records, got ${recordCount}`);
      }
    },
    10
  );

  console.log("");

  const streamingOverhead = ((streaming - oneShot) / oneShot) * 100;
  console.log(`\n📊 Streaming Overhead:`);
  console.log(`  One-shot:    ${oneShot.toFixed(2)}ms`);
  console.log(`  Streaming:   ${streaming.toFixed(2)}ms`);
  console.log(`  Overhead:    ${streamingOverhead >= 0 ? '+' : ''}${streamingOverhead.toFixed(1)}%`);

  console.log(`\n${"=".repeat(60)}`);
  console.log("Benchmark completed!");
  console.log(`${"=".repeat(60)}`);
}

// Run benchmark
runBenchmarks().catch(console.error);
