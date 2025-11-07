---
"web-csv-toolbox": minor
---

Add `arrayBufferThreshold` option to Engine configuration for automatic Blob reading strategy selection

## New Feature

Added `engine.arrayBufferThreshold` option that automatically selects the optimal Blob reading strategy based on file size:

- **Files smaller than threshold**: Use `blob.arrayBuffer()` + `parseBinary()` (6-8x faster, confirmed by benchmarks)
- **Files equal to or larger than threshold**: Use `blob.stream()` + `parseUint8ArrayStream()` (memory-efficient)

**Default:** 1MB (1,048,576 bytes), determined by comprehensive benchmarks

**Applies to:** `parseBlob()` and `parseFile()` only

## Benchmark Results

| File Size | Binary (ops/sec) | Stream (ops/sec) | Performance Gain |
|-----------|------------------|------------------|------------------|
| 1KB       | 21,691           | 2,685            | **8.08x faster** |
| 10KB      | 2,187            | 311              | **7.03x faster** |
| 100KB     | 219              | 32               | **6.84x faster** |
| 1MB       | 20               | 3                | **6.67x faster** |

## Usage

```typescript
import { parseBlob, EnginePresets } from 'web-csv-toolbox';

// Use default (1MB threshold)
for await (const record of parseBlob(file)) {
  console.log(record);
}

// Always use streaming (memory-efficient)
for await (const record of parseBlob(largeFile, {
  engine: { arrayBufferThreshold: 0 }
})) {
  console.log(record);
}

// Custom threshold (512KB)
for await (const record of parseBlob(file, {
  engine: { arrayBufferThreshold: 512 * 1024 }
})) {
  console.log(record);
}

// With preset
for await (const record of parseBlob(file, {
  engine: EnginePresets.fastest({
    arrayBufferThreshold: 2 * 1024 * 1024  // 2MB
  })
})) {
  console.log(record);
}
```

## Special Values

- `0` - Always use streaming (maximum memory efficiency)
- `Infinity` - Always use arrayBuffer (maximum performance for small files)

## Security Note

When using `arrayBufferThreshold > 0`, files must stay below `maxBufferSize` (default 10MB) to prevent excessive memory allocation. Files exceeding this limit will throw a `RangeError`.

## Design Philosophy

This option belongs to `engine` configuration because it affects **performance and behavior only**, not the parsing result specification. This follows the design principle:

- **Top-level options**: Affect specification (result changes)
- **Engine options**: Affect performance/behavior (same result, different execution)
