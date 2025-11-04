
import { withCodSpeed } from "@codspeed/tinybench-plugin";
import { Bench } from 'tinybench';
import {
  loadWASM,
  parseBinary,
  parseString,
  parseStringToArraySyncWASM,
  parseStringStream,
  parseUint8ArrayStream,
  CSVLexer,
  CSVRecordAssembler,
  CSVLexerTransformer,
  CSVRecordAssemblerTransformer,
  EnginePresets
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

// Generate TSV (Tab-Separated Values) for custom delimiter test
function generateTSV(rows: number): string {
  const header = 'name\tage\temail';
  const dataRows = Array.from({length: rows}, (_, i) =>
    `User${i}\t${20 + i}\tuser${i}@example.com`
  );
  return [header, ...dataRows].join('\n');
}

// Generate Pipe-Separated Values for custom delimiter test
function generatePSV(rows: number): string {
  const header = 'name|age|email';
  const dataRows = Array.from({length: rows}, (_, i) =>
    `User${i}|${20 + i}|user${i}@example.com`
  );
  return [header, ...dataRows].join('\n');
}

const tsv100 = generateTSV(100);
const psv100 = generatePSV(100);

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

// Load WASM module before benchmarks
await loadWASM().catch(() => {
  // Silently ignore WASM loading errors in benchmark
  console.warn('WASM module not available, some benchmarks may be skipped');
});

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
  return [
    'id,name,value,timestamp',
    ...Array.from({ length: rows }, (_, i) =>
      `${i + seed},Item${i + seed},${(i + seed) * 1.5},${Date.now() + i}`
    ),
  ].join('\n');
}

const NUM_CONCURRENT = 5;
const ROWS_PER_CONCURRENT_CSV = 500;
const concurrentDatasets = Array.from({ length: NUM_CONCURRENT }, (_, i) =>
  generateConcurrentCSV(ROWS_PER_CONCURRENT_CSV, i * 1000)
);

// Generate CSVs for queuing strategy tests
function generateQueuingTestCSV(rows: number, cols: number = 10): string {
  const header = Array.from({ length: cols }, (_, i) => `col${i}`).join(',');
  const bodyRows = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => `value${i}_${j}`).join(',')
  );
  return [header, ...bodyRows].join('\n');
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
console.log('  2. Engine presets (mainThread, wasm, worker, workerStreamTransfer, workerWasm, balanced, fastest)');
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
console.log('\nNote: Any WASM initialization warnings can be safely ignored.');
console.log('CodSpeed will use tinybench for local execution (this is expected behavior).');
if (!isWorkerAvailable) {
  console.log('\n⚠️  Worker API not available - worker-based benchmarks will be skipped.');
  console.log('Run benchmarks in a browser environment to test worker performance.');
}
console.log();

let bench = withCodSpeed(new Bench({
  iterations: 50,
}))
  .add('parseString.toArraySync(50 rows)', () => {
    parseString.toArraySync(stringCSV);
  })
  .add('parseStringToArraySyncWASM(50 rows)', () => {
    parseStringToArraySyncWASM(stringCSV);
  })
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
  .add('parseString engine:mainThread (50 rows)', async () => {
    const records = [];
    for await (const record of parseString(stringCSV, { engine: EnginePresets.mainThread() })) {
      records.push(record);
    }
  });

// WASM preset benchmark (50 rows)
bench = bench
  .add('parseString engine:wasm (50 rows)', async () => {
    const records = [];
    for await (const record of parseString(stringCSV, { engine: EnginePresets.wasm() })) {
      records.push(record);
    }
  });

// Conditionally add worker benchmarks (50 rows)
if (isWorkerAvailable) {
  bench = bench
    .add('parseString engine:worker (50 rows)', async () => {
      const records = [];
      for await (const record of parseString(stringCSV, { engine: EnginePresets.worker() })) {
        records.push(record);
      }
    })
    .add('parseString engine:workerStreamTransfer (50 rows)', async () => {
      const records = [];
      for await (const record of parseString(stringCSV, { engine: EnginePresets.workerStreamTransfer() })) {
        records.push(record);
      }
    })
    .add('parseString engine:workerWasm (50 rows)', async () => {
      const records = [];
      for await (const record of parseString(stringCSV, { engine: EnginePresets.workerWasm() })) {
        records.push(record);
      }
    });
}

bench = bench
  // Engine preset benchmarks (1000 rows)
  .add('parseString engine:mainThread (1000 rows)', async () => {
    const records = [];
    for await (const record of parseString(largeCSV, { engine: EnginePresets.mainThread() })) {
      records.push(record);
    }
  })
  .add('parseString engine:wasm (1000 rows)', async () => {
    const records = [];
    for await (const record of parseString(largeCSV, { engine: EnginePresets.wasm() })) {
      records.push(record);
    }
  });

// Conditionally add worker benchmarks (1000 rows)
if (isWorkerAvailable) {
  bench = bench
    .add('parseString engine:worker (1000 rows)', async () => {
      const records = [];
      for await (const record of parseString(largeCSV, { engine: EnginePresets.worker() })) {
        records.push(record);
      }
    })
    .add('parseString engine:workerStreamTransfer (1000 rows)', async () => {
      const records = [];
      for await (const record of parseString(largeCSV, { engine: EnginePresets.workerStreamTransfer() })) {
        records.push(record);
      }
    })
    .add('parseString engine:workerWasm (1000 rows)', async () => {
      const records = [];
      for await (const record of parseString(largeCSV, { engine: EnginePresets.workerWasm() })) {
        records.push(record);
      }
    })
    .add('parseString engine:balanced (1000 rows)', async () => {
      const records = [];
      for await (const record of parseString(largeCSV, { engine: EnginePresets.balanced() })) {
        records.push(record);
      }
    })
    .add('parseString engine:fastest (1000 rows)', async () => {
      const records = [];
      for await (const record of parseString(largeCSV, { engine: EnginePresets.fastest() })) {
        records.push(record);
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
    const records = [];
    for await (const record of parseString(tinyCSV, { engine: EnginePresets.mainThread() })) {
      records.push(record);
    }
  })
  .add('Worker perf: small (100 rows) - mainThread', async () => {
    const records = [];
    for await (const record of parseString(smallWorkerCSV, { engine: EnginePresets.mainThread() })) {
      records.push(record);
    }
  })
  .add('Worker perf: medium (1000 rows) - mainThread', async () => {
    const records = [];
    for await (const record of parseString(mediumWorkerCSV, { engine: EnginePresets.mainThread() })) {
      records.push(record);
    }
  })
  .add('Worker perf: large (10000 rows) - mainThread', async () => {
    const records = [];
    for await (const record of parseString(largeWorkerCSV, { engine: EnginePresets.mainThread() })) {
      records.push(record);
    }
  });

// Conditionally add worker performance tests
if (isWorkerAvailable) {
  bench = bench
    .add('Worker perf: tiny (10 rows) - worker', async () => {
      const records = [];
      for await (const record of parseString(tinyCSV, { engine: EnginePresets.worker() })) {
        records.push(record);
      }
    })
    .add('Worker perf: small (100 rows) - worker', async () => {
      const records = [];
      for await (const record of parseString(smallWorkerCSV, { engine: EnginePresets.worker() })) {
        records.push(record);
      }
    })
    .add('Worker perf: medium (1000 rows) - worker', async () => {
      const records = [];
      for await (const record of parseString(mediumWorkerCSV, { engine: EnginePresets.worker() })) {
        records.push(record);
      }
    })
    .add('Worker perf: large (10000 rows) - worker', async () => {
      const records = [];
      for await (const record of parseString(largeWorkerCSV, { engine: EnginePresets.worker() })) {
        records.push(record);
      }
    })
    .add('Worker perf: large (10000 rows) - fastest', async () => {
      const records = [];
      for await (const record of parseString(largeWorkerCSV, { engine: EnginePresets.fastest() })) {
        records.push(record);
      }
    });
}

bench = bench
  // Concurrent execution tests - comparing strategies
  .add('Concurrent: Sequential mainThread', async () => {
    for (const csv of concurrentDatasets) {
      const records = [];
      for await (const record of parseString(csv, { engine: EnginePresets.mainThread() })) {
        records.push(record);
      }
    }
  })
  .add('Concurrent: Parallel mainThread', async () => {
    await Promise.all(
      concurrentDatasets.map(async (csv) => {
        const records = [];
        for await (const record of parseString(csv, { engine: EnginePresets.mainThread() })) {
          records.push(record);
        }
      })
    );
  });

// Conditionally add concurrent worker tests
if (isWorkerAvailable) {
  bench = bench
    .add('Concurrent: Sequential worker', async () => {
      for (const csv of concurrentDatasets) {
        const records = [];
        for await (const record of parseString(csv, { engine: EnginePresets.worker() })) {
          records.push(record);
        }
      }
    })
    .add('Concurrent: Parallel worker', async () => {
      await Promise.all(
        concurrentDatasets.map(async (csv) => {
          const records = [];
          for await (const record of parseString(csv, { engine: EnginePresets.worker() })) {
            records.push(record);
          }
        })
      );
    })
    .add('Concurrent: Parallel fastest', async () => {
      await Promise.all(
        concurrentDatasets.map(async (csv) => {
          const records = [];
          for await (const record of parseString(csv, { engine: EnginePresets.fastest() })) {
            records.push(record);
          }
        })
      );
    });
}

bench = bench
  // Custom delimiter tests (from custom-csv-parser.md)
  .add('Custom delimiter: TSV (100 rows)', () => {
    const lexer = new CSVLexer({ delimiter: '\t' });
    const tokens = lexer.lex(tsv100);
    const assembler = new CSVRecordAssembler();
    const records = [...assembler.assemble(tokens)];
  })
  .add('Custom delimiter: PSV (100 rows)', () => {
    const lexer = new CSVLexer({ delimiter: '|' });
    const tokens = lexer.lex(psv100);
    const assembler = new CSVRecordAssembler();
    const records = [...assembler.assemble(tokens)];
  })
  // parseStringStream tests (from choosing-the-right-api.md)
  .add('parseStringStream: small (100 rows)', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(smallWorkerCSV);
        controller.close();
      }
    });
    const records = [];
    for await (const record of parseStringStream(stream)) {
      records.push(record);
    }
  })
  .add('parseStringStream: medium (1000 rows)', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(mediumWorkerCSV);
        controller.close();
      }
    });
    const records = [];
    for await (const record of parseStringStream(stream)) {
      records.push(record);
    }
  })
  // Data transformation overhead (from custom-csv-parser.md)
  .add('Data transformation: type conversion (100 rows)', async () => {
    const records = [];
    for await (const record of parseString(smallWorkerCSV)) {
      // Type conversion overhead
      records.push({
        name: record.name,
        age: Number(record.age),
        email: record.email
      });
    }
  })
  .add('Data transformation: no conversion (100 rows)', async () => {
    const records = [];
    for await (const record of parseString(smallWorkerCSV)) {
      // No transformation
      records.push(record);
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
      .pipeThrough(new CSVLexerTransformer())
      .pipeThrough(new CSVRecordAssemblerTransformer())
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
      .pipeThrough(new CSVLexerTransformer())
      .pipeThrough(new CSVRecordAssemblerTransformer())
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
      .pipeThrough(new CSVLexerTransformer())
      .pipeThrough(new CSVRecordAssemblerTransformer())
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
    const records = [];
    for await (const record of parseString(csv500rows, { engine: EnginePresets.mainThread() })) {
      records.push(record);
    }
  })
  .add('Engine comparison: wasm (500 rows)', async () => {
    const records = [];
    for await (const record of parseString(csv500rows, { engine: EnginePresets.wasm() })) {
      records.push(record);
    }
  })
  .add('Engine comparison: mainThread (5000 rows)', async () => {
    const records = [];
    for await (const record of parseString(csv5000rows, { engine: EnginePresets.mainThread() })) {
      records.push(record);
    }
  })
  .add('Engine comparison: wasm (5000 rows)', async () => {
    const records = [];
    for await (const record of parseString(csv5000rows, { engine: EnginePresets.wasm() })) {
      records.push(record);
    }
  })
  // Memory allocation pattern tests
  .add('Memory: toArraySync (allocate all at once)', () => {
    const result = parseString.toArraySync(csv1000rows);
  })
  .add('Memory: toIterableIterator (streaming)', () => {
    const records = [];
    for (const record of parseString.toIterableIterator(csv1000rows)) {
      records.push(record);
    }
  })
  // Low-level API performance comparison
  .add('Low-level: CSVLexer only (1000 rows)', () => {
    const lexer = new CSVLexer();
    const tokens = [...lexer.lex(csv1000rows)];
  })
  .add('Low-level: CSVLexer + CSVRecordAssembler (1000 rows)', () => {
    const lexer = new CSVLexer();
    const tokens = lexer.lex(csv1000rows);
    const assembler = new CSVRecordAssembler();
    const records = [...assembler.assemble(tokens)];
  });


await bench.warmup();

await bench.run();

console.log('\n=== Benchmark Results ===\n');
console.table(bench.table());

console.log('\n=== Performance Summary ===');
console.log('✓ Basic parsing operations completed');
console.log('✓ Engine preset tests (mainThread, wasm, worker variants) completed');
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
console.log('\n=== Bottleneck Detection Guide ===');
console.log('Review the benchmark results to identify bottlenecks:');
console.log('  • Row count scaling: Check if performance degrades linearly (O(n))');
console.log('  • Field length: Identify string processing limits');
console.log('  • Quote ratio: Measure quote handling overhead');
console.log('  • Engine comparison: Find optimal engine for your data size');
console.log('  • Memory patterns: Compare allocation strategies');
console.log('\nFor detailed analysis, review the ops/sec values in the table above.');
console.log('Higher ops/sec = better performance\n');
