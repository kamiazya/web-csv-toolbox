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
- **Parameter 2** `writableStrategy`: Controls buffering for incoming string chunks
  - Default: `{ highWaterMark: 65536, size: (chunk) => chunk.length }`
  - Counts by **character count** (string length)
  - Default allows ~64KB of characters
- **Parameter 3** `readableStrategy`: Controls buffering for outgoing token arrays
  - Default: `{ highWaterMark: 1024, size: (tokens) => tokens.length }`
  - Counts by **number of tokens** in each array
  - Default allows 1024 tokens

### CSVRecordAssemblerTransformer

- **Parameter 1** `options`: CSV-specific options (header, maxFieldCount, etc.)
- **Parameter 2** `writableStrategy`: Controls buffering for incoming token arrays
  - Default: `{ highWaterMark: 1024, size: (tokens) => tokens.length }`
  - Counts by **number of tokens** in each array
  - Default allows 1024 tokens
- **Parameter 3** `readableStrategy`: Controls buffering for outgoing CSV records
  - Default: `{ highWaterMark: 256, size: () => 1 }`
  - Counts each **record as 1**
  - Default allows 256 records

## Default Values Rationale

**Important**: The default values are **theoretical starting points** based on data flow characteristics, **not empirical benchmarks**.

### Size Counting Strategy

Each transformer uses a **custom size algorithm** optimized for its data type:

- **CSVLexerTransformer writable**: Counts by **string length** (characters). This provides accurate backpressure based on actual data volume.
- **CSVLexerTransformer readable**: Counts by **number of tokens**. Prevents excessive token accumulation.
- **CSVRecordAssemblerTransformer writable**: Counts by **number of tokens**. Matches the lexer's readable side for smooth pipeline flow.
- **CSVRecordAssemblerTransformer readable**: Counts **each record as 1**. Simple and effective for record-based backpressure.

### Why These Defaults?

- Lexer typically produces multiple tokens per character (delimiters, quotes, fields)
- Using character-based counting on writable side provides more predictable memory usage
- Token-based counting between lexer and assembler ensures smooth data flow
- Record-based counting on final output is intuitive and easy to reason about

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
  { highWaterMark: 131072, size: (chunk) => chunk.length },  // 128KB of characters
  { highWaterMark: 2048, size: (tokens) => tokens.length },  // 2048 tokens
);

const assembler = new CSVRecordAssemblerTransformer(
  {},
  { highWaterMark: 2048, size: (tokens) => tokens.length },  // 2048 tokens
  { highWaterMark: 512, size: () => 1 },                     // 512 records
);
```

## When to Customize

- **High-throughput servers**: Try higher values (e.g., 32-64) and benchmark
- **Memory-constrained environments** (browsers, edge functions): Try lower values (e.g., 1-4) and monitor memory
- **Custom pipelines**: Profile with representative data and iterate

## Web Standards Compliance

This API follows the Web Streams API pattern where `TransformStream` accepts queuing strategies as constructor arguments, making it consistent with standard web platform APIs.
