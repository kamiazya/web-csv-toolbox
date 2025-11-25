/**
 * Truly Flat Implementation Benchmark
 *
 * Compares performance of:
 * 1. Legacy Object approach (processChunkBytes)
 * 2. Truly Flat approach (processChunkBytesTrulyFlat)
 *
 * Both methods assemble into objects on JS side for fair comparison.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { CSVParserOptimized, initSync } from '../src/wasm/pkg/web_csv_toolbox_wasm.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const wasmBytes = readFileSync(join(__dirname, '../src/wasm/pkg/web_csv_toolbox_wasm_bg.wasm'));
initSync({ module: wasmBytes });

function generateCSV(rows, cols) {
  const headers = Array.from({ length: cols }, (_, i) => `col_${i}`).join(',');
  const dataRows = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => `value_${i}_${j}`).join(',')
  );
  return new TextEncoder().encode([headers, ...dataRows].join('\n'));
}

function generateQuotedCSV(rows, cols) {
  const headers = Array.from({ length: cols }, (_, i) => `"col_${i}"`).join(',');
  const dataRows = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => `"value_${i}_${j}"`).join(',')
  );
  return new TextEncoder().encode([headers, ...dataRows].join('\n'));
}

function generateUTF8CSV(rows, cols) {
  const headers = Array.from({ length: cols }, (_, i) => `ヘッダー_${i}`).join(',');
  const dataRows = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => `日本語データ_${i}_${j}`).join(',')
  );
  return new TextEncoder().encode([headers, ...dataRows].join('\n'));
}

const ITERATIONS = 10;

function benchmark(name, fn, iterations = ITERATIONS) {
  // Warmup
  for (let i = 0; i < 3; i++) {
    fn();
  }

  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  const avg = times.reduce((a, b) => a + b) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  return { avg, min, max };
}

console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
console.log('║                 Truly Flat Implementation Benchmark                          ║');
console.log('║         Comparing Legacy Object vs Truly Flat Approaches                     ║');
console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

const TESTS = [
  { name: 'Small (100 rows × 10 cols)', rows: 100, cols: 10, generator: generateCSV },
  { name: 'Medium (1,000 rows × 20 cols)', rows: 1000, cols: 20, generator: generateCSV },
  { name: 'Large (10,000 rows × 50 cols)', rows: 10000, cols: 50, generator: generateCSV },
  { name: 'Wide (1,000 rows × 100 cols)', rows: 1000, cols: 100, generator: generateCSV },
  { name: 'Quoted (1,000 rows × 20 cols)', rows: 1000, cols: 20, generator: generateQuotedCSV },
  { name: 'UTF-8 (1,000 rows × 20 cols)', rows: 1000, cols: 20, generator: generateUTF8CSV },
];

const results = [];

for (const test of TESTS) {
  const data = test.generator(test.rows, test.cols);
  console.log(`\n┌─────────────────────────────────────────────────────────────────────────────┐`);
  console.log(`│ ${test.name.padEnd(75)} │`);
  console.log(`│ CSV Size: ${(data.length / 1024).toFixed(2).padStart(10)} KB                                                    │`);
  console.log(`└─────────────────────────────────────────────────────────────────────────────┘`);

  // Method A: Legacy Object approach
  const resultA = benchmark('Legacy Object', () => {
    const parser = new CSVParserOptimized({ delimiter: ',' });
    const records = parser.processChunkBytes(data);
    parser.flush();
    return records;
  });

  // Method B: Truly Flat approach
  const resultB = benchmark('Truly Flat', () => {
    const parser = new CSVParserOptimized({ delimiter: ',' });
    const result = parser.processChunkBytesTrulyFlat(data);

    // Assemble objects on JS side (same output format)
    const assembled = [];
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
    return assembled;
  });

  const improvement = ((resultA.avg - resultB.avg) / resultA.avg * 100);
  const speedup = resultA.avg / resultB.avg;
  const icon = improvement > 0 ? '✅' : '❌';

  console.log(`\n  Legacy Object:    ${resultA.avg.toFixed(2).padStart(8)} ms (baseline)`);
  console.log(`  Truly Flat:       ${resultB.avg.toFixed(2).padStart(8)} ms ${icon} ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}% (${speedup.toFixed(2)}x)`);

  // Boundary crossings comparison
  const crossingsLegacy = test.rows * (1 + test.cols);
  const crossingsFlat = 2; // headers + fieldData only

  console.log(`\n  Boundary crossings:`);
  console.log(`    Legacy:       ${crossingsLegacy.toLocaleString().padStart(12)}`);
  console.log(`    Truly Flat:   ${crossingsFlat.toLocaleString().padStart(12)} (${((crossingsLegacy - crossingsFlat) / crossingsLegacy * 100).toFixed(1)}% reduction)`);

  results.push({
    name: test.name,
    legacy: resultA.avg,
    trulyFlat: resultB.avg,
    improvement,
    speedup,
  });
}

// Summary
console.log('\n\n╔══════════════════════════════════════════════════════════════════════════════╗');
console.log('║                              Summary                                          ║');
console.log('╠══════════════════════════════════════════════════════════════════════════════╣');

for (const r of results) {
  const icon = r.improvement > 0 ? '✅' : '❌';
  console.log(`║ ${r.name.padEnd(35)} │ ${icon} ${(r.improvement > 0 ? '+' : '') + r.improvement.toFixed(1) + '%'.padEnd(10)} (${r.speedup.toFixed(2)}x) ║`);
}

const avgImprovement = results.reduce((a, b) => a + b.improvement, 0) / results.length;
const avgSpeedup = results.reduce((a, b) => a + b.speedup, 0) / results.length;
console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
console.log(`║ Average                                    │ ${avgImprovement > 0 ? '+' : ''}${avgImprovement.toFixed(1)}%      (${avgSpeedup.toFixed(2)}x)  ║`);
console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');
