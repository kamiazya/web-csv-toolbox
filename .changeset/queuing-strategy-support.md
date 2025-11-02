---
"web-csv-toolbox": minor
---

Add configurable queuing strategies to TransformStream classes

Both `CSVLexerTransformer` and `CSVRecordAssemblerTransformer` now support custom queuing strategies following the Web Streams API pattern. Strategies are passed as constructor arguments, similar to the standard `TransformStream`.

## API Changes

### Constructor Signature

Queuing strategies are now passed as separate constructor arguments:

```typescript
// Before (if this was previously supported - this is a new feature)
new CSVLexerTransformer(options)

// After
new CSVLexerTransformer(options?, writableStrategy?, readableStrategy?)
new CSVRecordAssemblerTransformer(options?, writableStrategy?, readableStrategy?)
```

### CSVLexerTransformer

- **Parameter 1** `options`: CSV-specific options (delimiter, quotation, etc.)
- **Parameter 2** `writableStrategy`: Controls buffering for incoming string chunks (default: `{ highWaterMark: 8 }`)
- **Parameter 3** `readableStrategy`: Controls buffering for outgoing token arrays (default: `{ highWaterMark: 16 }`)

### CSVRecordAssemblerTransformer

- **Parameter 1** `options`: CSV-specific options (header, maxFieldCount, etc.)
- **Parameter 2** `writableStrategy`: Controls buffering for incoming token arrays (default: `{ highWaterMark: 16 }`)
- **Parameter 3** `readableStrategy`: Controls buffering for outgoing CSV records (default: `{ highWaterMark: 8 }`)

## Default Values

**Important**: The default values are **theoretical starting points** based on data flow characteristics, **not empirical benchmarks**. They are:
- Lexer produces more output (tokens) than input (strings), so readable side has higher HWM
- Assembler consumes multiple token arrays to produce records, so writable side has higher HWM

Optimal values depend on your runtime environment (browser/Node.js/Deno), data size, memory constraints, and CPU performance. **You should profile your specific use case** to find the best values.

## Benchmarking Tool

A benchmark tool is provided to help you find optimal values for your use case:

```bash
pnpm --filter web-csv-toolbox-benchmark queuing-strategy
```

See `benchmark/queuing-strategy.bench.ts` for details.

## Usage Examples

```typescript
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

// Basic usage (with defaults)
const lexer = new CSVLexerTransformer();

// Custom strategies based on YOUR profiling results
const lexer = new CSVLexerTransformer(
  { delimiter: ',' },
  { highWaterMark: 32 },    // writable
  { highWaterMark: 64 },    // readable
);

const assembler = new CSVRecordAssemblerTransformer(
  {},
  { highWaterMark: 4 },     // writable
  { highWaterMark: 2 },     // readable
);
```

## When to Customize

- **High-throughput servers**: Try higher values (e.g., 32-64) and benchmark
- **Memory-constrained environments** (browsers, edge functions): Try lower values (e.g., 1-4) and monitor memory
- **Custom pipelines**: Profile with representative data and iterate

## Web Standards Compliance

This API follows the Web Streams API pattern where `TransformStream` accepts queuing strategies as constructor arguments, making it consistent with standard web platform APIs.
