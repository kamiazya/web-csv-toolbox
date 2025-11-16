
import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { Bench } from 'tinybench';
import {
  FlexibleStringCSVLexer,
  CSVLexerTransformer,
  FlexibleCSVRecordAssembler,
  CSVRecordAssemblerTransformer,
  EnginePresets,
  loadWASM,
  parseBinary,
  parseString,
  parseStringStream,
  parseStringToArraySyncWASM,
  parseUint8ArrayStream
} from 'web-csv-toolbox';

// Helper to generate CSV with specified columns and rows
function generateCSV(columns: number, rows: number, quoted: boolean = false): string {
  const header = Array.from({length: columns}, (_, i) => `col${i}`).join(',');
  const dataRows = Array.from({length: rows}, (_, rowIdx) =>
    Array.from({length: columns}, (_, colIdx) => {
      const value = `val${rowIdx}_${colIdx}`;
      return quoted ? `"${value}"` : value;
    }).join(',')
  );
  return [header, ...dataRows, ''].join('\n');
}

const csv = [
  // header
  'index,"quated",not quated',
  // body
  // e.g.
  // 10,"xxxxxxxxxx",yyyyyyyyyy
  ...Array.from({length: 50}, (_, i) => `${i},"${'x'.repeat(i)}",${'y'.repeat(i)}`),
  // for the last line
  ''
].join('\n');

// Generate CSVs with different column counts (unquoted)
const csv10cols = generateCSV(10, 50);
const csv50cols = generateCSV(50, 50);
const csv100cols = generateCSV(100, 50);
const csv10000cols = generateCSV(10000, 10); // Reduced rows for 10k columns

// Generate CSVs with different column counts (quoted)
const csv10colsQuoted = generateCSV(10, 50, true);
const csv50colsQuoted = generateCSV(50, 50, true);
const csv100colsQuoted = generateCSV(100, 50, true);
const csv10000colsQuoted = generateCSV(10000, 10, true);

// Generate delimited values with custom delimiter
function generateDelimitedValues(rows: number, delimiter: string): string {
  const header = `name${delimiter}age${delimiter}email`;
  const dataRows = Array.from({length: rows}, (_, i) =>
    `User${i}${delimiter}${20 + i}${delimiter}user${i}@example.com`
  );
  return [header, ...dataRows].join('\n');
}

const tsv100 = generateDelimitedValues(100, '\t');
const psv100 = generateDelimitedValues(100, '|');

// Generate CSVs with different field lengths to detect string processing bottlenecks
function generateCSVWithFieldLength(rows: number, fieldLength: number): string {
  const header = 'id,shortField,targetField,anotherField';
  const dataRows = Array.from({length: rows}, (_, i) =>
    `${i},short,${'x'.repeat(fieldLength)},another`
  );
  return [header, ...dataRows].join('\n');
}

const csvShortFields = generateCSVWithFieldLength(1000, 10);      // 10 chars
const csvMediumFields = generateCSVWithFieldLength(1000, 100);    // 100 chars
const csvLongFields = generateCSVWithFieldLength(1000, 1000);     // 1KB per field
const csvVeryLongFields = generateCSVWithFieldLength(100, 10000); // 10KB per field

// Generate CSVs with different row counts for bottleneck detection
function generateCSVForRowCount(rows: number): string {
  return generateCSV(10, rows);
}

const csv50rows = generateCSVForRowCount(50);
const csv100rows = generateCSVForRowCount(100);
const csv500rows = generateCSVForRowCount(500);
const csv1000rows = generateCSVForRowCount(1000);
const csv5000rows = generateCSVForRowCount(5000);

// Generate CSVs with different quoting patterns
function generateCSVWithQuotingPattern(rows: number, quoteRatio: number): string {
  const header = 'id,name,email,score';
  const dataRows = Array.from({length: rows}, (_, i) => {
    const shouldQuote = (i % 100) < (quoteRatio * 100);
    const name = shouldQuote ? `"User${i}"` : `User${i}`;
    const email = shouldQuote ? `"user${i}@example.com"` : `user${i}@example.com`;
    return `${i},${name},${email},${i * 10}`;
  });
  return [header, ...dataRows].join('\n');
}

const csvNoQuotes = generateCSVWithQuotingPattern(1000, 0);      // 0% quoted
const csv25PercentQuoted = generateCSVWithQuotingPattern(1000, 0.25);  // 25% quoted
const csv50PercentQuoted = generateCSVWithQuotingPattern(1000, 0.5);   // 50% quoted
const csv100PercentQuoted = generateCSVWithQuotingPattern(1000, 1);    // 100% quoted

// Generate CSVs with different line endings
function generateCSVWithLineEnding(rows: number, lineEnding: string): string {
  const header = 'id,name,value';
  const dataRows = Array.from({length: rows}, (_, i) => `${i},User${i},${i * 100}`);
  return [header, ...dataRows].join(lineEnding);
}

const csvLF = generateCSVWithLineEnding(1000, '\n');
const csvCRLF = generateCSVWithLineEnding(1000, '\r\n');

export async function getAsString() {
  return csv;
}

export async function getAsBinary() {
  return new TextEncoder().encode(csv);
}

export async function getAsBinaryStream() {
  return new Blob([csv], { type: 'text/csv' }).stream();
}

// Load WASM module before benchmarks and track availability
let wasmAvailable = false;
try {
  await loadWASM();
  wasmAvailable = true;
} catch {
  console.warn('WASM module not available, WASM-dependent benchmarks will be skipped');
}

let binaryCSV: Uint8Array = await getAsBinary()
let stringCSV: string = await getAsString();

// CSV with more rows for worker overhead comparison
const largeCSV = [
  'index,"quated",not quated',
  ...Array.from({length: 1000}, (_, i) => `${i},"${'x'.repeat(i % 100)}",${'y'.repeat(i % 100)}`),
  ''
].join('\n');

// Generate CSVs for worker performance tests (different sizes)
function generateWorkerTestCSV(rows: number): string {
  return [
    'id,name,email,age,city,country',
    ...Array.from({ length: rows }, (_, i) =>
      `${i},User${i},user${i}@example.com,${20 + (i % 50)},City${i % 100},Country${i % 20}`
    ),
  ].join('\n');
}

const tinyCSV = generateWorkerTestCSV(10);
const smallWorkerCSV = generateWorkerTestCSV(100);
const mediumWorkerCSV = generateWorkerTestCSV(1000);
const largeWorkerCSV = generateWorkerTestCSV(10000);

// Generate CSVs for concurrent execution tests
function generateConcurrentCSV(rows: number, seed: number): string {
  // Use deterministic timestamp for reproducible benchmarks
  const baseTimestamp = 1704067200000; // Fixed timestamp: 2024-01-01 00:00:00 UTC
  return [
    'id,name,value,timestamp',
    ...Array.from({ length: rows }, (_, i) =>
      `${i + seed},Item${i + seed},${(i + seed) * 1.5},${baseTimestamp + seed * 1000 + i}`
    ),
  ].join('\n');
}

const NUM_CONCURRENT = 5;
const ROWS_PER_CONCURRENT_CSV = 500;
const concurrentDatasets = Array.from({ length: NUM_CONCURRENT }, (_, i) =>
  generateConcurrentCSV(ROWS_PER_CONCURRENT_CSV, i * 1000)
);

// Generate CSVs for queuing strategy tests (reuses generateCSV)
function generateQueuingTestCSV(rows: number, cols: number = 10): string {
  // Reuse generateCSV and remove trailing newline
  const csv = generateCSV(cols, rows);
  return csv.endsWith('\n') ? csv.slice(0, -1) : csv;
}

const smallQueuingCSV = generateQueuingTestCSV(100);    // ~3KB
const mediumQueuingCSV = generateQueuingTestCSV(1000);  // ~30KB
const largeQueuingCSV = generateQueuingTestCSV(10000);  // ~300KB

// Check if Worker is available (browser environment)
const isWorkerAvailable = typeof Worker !== 'undefined';

console.log('=== CSV Parsing Performance Benchmark ===\n');
console.log('Running comprehensive benchmarks for bottleneck detection...');
console.log('\nBenchmark Categories:');
console.log('  1. Basic parsing APIs (parseString, parseBinary, parseStringStream)');
console.log('  2. Engine presets (stable, fast, responsive, memoryEfficient, responsiveFast, balanced)');
console.log('  3. Column variations (10-10,000 columns)');
console.log('  4. Quoted vs unquoted fields');
console.log('  5. Worker performance (different data sizes)');
console.log('  6. Concurrent execution (sequential vs parallel)');
console.log('  7. Custom delimiters (TSV, PSV)');
console.log('  8. Data transformation overhead');
console.log('  9. Queuing strategies');
console.log('  10. Row count scaling (50-5000 rows) - detects O(n) bottlenecks');
console.log('  11. Field length scaling (10 chars - 10KB) - detects string processing bottlenecks');
console.log('  12. Quote ratio impact (0%-100%) - detects quote handling bottlenecks');
console.log('  13. Line ending comparison (LF vs CRLF) - detects line ending processing overhead');
console.log('  14. Engine comparison at scale - identifies optimal engine for data size');
console.log('  15. Memory allocation patterns - compares allocation strategies');
console.log('  16. Low-level API performance - measures lexer and assembler separately');
console.log('  17. Binary vs Stream approach - determines optimal threshold for parseBlob');
console.log('\nNote: Any WASM initialization warnings can be safely ignored.');
console.log('CodSpeed will use tinybench for local execution (this is expected behavior).');
if (!isWorkerAvailable) {
  console.log('\n⚠️  Worker API not available - worker-based benchmarks will be skipped.');
  console.log('Run benchmarks in a browser environment to test worker performance.');
}
if (!wasmAvailable) {
  console.log('\n⚠️  WASM module not available - WASM-dependent benchmarks will be skipped.');
  console.log('Run benchmarks with WASM support to test WASM performance.');
}
console.log();

let bench = withCodSpeed(new Bench({
  iterations: 50,
}))
  .add('parseString.toArraySync(50 rows)', () => {
    parseString.toArraySync(stringCSV);
  });

// Conditionally add WASM benchmark
if (wasmAvailable) {
  bench = bench.add('parseStringToArraySyncWASM(50 rows)', () => {
    parseStringToArraySyncWASM(stringCSV);
  });
}

bench = bench
  .add('parseString.toIterableIterator(50 rows)', async () => {
    for await (const _ of parseString.toIterableIterator(stringCSV)) {
      // noop
    }
  })
  .add('parseString.toStream(50 rows)', async () => {
    await parseString.toStream(stringCSV).pipeTo(new WritableStream({
      write(_) {
        // noop
      }
    }));
  })
  .add('parseBinary.toArraySync(50 rows)', () => {
    parseBinary.toArraySync(binaryCSV);
  })
  .add('parseBinary.toIterableIterator(50 rows)', () => {
    for (const _ of parseBinary.toIterableIterator(binaryCSV)) {
      // noop
    }
  })
  .add('parseBinary.toStream(50 rows)', async () => {
    await parseBinary.toStream(binaryCSV).pipeTo(new WritableStream({
      write(_) {
        // noop
      }
    }));
  })
  // Engine preset benchmarks (50 rows)
  .add('parseString engine:stable (50 rows)', async () => {
    for await (const _ of parseString(stringCSV, { engine: EnginePresets.stable() })) {
      // noop
    }
  });

// WASM preset benchmark (50 rows)
if (wasmAvailable) {
  bench = bench
    .add('parseString engine:wasm (50 rows)', async () => {
      for await (const _ of parseString(stringCSV, { engine: EnginePresets.wasm() })) {
        // noop
      }
    });
}

// Conditionally add worker benchmarks (50 rows)
if (isWorkerAvailable) {
  bench = bench
    .add('parseString engine:responsive (50 rows)', async () => {
      for await (const _ of parseString(stringCSV, { engine: EnginePresets.responsive() })) {
        // noop
      }
    })
    .add('parseString engine:memoryEfficient (50 rows)', async () => {
      for await (const _ of parseString(stringCSV, { engine: EnginePresets.memoryEfficient() })) {
        // noop
      }
    });

  // responsiveFast requires both Worker and WASM
  if (wasmAvailable) {
    bench = bench.add('parseString engine:responsiveFast (50 rows)', async () => {
      for await (const _ of parseString(stringCSV, { engine: EnginePresets.responsiveFast() })) {
        // noop
      }
    });
  }
}

bench = bench
  // Engine preset benchmarks (1000 rows)
  .add('parseString engine:stable (1000 rows)', async () => {
    for await (const _ of parseString(largeCSV, { engine: EnginePresets.stable() })) {
      // noop
    }
  });

// WASM preset benchmark (1000 rows)
if (wasmAvailable) {
  bench = bench
    .add('parseString engine:fast (1000 rows)', async () => {
      for await (const _ of parseString(largeCSV, { engine: EnginePresets.fast() })) {
        // noop
      }
    });
}

// Conditionally add worker benchmarks (1000 rows)
if (isWorkerAvailable) {
  bench = bench
    .add('parseString engine:responsive (1000 rows)', async () => {
      for await (const _ of parseString(largeCSV, { engine: EnginePresets.responsive() })) {
        // noop
      }
    })
    .add('parseString engine:memoryEfficient (1000 rows)', async () => {
      for await (const _ of parseString(largeCSV, { engine: EnginePresets.memoryEfficient() })) {
        // noop
      }
    });

  // responsiveFast requires both Worker and WASM
  if (wasmAvailable) {
    bench = bench.add('parseString engine:responsiveFast (1000 rows)', async () => {
      for await (const _ of parseString(largeCSV, { engine: EnginePresets.responsiveFast() })) {
        // noop
      }
    });
  }

  bench = bench
    .add('parseString engine:balanced (1000 rows)', async () => {
      for await (const _ of parseString(largeCSV, { engine: EnginePresets.balanced() })) {
        // noop
      }
    });
}

bench = bench
  // Different column counts - unquoted
  .add('parseString.toArraySync(10 cols, 50 rows, unquoted)', () => {
    parseString.toArraySync(csv10cols);
  })
  .add('parseString.toArraySync(50 cols, 50 rows, unquoted)', () => {
    parseString.toArraySync(csv50cols);
  })
  .add('parseString.toArraySync(100 cols, 50 rows, unquoted)', () => {
    parseString.toArraySync(csv100cols);
  })
  .add('parseString.toArraySync(10000 cols, 10 rows, unquoted)', () => {
    parseString.toArraySync(csv10000cols);
  })
  // Different column counts - quoted
  .add('parseString.toArraySync(10 cols, 50 rows, quoted)', () => {
    parseString.toArraySync(csv10colsQuoted);
  })
  .add('parseString.toArraySync(50 cols, 50 rows, quoted)', () => {
    parseString.toArraySync(csv50colsQuoted);
  })
  .add('parseString.toArraySync(100 cols, 50 rows, quoted)', () => {
    parseString.toArraySync(csv100colsQuoted);
  })
  .add('parseString.toArraySync(10000 cols, 10 rows, quoted)', () => {
    parseString.toArraySync(csv10000colsQuoted);
  })
  // Worker performance tests (different sizes) - comparing presets
  .add('Worker perf: tiny (10 rows) - mainThread', async () => {
    for await (const _ of parseString(tinyCSV, { engine: EnginePresets.stable() })) {
      // noop
    }
  })
  .add('Worker perf: small (100 rows) - mainThread', async () => {
    for await (const _ of parseString(smallWorkerCSV, { engine: EnginePresets.stable() })) {
      // noop
    }
  })
  .add('Worker perf: medium (1000 rows) - mainThread', async () => {
    for await (const _ of parseString(mediumWorkerCSV, { engine: EnginePresets.stable() })) {
      // noop
    }
  })
  .add('Worker perf: large (10000 rows) - mainThread', async () => {
    for await (const _ of parseString(largeWorkerCSV, { engine: EnginePresets.stable() })) {
      // noop
    }
  });

// Conditionally add worker performance tests
if (isWorkerAvailable) {
  bench = bench
    .add('Worker perf: tiny (10 rows) - worker', async () => {
      for await (const _ of parseString(tinyCSV, { engine: EnginePresets.responsive() })) {
        // noop
      }
    })
    .add('Worker perf: small (100 rows) - worker', async () => {
      for await (const _ of parseString(smallWorkerCSV, { engine: EnginePresets.responsive() })) {
        // noop
      }
    })
    .add('Worker perf: medium (1000 rows) - worker', async () => {
      for await (const _ of parseString(mediumWorkerCSV, { engine: EnginePresets.responsive() })) {
        // noop
      }
    })
    .add('Worker perf: large (10000 rows) - worker', async () => {
      for await (const _ of parseString(largeWorkerCSV, { engine: EnginePresets.responsive() })) {
        // noop
      }
    })
    .add('Worker perf: large (10000 rows) - responsiveFast', async () => {
      for await (const _ of parseString(largeWorkerCSV, { engine: EnginePresets.responsiveFast() })) {
        // noop
      }
    });
}

bench = bench
  // Concurrent execution tests - comparing strategies
  .add('Concurrent: Sequential mainThread', async () => {
    for (const csv of concurrentDatasets) {
      for await (const _ of parseString(csv, { engine: EnginePresets.stable() })) {
        // noop
      }
    }
  })
  .add('Concurrent: Parallel mainThread', async () => {
    await Promise.all(
      concurrentDatasets.map(async (csv) => {
        for await (const _ of parseString(csv, { engine: EnginePresets.stable() })) {
          // noop
        }
      })
    );
  });

// Conditionally add concurrent worker tests
if (isWorkerAvailable) {
  bench = bench
    .add('Concurrent: Sequential worker', async () => {
      for (const csv of concurrentDatasets) {
        for await (const _ of parseString(csv, { engine: EnginePresets.responsive() })) {
          // noop
        }
      }
    })
    .add('Concurrent: Parallel worker', async () => {
      await Promise.all(
        concurrentDatasets.map(async (csv) => {
          for await (const _ of parseString(csv, { engine: EnginePresets.responsive() })) {
            // noop
          }
        })
      );
    })
    .add('Concurrent: Parallel responsiveFast', async () => {
      await Promise.all(
        concurrentDatasets.map(async (csv) => {
          for await (const _ of parseString(csv, { engine: EnginePresets.responsiveFast() })) {
            // noop
          }
        })
      );
    });
}

bench = bench
  // Custom delimiter tests (from custom-csv-parser.md)
  .add('Custom delimiter: TSV (100 rows)', () => {
    const lexer = new FlexibleStringCSVLexer({ delimiter: '\t' });
    const tokens = lexer.lex(tsv100);
    const assembler = new FlexibleCSVRecordAssembler();
    for (const _ of assembler.assemble(tokens)) {
      // noop
    }
  })
  .add('Custom delimiter: PSV (100 rows)', () => {
    const lexer = new FlexibleStringCSVLexer({ delimiter: '|' });
    const tokens = lexer.lex(psv100);
    const assembler = new FlexibleCSVRecordAssembler();
    for (const _ of assembler.assemble(tokens)) {
      // noop
    }
  })
  // parseStringStream tests (from choosing-the-right-api.md)
  .add('parseStringStream: small (100 rows)', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(smallWorkerCSV);
        controller.close();
      }
    });
    for await (const _ of parseStringStream(stream)) {
      // noop
    }
  })
  .add('parseStringStream: medium (1000 rows)', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(mediumWorkerCSV);
        controller.close();
      }
    });
    for await (const _ of parseStringStream(stream)) {
      // noop
    }
  })
  // Data transformation overhead (from custom-csv-parser.md)
  .add('Data transformation: type conversion (100 rows)', async () => {
    for await (const record of parseString(smallWorkerCSV)) {
      // Type conversion overhead
      Number(record.age);
    }
  })
  .add('Data transformation: no conversion (100 rows)', async () => {
    for await (const _ of parseString(smallWorkerCSV)) {
      // noop
    }
  })
  // Queuing strategy tests (default HWM)
  .add('Queuing: small (100 rows) - default HWM', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(smallQueuingCSV);
        controller.close();
      }
    });

    await stream
      .pipeThrough(new CSVLexerTransformer(new FlexibleStringCSVLexer(), {}))
      .pipeThrough(new CSVRecordAssemblerTransformer(new FlexibleCSVRecordAssembler(), {}))
      .pipeTo(new WritableStream({
        write() {
          // noop
        }
      }));
  })
  .add('Queuing: medium (1000 rows) - default HWM', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(mediumQueuingCSV);
        controller.close();
      }
    });

    await stream
      .pipeThrough(new CSVLexerTransformer(new FlexibleStringCSVLexer(), {}))
      .pipeThrough(new CSVRecordAssemblerTransformer(new FlexibleCSVRecordAssembler(), {}))
      .pipeTo(new WritableStream({
        write() {
          // noop
        }
      }));
  })
  .add('Queuing: large (10000 rows) - default HWM', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(largeQueuingCSV);
        controller.close();
      }
    });

    await stream
      .pipeThrough(new CSVLexerTransformer(new FlexibleStringCSVLexer(), {}))
      .pipeThrough(new CSVRecordAssemblerTransformer(new FlexibleCSVRecordAssembler(), {}))
      .pipeTo(new WritableStream({
        write() {
          // noop
        }
      }));
  })
  // Row count scaling tests (bottleneck detection)
  .add('Scaling: 50 rows', () => {
    parseString.toArraySync(csv50rows);
  })
  .add('Scaling: 100 rows', () => {
    parseString.toArraySync(csv100rows);
  })
  .add('Scaling: 500 rows', () => {
    parseString.toArraySync(csv500rows);
  })
  .add('Scaling: 1000 rows', () => {
    parseString.toArraySync(csv1000rows);
  })
  .add('Scaling: 5000 rows', () => {
    parseString.toArraySync(csv5000rows);
  })
  // Field length tests (string processing bottleneck detection)
  .add('Field length: 10 chars (1000 rows)', () => {
    parseString.toArraySync(csvShortFields);
  })
  .add('Field length: 100 chars (1000 rows)', () => {
    parseString.toArraySync(csvMediumFields);
  })
  .add('Field length: 1KB (1000 rows)', () => {
    parseString.toArraySync(csvLongFields);
  })
  .add('Field length: 10KB (100 rows)', () => {
    parseString.toArraySync(csvVeryLongFields);
  })
  // Quote ratio tests (quote processing bottleneck detection)
  .add('Quote ratio: 0% (1000 rows)', () => {
    parseString.toArraySync(csvNoQuotes);
  })
  .add('Quote ratio: 25% (1000 rows)', () => {
    parseString.toArraySync(csv25PercentQuoted);
  })
  .add('Quote ratio: 50% (1000 rows)', () => {
    parseString.toArraySync(csv50PercentQuoted);
  })
  .add('Quote ratio: 100% (1000 rows)', () => {
    parseString.toArraySync(csv100PercentQuoted);
  })
  // Line ending tests (line ending processing bottleneck detection)
  .add('Line ending: LF (1000 rows)', () => {
    parseString.toArraySync(csvLF);
  })
  .add('Line ending: CRLF (1000 rows)', () => {
    parseString.toArraySync(csvCRLF);
  })
  // Engine comparison at different scales (bottleneck detection for engine overhead)
  .add('Engine comparison: mainThread (500 rows)', async () => {
    for await (const _ of parseString(csv500rows, { engine: EnginePresets.stable() })) {
      // noop
    }
  });

// Engine comparison: WASM benchmarks (conditionally add)
if (wasmAvailable) {
  bench = bench
    .add('Engine comparison: wasm (500 rows)', async () => {
      for await (const _ of parseString(csv500rows, { engine: EnginePresets.wasm() })) {
        // noop
      }
    });
}

bench = bench
  .add('Engine comparison: mainThread (5000 rows)', async () => {
    for await (const _ of parseString(csv5000rows, { engine: EnginePresets.stable() })) {
      // noop
    }
  });

if (wasmAvailable) {
  bench = bench
    .add('Engine comparison: wasm (5000 rows)', async () => {
      for await (const _ of parseString(csv5000rows, { engine: EnginePresets.wasm() })) {
        // noop
      }
    });
}

bench = bench
  // Memory allocation pattern tests
  .add('Memory: toArraySync (allocate all at once)', () => {
    parseString.toArraySync(csv1000rows);
  })
  .add('Memory: toIterableIterator (streaming)', () => {
    for (const _ of parseString.toIterableIterator(csv1000rows)) {
      // noop
    }
  })
  // Low-level API performance comparison
  .add('Low-level: CSVLexer only (1000 rows)', () => {
    const lexer = new FlexibleStringCSVLexer();
    for (const _ of lexer.lex(csv1000rows)) {
      // noop
    }
  })
  .add('Low-level: CSVLexer + CSVRecordAssembler (1000 rows)', () => {
    const lexer = new FlexibleStringCSVLexer();
    const tokens = lexer.lex(csv1000rows);
    const assembler = new FlexibleCSVRecordAssembler();
    for (const _ of assembler.assemble(tokens)) {
      // noop
    }
  });

// Generate CSVs for parseBinary vs parseUint8ArrayStream comparison
// These tests help determine the optimal threshold for parseBlob
function generateCSVBySize(targetSizeKB: number): string {
  const avgRowSize = 80; // approximate bytes per row
  const rows = Math.floor((targetSizeKB * 1024) / avgRowSize);
  return generateCSV(10, rows);
}

const csv1KB = generateCSVBySize(1);      // ~1KB
const csv10KB = generateCSVBySize(10);    // ~10KB
const csv100KB = generateCSVBySize(100);  // ~100KB
const csv1MB = generateCSVBySize(1024);   // ~1MB

// Convert to Uint8Array for parseBinary tests
const encoder = new TextEncoder();
const binary1KB = encoder.encode(csv1KB);
const binary10KB = encoder.encode(csv10KB);
const binary100KB = encoder.encode(csv100KB);
const binary1MB = encoder.encode(csv1MB);

// Create Blob streams for parseUint8ArrayStream tests
function createBlobStream(csv: string): ReadableStream<Uint8Array> {
  return new Blob([csv], { type: 'text/csv' }).stream();
}

bench = bench
  // parseBinary vs parseUint8ArrayStream comparison
  // These benchmarks determine the optimal threshold for automatic method selection
  .add('Binary approach: parseBinary (1KB)', () => {
    for (const _ of parseBinary.toIterableIterator(binary1KB)) {
      // noop
    }
  })
  .add('Stream approach: parseUint8ArrayStream (1KB)', async () => {
    for await (const _ of parseUint8ArrayStream(createBlobStream(csv1KB))) {
      // noop
    }
  })
  .add('Binary approach: parseBinary (10KB)', () => {
    for (const _ of parseBinary.toIterableIterator(binary10KB)) {
      // noop
    }
  })
  .add('Stream approach: parseUint8ArrayStream (10KB)', async () => {
    for await (const _ of parseUint8ArrayStream(createBlobStream(csv10KB))) {
      // noop
    }
  })
  .add('Binary approach: parseBinary (100KB)', () => {
    for (const _ of parseBinary.toIterableIterator(binary100KB)) {
      // noop
    }
  })
  .add('Stream approach: parseUint8ArrayStream (100KB)', async () => {
    for await (const _ of parseUint8ArrayStream(createBlobStream(csv100KB))) {
      // noop
    }
  })
  .add('Binary approach: parseBinary (1MB)', () => {
    for (const _ of parseBinary.toIterableIterator(binary1MB)) {
      // noop
    }
  })
  .add('Stream approach: parseUint8ArrayStream (1MB)', async () => {
    for await (const _ of parseUint8ArrayStream(createBlobStream(csv1MB))) {
      // noop
    }
  });

await bench.run();

console.log('\n=== Benchmark Results ===\n');
console.table(bench.table());

console.log('\n=== Performance Summary ===');
console.log('✓ Basic parsing operations completed');
console.log('✓ Engine preset tests (mainThread, wasm, strict, worker variants) completed');
console.log('✓ Column variation tests (10-10000 columns) completed');
console.log('✓ Quoted vs unquoted field tests completed');
console.log('✓ Worker performance tests completed');
console.log('✓ Concurrent execution tests completed');
console.log('✓ Custom delimiter tests (TSV, PSV) completed');
console.log('✓ parseStringStream tests completed');
console.log('✓ Data transformation overhead tests completed');
console.log('✓ Queuing strategy tests completed');
console.log('✓ Row count scaling tests (50-5000 rows) completed');
console.log('✓ Field length scaling tests (10 chars - 10KB) completed');
console.log('✓ Quote ratio tests (0%-100%) completed');
console.log('✓ Line ending comparison (LF vs CRLF) completed');
console.log('✓ Engine comparison at scale completed');
console.log('✓ Memory allocation pattern tests completed');
console.log('✓ Low-level API performance tests completed');
console.log('✓ Binary vs Stream approach tests completed');
console.log('\n=== Bottleneck Detection Guide ===');
console.log('Review the benchmark results to identify bottlenecks:');
console.log('  • Row count scaling: Check if performance degrades linearly (O(n))');
console.log('  • Field length: Identify string processing limits');
console.log('  • Quote ratio: Measure quote handling overhead');
console.log('  • Engine comparison: Find optimal engine for your data size');
console.log('  • Memory patterns: Compare allocation strategies');
console.log('  • Binary vs Stream: Determine optimal threshold for parseBlob auto-selection');
console.log('\nFor detailed analysis, review the ops/sec values in the table above.');
console.log('Higher ops/sec = better performance\n');
