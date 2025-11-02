---
"web-csv-toolbox": minor
---

Add configurable queuing strategies to TransformStream classes

Both `CSVLexerTransformer` and `CSVRecordAssemblerTransformer` now support custom queuing strategies through `writableStrategy` and `readableStrategy` options. This allows fine-tuning of backpressure and memory usage based on your specific use case.

## New Options

### CSVLexerTransformer

- `writableStrategy`: Controls buffering for incoming string chunks (default: `{ highWaterMark: 8 }`)
- `readableStrategy`: Controls buffering for outgoing token arrays (default: `{ highWaterMark: 16 }`)

### CSVRecordAssemblerTransformer

- `writableStrategy`: Controls buffering for incoming token arrays (default: `{ highWaterMark: 16 }`)
- `readableStrategy`: Controls buffering for outgoing CSV records (default: `{ highWaterMark: 8 }`)

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

// Customize based on YOUR profiling results
const lexer = new CSVLexerTransformer({
  writableStrategy: { highWaterMark: 32 },
  readableStrategy: { highWaterMark: 64 },
});

const assembler = new CSVRecordAssemblerTransformer({
  writableStrategy: { highWaterMark: 4 },
  readableStrategy: { highWaterMark: 2 },
});
```

## When to Customize

- **High-throughput servers**: Try higher values (e.g., 32-64) and benchmark
- **Memory-constrained environments** (browsers, edge functions): Try lower values (e.g., 1-4) and monitor memory
- **Custom pipelines**: Profile with representative data and iterate
