/**
 * Lexer Flat Implementation Benchmark
 *
 * Compares performance of Truly Flat lexer optimization.
 * The lexer now uses flat arrays for token data, reducing WASM↔JS boundary crossing.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';
import { BinaryCSVLexerLegacy, initSync } from '../web-csv-toolbox-wasm/pkg/web_csv_toolbox_wasm.js';

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
console.log('║                     Lexer Flat Implementation Benchmark                      ║');
console.log('║              Comparing Legacy lex() vs Truly Flat lexFlat()                  ║');
console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

const TESTS = [
  { name: 'Small (100 rows × 10 cols)', rows: 100, cols: 10, generator: generateCSV },
  { name: 'Medium (1,000 rows × 20 cols)', rows: 1000, cols: 20, generator: generateCSV },
  { name: 'Large (5,000 rows × 20 cols)', rows: 5000, cols: 20, generator: generateCSV },
  { name: 'Wide (500 rows × 50 cols)', rows: 500, cols: 50, generator: generateCSV },
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

  // Method A: Legacy lex() - returns array of token objects
  const resultA = benchmark('Legacy lex()', () => {
    const lexer = new BinaryCSVLexerLegacy({ delimiter: ',' });
    const tokens = lexer.lex(data);
    lexer.lex(); // flush
    return tokens;
  });

  // Method B: Truly Flat lexFlat() - returns flat arrays
  const resultB = benchmark('Flat lexFlat()', () => {
    const lexer = new BinaryCSVLexerLegacy({ delimiter: ',' });
    const flatResult = lexer.lexFlat(data);
    lexer.lexFlat(); // flush

    // Assemble tokens on JS side (to simulate real usage)
    const tokens = [];
    for (let i = 0; i < flatResult.tokenCount; i++) {
      tokens.push({
        type: flatResult.types[i],
        value: flatResult.values[i],
        line: flatResult.lines[i],
        column: flatResult.columns[i],
        offset: flatResult.offsets[i],
      });
    }
    return tokens;
  });

  const improvement = ((resultA.avg - resultB.avg) / resultA.avg * 100);
  const speedup = resultA.avg / resultB.avg;
  const icon = improvement > 0 ? '✅' : '❌';

  console.log(`\n  Legacy lex():     ${resultA.avg.toFixed(2).padStart(8)} ms (baseline)`);
  console.log(`  Flat lexFlat():   ${resultB.avg.toFixed(2).padStart(8)} ms ${icon} ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}% (${speedup.toFixed(2)}x)`);

  // Token count (approximate)
  const approxTokens = test.rows * (test.cols * 2 + 1); // fields + delimiters + newlines
  console.log(`\n  Approximate tokens: ${approxTokens.toLocaleString()}`);
  console.log(`  Boundary crossings:`);
  console.log(`    Legacy:       ${approxTokens.toLocaleString().padStart(12)} (one per token)`);
  console.log(`    Flat:         ${(5).toLocaleString().padStart(12)} (5 arrays only)`);

  results.push({
    name: test.name,
    legacy: resultA.avg,
    flat: resultB.avg,
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
