/**
 * Concurrent execution benchmark
 *
 * This benchmark tests how well the worker can handle concurrent parsing requests
 * and compares it with sequential execution in the main thread.
 */

import { Bench } from 'tinybench';
import { parseString } from 'web-csv-toolbox';

// Generate CSV data
function generateCSV(rows: number, seed: number): string {
  return [
    'id,name,value,timestamp',
    ...Array.from({ length: rows }, (_, i) =>
      `${i + seed},Item${i + seed},${(i + seed) * 1.5},${Date.now() + i}`
    ),
  ].join('\n');
}

console.log('=== Concurrent Execution Benchmark ===\n');

const NUM_CONCURRENT = 5;
const ROWS_PER_CSV = 500;

console.log(`Configuration:`);
console.log(`- Number of concurrent CSVs: ${NUM_CONCURRENT}`);
console.log(`- Rows per CSV: ${ROWS_PER_CSV}`);
console.log(`- Total rows to process: ${NUM_CONCURRENT * ROWS_PER_CSV}\n`);

// Generate test data
const csvDatasets = Array.from({ length: NUM_CONCURRENT }, (_, i) =>
  generateCSV(ROWS_PER_CSV, i * 1000)
);

const bench = new Bench({ iterations: 5 });

// Sequential main thread execution
bench.add('Sequential (main thread)', async () => {
  for (const csv of csvDatasets) {
    const records = [];
    for await (const record of parseString(csv, { execution: [] })) {
      records.push(record);
    }
  }
});

// Concurrent main thread execution
bench.add('Concurrent (main thread)', async () => {
  await Promise.all(
    csvDatasets.map(async (csv) => {
      const records = [];
      for await (const record of parseString(csv, { execution: [] })) {
        records.push(record);
      }
    })
  );
});

// Sequential worker execution
bench.add('Sequential (worker)', async () => {
  for (const csv of csvDatasets) {
    const records = [];
    for await (const record of parseString(csv, { execution: ['worker'] })) {
      records.push(record);
    }
  }
});

// Concurrent worker execution
bench.add('Concurrent (worker)', async () => {
  await Promise.all(
    csvDatasets.map(async (csv) => {
      const records = [];
      for await (const record of parseString(csv, { execution: ['worker'] })) {
        records.push(record);
      }
    })
  );
});

console.log('Running benchmark...\n');

await bench.warmup();
await bench.run();

// Display results
const results = bench.tasks.map(task => ({
  'Strategy': task.name,
  'Avg Time (ms)': task.result?.mean ? (task.result.mean / 1000000).toFixed(2) : 'N/A',
  'Min (ms)': task.result?.min ? (task.result.min / 1000000).toFixed(2) : 'N/A',
  'Max (ms)': task.result?.max ? (task.result.max / 1000000).toFixed(2) : 'N/A',
  'Throughput (rows/sec)': task.result?.hz
    ? (task.result.hz * NUM_CONCURRENT * ROWS_PER_CSV).toFixed(0)
    : 'N/A',
}));

console.table(results);

// Analysis
const sequentialMain = bench.tasks.find(t => t.name === 'Sequential (main thread)');
const concurrentMain = bench.tasks.find(t => t.name === 'Concurrent (main thread)');
const sequentialWorker = bench.tasks.find(t => t.name === 'Sequential (worker)');
const concurrentWorker = bench.tasks.find(t => t.name === 'Concurrent (worker)');

console.log('\n=== Analysis ===\n');

if (sequentialMain?.result?.mean && concurrentMain?.result?.mean) {
  const speedup = ((sequentialMain.result.mean / concurrentMain.result.mean - 1) * 100).toFixed(1);
  console.log(`Main thread concurrent speedup: ${speedup}%`);
  console.log(`(Note: Main thread concurrency is limited by JavaScript's single-threaded nature)\n`);
}

if (sequentialWorker?.result?.mean && concurrentWorker?.result?.mean) {
  const speedup = ((sequentialWorker.result.mean / concurrentWorker.result.mean - 1) * 100).toFixed(1);
  console.log(`Worker concurrent speedup: ${speedup}%`);
  console.log(`(Worker can queue multiple requests efficiently)\n`);
}

if (concurrentMain?.result?.mean && concurrentWorker?.result?.mean) {
  const comparison = concurrentMain.result.mean / concurrentWorker.result.mean;
  if (comparison > 1) {
    const faster = ((comparison - 1) * 100).toFixed(1);
    console.log(`✅ Concurrent worker is ${faster}% faster than concurrent main thread`);
  } else {
    const slower = ((1 / comparison - 1) * 100).toFixed(1);
    console.log(`⚠️  Concurrent worker is ${slower}% slower than concurrent main thread`);
  }
}

console.log('\n=== Recommendations ===');
console.log('- For processing multiple CSVs concurrently, worker execution can help distribute the load');
console.log('- Worker is beneficial when you need to keep the main thread responsive during parsing');
console.log('- For single CSV parsing, consider the CSV size and worker overhead trade-off');
