/**
 * Final WASM Boundary Crossing Benchmark
 * Compares three approaches:
 *   A: Object creation (current)
 *   B: Flat Array via Object conversion (processChunkBytesFlat)
 *   C: Truly Flat Array (processChunkBytesTrulyFlat)
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

console.log('Final WASM Boundary Crossing Benchmark\n');
console.log('='.repeat(90));

for (const test of TESTS) {
  const data = generateCSV(test.rows, test.cols);

  // Warmup
  for (let i = 0; i < 5; i++) {
    const p = new CSVParserOptimized({ delimiter: ',' });
    p.processChunkBytes(data);
    p.flush();
  }

  // Method A: Object creation
  const timesA = [];
  for (let i = 0; i < 10; i++) {
    const parser = new CSVParserOptimized({ delimiter: ',' });
    const start = performance.now();
    const records = parser.processChunkBytes(data);
    const flush = parser.flush();
    timesA.push(performance.now() - start);
  }
  const avgA = timesA.reduce((a, b) => a + b) / timesA.length;

  // Method B: Flat Array via Object conversion
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
    timesB.push(performance.now() - start);
  }
  const avgB = timesB.reduce((a, b) => a + b) / timesB.length;

  // Method C: Truly Flat Array
  const timesC = [];
  for (let i = 0; i < 10; i++) {
    const parser = new CSVParserOptimized({ delimiter: ',' });
    const start = performance.now();
    const result = parser.processChunkBytesTrulyFlat(data);

    // Assemble records on JS side
    let assembled = [];
    if (result.headers && result.fieldData) {
      const fieldCount = result.fieldCount;
      for (let r = 0; r < result.recordCount; r++) {
        const obj = {};
        for (let f = 0; f < fieldCount; f++) {
          obj[result.headers[f]] = result.fieldData[r * fieldCount + f];
        }
        assembled.push(obj);
      }
    }
    timesC.push(performance.now() - start);
  }
  const avgC = timesC.reduce((a, b) => a + b) / timesC.length;

  const speedupB = ((avgA - avgB) / avgA * 100);
  const speedupC = ((avgA - avgC) / avgA * 100);
  const signB = speedupB > 0 ? 'faster' : 'slower';
  const signC = speedupC > 0 ? 'faster' : 'slower';

  console.log(`\n${test.name} (${test.rows} rows × ${test.cols} cols):`);
  console.log(`  Method A (Object):       ${avgA.toFixed(2)} ms (baseline)`);
  console.log(`  Method B (Flat via Obj): ${avgB.toFixed(2)} ms (${Math.abs(speedupB).toFixed(1)}% ${signB})`);
  console.log(`  Method C (Truly Flat):   ${avgC.toFixed(2)} ms (${Math.abs(speedupC).toFixed(1)}% ${signC})`);

  const boundaryA = test.rows * (1 + test.cols);
  const boundaryB = 2 + test.rows;
  const boundaryC = 2; // headers + fieldData only

  console.log(`  Boundary crossings:`);
  console.log(`    Method A: ~${boundaryA.toLocaleString()}`);
  console.log(`    Method B: ~${boundaryB.toLocaleString()} (${((boundaryA - boundaryB) / boundaryA * 100).toFixed(1)}% ↓)`);
  console.log(`    Method C: ~${boundaryC} (${((boundaryA - boundaryC) / boundaryA * 100).toFixed(1)}% ↓)`);
}

console.log('\n' + '='.repeat(90));
console.log('\nConclusion:');
console.log('  Method A: High boundary crossings, but no conversion overhead');
console.log('  Method B: Reduced crossings, but triple overhead (Obj→Obj→Array→Obj)');
console.log('  Method C: Minimal crossings (2 arrays), single conversion (Array→Obj in JS)');
console.log('\n  Winner depends on data characteristics:');
console.log('    - Large field counts: Method C likely wins');
console.log('    - Small datasets: Method A overhead is negligible');
console.log('    - Critical: JS-side object assembly cost vs WASM boundary cost');
