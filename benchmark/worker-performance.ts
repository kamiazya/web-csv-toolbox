/**
 * Worker execution performance benchmark
 *
 * This benchmark compares main thread vs worker execution performance
 * across different CSV sizes to understand:
 * 1. Worker initialization overhead
 * 2. Message passing overhead
 * 3. Break-even point where worker becomes beneficial
 */

import { Bench } from 'tinybench';
import { parseString, parseBinary, parseStringStream, parseUint8ArrayStream } from 'web-csv-toolbox';

// Generate CSV data of different sizes
function generateCSV(rows: number): string {
  return [
    'id,name,email,age,city,country',
    ...Array.from({ length: rows }, (_, i) =>
      `${i},User${i},user${i}@example.com,${20 + (i % 50)},City${i % 100},Country${i % 20}`
    ),
  ].join('\n');
}

// Test configurations
const testSizes = [
  { name: 'Tiny (10 rows)', rows: 10 },
  { name: 'Small (100 rows)', rows: 100 },
  { name: 'Medium (1000 rows)', rows: 1000 },
  { name: 'Large (10000 rows)', rows: 10000 },
];

console.log('=== Worker Performance Benchmark ===\n');

for (const { name, rows } of testSizes) {
  console.log(`\n--- ${name} ---`);
  const csv = generateCSV(rows);
  const csvBinary = new TextEncoder().encode(csv);

  const bench = new Bench({ iterations: 10 });

  // String parsing
  bench.add(`parseString (main thread)`, async () => {
    const records = [];
    for await (const record of parseString(csv, { execution: [] })) {
      records.push(record);
    }
  });

  bench.add(`parseString (worker)`, async () => {
    const records = [];
    for await (const record of parseString(csv, { execution: ['worker'] })) {
      records.push(record);
    }
  });

  // Binary parsing
  bench.add(`parseBinary (main thread)`, async () => {
    const records = [];
    const result = parseBinary(csvBinary, { execution: [] });
    const iterator = result instanceof Promise ? await result : result;
    for await (const record of iterator) {
      records.push(record);
    }
  });

  bench.add(`parseBinary (worker)`, async () => {
    const records = [];
    const result = parseBinary(csvBinary, { execution: ['worker'] });
    const iterator = result instanceof Promise ? await result : result;
    for await (const record of iterator) {
      records.push(record);
    }
  });

  // Stream parsing
  bench.add(`parseStringStream (main thread)`, async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(csv);
        controller.close();
      }
    });
    const records = [];
    const result = parseStringStream(stream, { execution: [] });
    const iterator = result instanceof Promise ? await result : result;
    for await (const record of iterator) {
      records.push(record);
    }
  });

  bench.add(`parseStringStream (worker)`, async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(csv);
        controller.close();
      }
    });
    const records = [];
    const result = parseStringStream(stream, { execution: ['worker'] });
    const iterator = result instanceof Promise ? await result : result;
    for await (const record of iterator) {
      records.push(record);
    }
  });

  await bench.warmup();
  await bench.run();

  // Display results with comparison
  const results = bench.tasks.map(task => ({
    'Task': task.name,
    'Avg Time (ms)': task.result?.mean ? (task.result.mean / 1000000).toFixed(3) : 'N/A',
    'Min (ms)': task.result?.min ? (task.result.min / 1000000).toFixed(3) : 'N/A',
    'Max (ms)': task.result?.max ? (task.result.max / 1000000).toFixed(3) : 'N/A',
    'Ops/sec': task.result?.hz ? task.result.hz.toFixed(0) : 'N/A',
  }));

  console.table(results);

  // Calculate overhead
  const mainThreadTask = bench.tasks.find(t => t.name.includes('parseString (main thread)'));
  const workerTask = bench.tasks.find(t => t.name.includes('parseString (worker)'));

  if (mainThreadTask?.result?.mean && workerTask?.result?.mean) {
    const mainTime = mainThreadTask.result.mean / 1000000;
    const workerTime = workerTask.result.mean / 1000000;
    const overhead = workerTime - mainTime;
    const overheadPercent = ((overhead / mainTime) * 100).toFixed(1);

    console.log(`\nWorker overhead: ${overhead.toFixed(3)}ms (${overheadPercent}%)`);

    if (workerTime < mainTime) {
      const speedup = ((mainTime / workerTime - 1) * 100).toFixed(1);
      console.log(`✅ Worker is ${speedup}% faster`);
    } else {
      const slowdown = ((workerTime / mainTime - 1) * 100).toFixed(1);
      console.log(`⚠️  Worker is ${slowdown}% slower (overhead dominates)`);
    }
  }
}

console.log('\n=== Summary ===');
console.log('For small CSV files (<100 rows), main thread execution is typically faster due to worker overhead.');
console.log('For large CSV files (>1000 rows), worker execution can be beneficial for keeping the main thread responsive.');
console.log('The break-even point depends on the CSV complexity and system performance.');
