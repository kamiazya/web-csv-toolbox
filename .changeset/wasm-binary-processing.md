---
"web-csv-toolbox": minor
---

feat(wasm): production-ready WASM CSV parser with binary streaming support

## Overview

This release introduces a production-ready WebAssembly CSV parser implementation built on the `csv-core` Rust library, featuring optimized data transfer between WASM and JavaScript, binary streaming support, and unified API integration.

## WASM Parser Implementation

### csv-core Based Parser

The WASM parser has been completely rewritten using the battle-tested `csv-core` library:

- **Reliable parsing**: Leverages csv-core's proven DFA-based state machine
- **Full RFC 4180 compliance**: Proper handling of quoted fields, escaped quotes, and various line endings (LF, CRLF, CR)
- **UTF-8 support**: Correct multi-byte character handling in field values

### Flat Data Transfer Optimization

Introduced a "Flat" data transfer format that dramatically reduces WASM↔JS boundary crossings:

```
Traditional Object Approach (SLOW):
- N × Object.new() calls
- N × M × Reflect.set() calls
- Total: N × (M + 2) boundary crossings

Flat Array Approach (FAST):
- 1 × headers array (cached)
- 1 × fieldData array (all values in single flat array)
- Total: ~3 boundary crossings

For 1000-row × 20-column CSV: 21,000 → 3 crossings (99.98% reduction)
```

### New WASM Parser Classes

- `WASMBinaryCSVParserBase` - Base class for binary input
- `WASMStringCSVParserBase` - Base class for string input (uses TextEncoder internally)
- `WASMBinaryCSVArrayParser` - Returns array of arrays
- `WASMBinaryObjectCSVParser` - Returns array of objects
- `WASMStringCSVArrayParser` - String input, array output
- `WASMStringObjectCSVParser` - String input, object output

## Binary Streaming Support

### New APIs

```typescript
import { parseBinaryStream, parseBinaryStreamToStream } from 'web-csv-toolbox';

// Parse binary stream to async iterable
for await (const record of parseBinaryStream(binaryStream)) {
  console.log(record);
}

// Parse binary stream to ReadableStream
const recordStream = parseBinaryStreamToStream(binaryStream);
```

### WASM Binary Stream Transformer

```typescript
import { WASMBinaryCSVStreamTransformer } from 'web-csv-toolbox';

const transformer = new WASMBinaryCSVStreamTransformer();
const recordStream = binaryStream.pipeThrough(transformer);
```

## Unified Engine API

### Engine Option for All Parse Functions

All parsing functions now accept an `engine` option to choose between JavaScript and WASM:

```typescript
import { parseString, parseBinary, parse } from 'web-csv-toolbox';

// Use WASM engine
const records = parseString.toArraySync(csv, { engine: { wasm: true } });

// Use JavaScript engine (default)
const records = parseString.toArraySync(csv, { engine: { wasm: false } });

// Combine with worker
for await (const record of parse(csv, {
  engine: { worker: true, wasm: true }
})) {
  console.log(record);
}
```

### Factory Functions with Engine Support

```typescript
import { createStringCSVParser, createBinaryCSVParser } from 'web-csv-toolbox';

const wasmParser = createStringCSVParser({
  header: ['name', 'age'] as const,
  engine: { wasm: true }
});

const binaryParser = createBinaryCSVParser({
  engine: { wasm: true }
});
```

## Breaking Changes

### Removed `parseStringToArraySyncWASM`

The dedicated WASM function has been removed in favor of the unified engine option:

```typescript
// Before (removed)
import { parseStringToArraySyncWASM } from 'web-csv-toolbox';
const records = parseStringToArraySyncWASM(csv);

// After
import { parseString } from 'web-csv-toolbox';
const records = parseString.toArraySync(csv, { engine: { wasm: true } });
```

### WASM Initialization Required

WASM parsers now require explicit initialization before use:

```typescript
import { loadWASMSync, parseString } from 'web-csv-toolbox';

// Must initialize WASM first
loadWASMSync();

// Then use WASM features
const records = parseString.toArraySync(csv, { engine: { wasm: true } });
```

### WASM Delimiter/Quotation Constraints

WASM mode only supports single-byte ASCII characters for delimiter and quotation:

```typescript
// ✅ Valid
createStringCSVParser({ delimiter: ',', engine: { wasm: true } });
createStringCSVParser({ delimiter: ';', engine: { wasm: true } });

// ❌ Invalid - multi-byte UTF-8
createStringCSVParser({ delimiter: '、', engine: { wasm: true } });
// Error: Delimiter must be a single-byte ASCII character
```

## Type Improvements

### WorkerEngineConfig Discriminated Union

`WorkerEngineConfig` now enforces mutual exclusivity between `workerURL` and `workerPool`:

```typescript
// ✅ Valid configurations
{ worker: true, workerURL: '/worker.js' }
{ worker: true, workerPool: pool }
{ worker: true }

// ❌ Type Error
{ worker: true, workerURL: '/worker.js', workerPool: pool }
```

### New Types

- `FactoryEngineConfig` - Engine configuration for factory functions
- `FactoryEngineOptions` - Options interface with engine property
- `FlatParseResult` - WASM flat data transfer result type
- `FlatParseData` - Internal flat data representation

## Rust/WASM Crate Changes

- Migrated from custom DFA implementation to `csv-core` library
- Added `CSVParser` class with streaming `processChunkBytes()` and `finish()` methods
- Implemented `FlatParseResult` for efficient data transfer
- Added comprehensive test suite for line endings and edge cases
- Removed legacy `Lexer` and `Assembler` implementations

## Performance

Benchmarks show significant improvements for WASM parsing:

- **Small CSV (< 1KB)**: JS slightly faster due to WASM initialization overhead
- **Medium CSV (10KB-100KB)**: WASM 1.5-2x faster
- **Large CSV (> 1MB)**: WASM 2-3x faster with lower memory pressure
- **Binary streaming**: Eliminates string conversion overhead for binary sources
