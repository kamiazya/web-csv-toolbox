/**
 * Benchmark for comparing different queuing strategy configurations.
 *
 * This benchmark helps you find optimal highWaterMark values for your specific use case.
 * Results will vary based on:
 * - Runtime environment (Node.js version, V8 version, etc.)
 * - Available system memory
 * - File size and CSV structure
 * - CPU performance
 *
 * Usage:
 *   pnpm benchmark:queuing-strategy
 *
 * How to interpret results:
 * - Compare throughput (ops/sec) for different configurations
 * - Monitor memory usage during benchmark execution
 * - Test with data similar to your production workload
 * - Balance performance vs. memory consumption for your needs
 */

import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { Bench } from 'tinybench';
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

// Generate test CSV data of varying sizes
function generateCSV(rows: number, cols: number = 10): string {
  const header = Array.from({ length: cols }, (_, i) => `col${i}`).join(',');
  const bodyRows = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => `value${i}_${j}`).join(',')
  );
  return [header, ...bodyRows].join('\n');
}

// Test different data sizes
const smallCSV = generateCSV(100);    // ~3KB
const mediumCSV = generateCSV(1000);  // ~30KB
const largeCSV = generateCSV(10000);  // ~300KB

// Strategy configurations to test
const strategies = [
  { name: 'hwm-1', writable: 1, readable: 1 },
  { name: 'hwm-2', writable: 2, readable: 2 },
  { name: 'hwm-4', writable: 4, readable: 4 },
  { name: 'hwm-8', writable: 8, readable: 8 },
  { name: 'hwm-default-lexer', writable: 8, readable: 16 }, // CSVLexerTransformer default
  { name: 'hwm-default-assembler', writable: 16, readable: 8 }, // CSVRecordAssemblerTransformer default
  { name: 'hwm-16', writable: 16, readable: 16 },
  { name: 'hwm-32', writable: 32, readable: 32 },
  { name: 'hwm-64', writable: 64, readable: 64 },
];

async function benchmarkPipeline(
  csv: string,
  writableHWM: number,
  readableHWM: number
): Promise<void> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(csv);
      controller.close();
    }
  });

  await stream
    .pipeThrough(new CSVLexerTransformer(
      {},
      { highWaterMark: writableHWM },
      { highWaterMark: readableHWM },
    ))
    .pipeThrough(new CSVRecordAssemblerTransformer(
      {},
      { highWaterMark: writableHWM },
      { highWaterMark: readableHWM },
    ))
    .pipeTo(new WritableStream({
      write() {
        // noop - just consume the stream
      }
    }));
}

// Create benchmark suite
const bench = withCodSpeed(new Bench({
  iterations: 10,
  warmupIterations: 3,
}));

// Add benchmarks for each combination of data size and strategy
for (const { name, writable, readable } of strategies) {
  bench.add(`small (100 rows) - ${name}`, async () => {
    await benchmarkPipeline(smallCSV, writable, readable);
  });
}

for (const { name, writable, readable } of strategies) {
  bench.add(`medium (1000 rows) - ${name}`, async () => {
    await benchmarkPipeline(mediumCSV, writable, readable);
  });
}

for (const { name, writable, readable } of strategies) {
  bench.add(`large (10000 rows) - ${name}`, async () => {
    await benchmarkPipeline(largeCSV, writable, readable);
  });
}

// Run benchmarks
console.log('Starting queuing strategy benchmarks...');
console.log('This may take several minutes.\n');

await bench.warmup();
await bench.run();

console.log('\n=== Benchmark Results ===\n');
console.table(bench.table());

console.log('\n=== Interpretation Guide ===');
console.log('1. Higher ops/sec = better throughput');
console.log('2. Compare configurations for your target data size');
console.log('3. Consider memory usage (not shown here - use Node.js --inspect)');
console.log('4. Test with your actual production data for best results');
console.log('5. Balance throughput vs. memory consumption based on your constraints\n');
