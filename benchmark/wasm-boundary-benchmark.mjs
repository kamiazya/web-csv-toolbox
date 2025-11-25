/**
 * WASM Boundary Crossing Benchmark
 * Compares Object creation vs Flat Array approaches
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { CSVParserOptimized, initSync } from '../web-csv-toolbox-wasm/pkg/web_csv_toolbox_wasm.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const wasmBytes = readFileSync(join(__dirname, '../web-csv-toolbox-wasm/pkg/web_csv_toolbox_wasm_bg.wasm'));
initSync({ module: wasmBytes });

function generateCSV(rows, cols) {
  const headers = Array.from({ length: cols }, (_, i) => `col_${i}`).join(',');
  const dataRows = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => `value_${i}_${j}`).join(',')
  );
  return new TextEncoder().encode([headers, ...dataRows].join('\n'));
}

const TESTS = [
  { name: 'Small  ', rows: 100, cols: 10 },
  { name: 'Medium ', rows: 1000, cols: 20 },
  { name: 'Large  ', rows: 10000, cols: 50 },
];

console.log('WASM Boundary Crossing Benchmark\n');
console.log('='.repeat(80));

for (const test of TESTS) {
  const data = generateCSV(test.rows, test.cols);

  // Warmup
  for (let i = 0; i < 5; i++) {
    const p = new CSVParserOptimized({ delimiter: ',' });
    p.processChunkBytes(data);
    p.flush();
  }

  // Method A benchmarks
  const timesA = [];
  for (let i = 0; i < 10; i++) {
    const parser = new CSVParserOptimized({ delimiter: ',' });
    const start = performance.now();
    const records = parser.processChunkBytes(data);
    const flush = parser.flush();
    const end = performance.now();
    timesA.push(end - start);
  }
  const avgA = timesA.reduce((a, b) => a + b) / timesA.length;

  // Method B benchmarks
  const timesB = [];
  for (let i = 0; i < 10; i++) {
    const parser = new CSVParserOptimized({ delimiter: ',' });
    const start = performance.now();
    const result = parser.processChunkBytesFlat(data);
    const flush = parser.processChunkBytesFlat(new Uint8Array(0));
    let assembled = [];
    if (result.headers) {
      assembled = result.records.map(values => {
        const obj = {};
        result.headers.forEach((h, i) => { obj[h] = values[i]; });
        return obj;
      });
    }
    const end = performance.now();
    timesB.push(end - start);
  }
  const avgB = timesB.reduce((a, b) => a + b) / timesB.length;

  const speedup = ((avgA - avgB) / avgA * 100);
  const sign = speedup > 0 ? 'faster' : 'slower';

  console.log(`\n${test.name} (${test.rows} rows × ${test.cols} cols):`);
  console.log(`  Method A (Object):     ${avgA.toFixed(2)} ms`);
  console.log(`  Method B (Flat Array): ${avgB.toFixed(2)} ms`);
  console.log(`  Difference: ${Math.abs(speedup).toFixed(1)}% ${sign}`);

  const boundaryA = test.rows * (1 + test.cols);
  const boundaryB = 2 + test.rows;
  console.log(`  Boundary crossings: ${boundaryA.toLocaleString()} → ${boundaryB.toLocaleString()} (${((boundaryA - boundaryB) / boundaryA * 100).toFixed(1)}% reduction)`);
}

console.log('\n' + '='.repeat(80));
console.log('\nAnalysis:');
console.log('  - Method B reduces boundary crossings by 90%+');
console.log('  - Current Method B implementation has overhead from:');
console.log('    1. Object creation in WASM (process_bytes_optimized)');
console.log('    2. Object→Array conversion (to_flat_format)');
console.log('    3. JS-side Array→Object assembly');
console.log('  - For true optimization, need to implement process_bytes_optimized_flat()');
console.log('    that uses finish_record_flat() directly');
