---
"web-csv-toolbox": minor
---

Optimize streaming API design for better performance and consistency

## Breaking Changes

### Token Stream Output Changed from Batch to Individual

`CSVLexerTransformer` and `CSVRecordAssemblerTransformer` now emit/accept individual tokens instead of token arrays for improved streaming performance and API consistency.

**Before:**
```typescript
CSVLexerTransformer: TransformStream<string, Token[]>
CSVRecordAssemblerTransformer: TransformStream<Token[], CSVRecord>
```

**After:**
```typescript
CSVLexerTransformer: TransformStream<string, Token>
CSVRecordAssemblerTransformer: TransformStream<Token, CSVRecord>
```

### Why This Change?

1. **Consistent API Design**: RecordAssembler already emits individual records. Lexer now matches this pattern.
2. **Better Backpressure**: Fine-grained token-by-token flow control instead of batch-based.
3. **Memory Efficiency**: Eliminates temporary token array allocation.
4. **Simpler Queuing Strategy**: Uniform `size: () => 1` across the pipeline.

### Migration Guide

**For Low-Level API Users:**

If you directly use `CSVLexerTransformer` or `CSVRecordAssemblerTransformer`:

```typescript
// Before: Process token arrays
stream
  .pipeThrough(new CSVLexerTransformer())
  .pipeTo(new WritableStream({
    write(tokens) {  // tokens is Token[]
      for (const token of tokens) {
        console.log(token);
      }
    }
  }));

// After: Process individual tokens
stream
  .pipeThrough(new CSVLexerTransformer())
  .pipeTo(new WritableStream({
    write(token) {  // token is Token
      console.log(token);
    }
  }));
```

**For High-Level API Users:**

No changes required. Functions like `parseString()`, `parseStringStream()`, etc. continue to work without modification.

## Performance Improvements

### CSVRecordAssembler Now Accepts Single Tokens

`CSVRecordAssembler.assemble()` has been optimized to accept both single `Token` and `Iterable<Token>`, eliminating unnecessary array allocation in streaming scenarios.

**Before:**
```typescript
// Had to wrap single tokens in an array
for (const token of tokens) {
  const records = assembler.assemble([token], { stream: true });  // Array allocation
}
```

**After:**
```typescript
// Pass single tokens directly (backward compatible)
for (const token of tokens) {
  const records = assembler.assemble(token, { stream: true });  // No array allocation
}

// Iterable still works
const records = assembler.assemble(tokens, { stream: true });
```

**Benefits:**
- Zero-allocation token processing in streaming mode
- Better memory efficiency for large CSV files
- Backward compatible - existing code continues to work
- Aligns with Web Standards (TextDecoder pattern)

**Implementation Details:**
- Uses lightweight `Symbol.iterator` check to detect iterables
- Internal refactoring with private `#processToken()` and `#flush()` methods
- Maintains single public method (`assemble`) following TextDecoder pattern

## New Feature: Configurable Queuing Strategies

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
- **Parameter 3** `readableStrategy`: Controls buffering for outgoing tokens
  - Default: `{ highWaterMark: 1024, size: () => 1 }`
  - Counts each **token as 1**
  - Default allows 1024 tokens

### CSVRecordAssemblerTransformer

- **Parameter 1** `options`: CSV-specific options (header, maxFieldCount, etc.)
- **Parameter 2** `writableStrategy`: Controls buffering for incoming tokens
  - Default: `{ highWaterMark: 1024, size: () => 1 }`
  - Counts each **token as 1**
  - Default allows 1024 tokens
- **Parameter 3** `readableStrategy`: Controls buffering for outgoing CSV records
  - Default: `{ highWaterMark: 256, size: () => 1 }`
  - Counts each **record as 1**
  - Default allows 256 records

## Default Values Rationale

**Important**: The default values are **theoretical starting points** based on data flow characteristics, **not empirical benchmarks**.

### Size Counting Strategy

Each transformer uses a **simple and consistent size algorithm**:

- **CSVLexerTransformer writable**: Counts by **string length** (characters). This provides accurate backpressure based on actual data volume.
- **CSVLexerTransformer readable**: Counts **each token as 1**. Simple and consistent with downstream.
- **CSVRecordAssemblerTransformer writable**: Counts **each token as 1**. Matches the lexer's readable side for smooth pipeline flow.
- **CSVRecordAssemblerTransformer readable**: Counts **each record as 1**. Simple and effective for record-based backpressure.

### Why These Defaults?

- **Uniform counting**: Token and record stages all use `size: () => 1` for simplicity
- **Character-based input**: Only the initial string input uses character counting for predictable memory usage
- **Predictable pipeline**: Consistent token-by-token and record-by-record flow throughout
- **Natural backpressure**: Fine-grained control allows responsive backpressure handling

### Backpressure Handling

Both transformers implement **cooperative backpressure handling** with configurable check intervals:

- Periodically checks `controller.desiredSize` during processing
- When backpressure is detected (`desiredSize ≤ 0`), yields to the event loop via `setTimeout(0)`
- Prevents blocking the main thread during heavy CSV processing
- Allows downstream consumers to catch up, avoiding memory buildup

**Configurable Check Interval:**
- Set via `checkInterval` property in `ExtendedQueuingStrategy`
- Lower values = more responsive but slight overhead
- Higher values = less overhead but slower response
- Defaults: 100 tokens (lexer), 10 records (assembler)

This is especially important for:
- Large CSV files that generate many tokens/records
- Slow downstream consumers (e.g., database writes, API calls)
- Browser environments where UI responsiveness is critical

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
  {
    highWaterMark: 131072,         // 128KB of characters
    size: (chunk) => chunk.length, // Count by character length
    checkInterval: 200             // Check backpressure every 200 tokens
  },
  {
    highWaterMark: 2048,           // 2048 tokens
    size: () => 1,                 // Each token counts as 1
    checkInterval: 50              // Check backpressure every 50 tokens
  }
);

const assembler = new CSVRecordAssemblerTransformer(
  {},
  {
    highWaterMark: 2048,  // 2048 tokens
    size: () => 1,        // Each token counts as 1
    checkInterval: 20     // Check backpressure every 20 records
  },
  {
    highWaterMark: 512,   // 512 records
    size: () => 1,        // Each record counts as 1
    checkInterval: 5      // Check backpressure every 5 records
  }
);
```

## When to Customize

- **High-throughput servers**: Try higher values (e.g., 32-64) and benchmark
- **Memory-constrained environments** (browsers, edge functions): Try lower values (e.g., 1-4) and monitor memory
- **Custom pipelines**: Profile with representative data and iterate

## Web Standards Compliance

This API follows the Web Streams API pattern where `TransformStream` accepts queuing strategies as constructor arguments, making it consistent with standard web platform APIs.
