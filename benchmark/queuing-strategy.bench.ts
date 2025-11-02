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
// Each configuration specifies highWaterMark values for each stage of the pipeline
// Note: Default strategies use custom size algorithms (character count, token count, etc.)
const strategies = [
  {
    name: 'hwm-defaults',
    lexerWritable: 65536,   // 64KB characters (default)
    lexerReadable: 1024,    // 1024 tokens (default)
    assemblerWritable: 1024, // 1024 tokens (default)
    assemblerReadable: 256   // 256 records (default)
  },
  {
    name: 'hwm-small',
    lexerWritable: 16384,   // 16KB characters
    lexerReadable: 256,     // 256 tokens
    assemblerWritable: 256, // 256 tokens
    assemblerReadable: 64   // 64 records
  },
  {
    name: 'hwm-large',
    lexerWritable: 131072,  // 128KB characters
    lexerReadable: 2048,    // 2048 tokens
    assemblerWritable: 2048, // 2048 tokens
    assemblerReadable: 512   // 512 records
  },
  {
    name: 'hwm-xlarge',
    lexerWritable: 262144,  // 256KB characters
    lexerReadable: 4096,    // 4096 tokens
    assemblerWritable: 4096, // 4096 tokens
    assemblerReadable: 1024  // 1024 records
  },
];

async function benchmarkPipeline(
  csv: string,
  lexerWritableHWM: number,
  lexerReadableHWM: number,
  assemblerWritableHWM: number,
  assemblerReadableHWM: number,
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
      { highWaterMark: lexerWritableHWM, size: (chunk) => chunk.length },
      { highWaterMark: lexerReadableHWM, size: (tokens) => tokens.length },
    ))
    .pipeThrough(new CSVRecordAssemblerTransformer(
      {},
      { highWaterMark: assemblerWritableHWM, size: (tokens) => tokens.length },
      { highWaterMark: assemblerReadableHWM, size: () => 1 },
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
for (const { name, lexerWritable, lexerReadable, assemblerWritable, assemblerReadable } of strategies) {
  bench.add(`small (100 rows) - ${name}`, async () => {
    await benchmarkPipeline(smallCSV, lexerWritable, lexerReadable, assemblerWritable, assemblerReadable);
  });
}

for (const { name, lexerWritable, lexerReadable, assemblerWritable, assemblerReadable } of strategies) {
  bench.add(`medium (1000 rows) - ${name}`, async () => {
    await benchmarkPipeline(mediumCSV, lexerWritable, lexerReadable, assemblerWritable, assemblerReadable);
  });
}

for (const { name, lexerWritable, lexerReadable, assemblerWritable, assemblerReadable } of strategies) {
  bench.add(`large (10000 rows) - ${name}`, async () => {
    await benchmarkPipeline(largeCSV, lexerWritable, lexerReadable, assemblerWritable, assemblerReadable);
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
