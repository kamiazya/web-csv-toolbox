---
title: Engine Presets Reference
group: Reference
---

# Engine Presets Reference

Pre-configured engine settings for common use cases.

## Overview

Engine presets provide convenient configurations that combine worker execution, WASM acceleration, and streaming strategies for optimal performance in different scenarios.

**All presets are functions** that optionally accept configuration options like `workerPool`, `workerURL`, `arrayBufferThreshold`, `backpressureCheckInterval`, `queuingStrategy`, and `onFallback`.

**Basic usage:**
```typescript
engine: EnginePresets.fastest()
```

**With WorkerPool:**
```typescript
const pool = new WorkerPool({ maxWorkers: 4 });
engine: EnginePresets.balanced({ workerPool: pool })
```

## Quick Reference

| Preset | Worker | WASM | Strategy | Use Case | Performance | Memory |
|--------|--------|------|----------|----------|-------------|--------|
| `mainThread` | ❌ | ❌ | - | Small files | Baseline | Low |
| `worker` | ✅ | ❌ | message-streaming | Medium files | Good | Low |
| `workerStreamTransfer` | ✅ | ❌ | stream-transfer | Large streams | Good | Very Low |
| `wasm` | ❌ | ✅ | - | Medium UTF-8 | 2-3x faster | Low |
| `workerWasm` | ✅ | ✅ | message-streaming | Large UTF-8 | 2-3x faster | Low |
| `fastest` | ✅ | ✅ | stream-transfer | Any large file | Best | Very Low |
| `balanced` | ✅ | ❌ | stream-transfer | **Production** | Good | Very Low |
| `strict` | ✅ | ❌ | stream-transfer | Testing | Good | Very Low |

## Available Presets

### `EnginePresets.mainThread()`

```typescript
{
  worker: false,
  wasm: false
}
```

**Description:** Default configuration that runs parsing on the main thread.

**Use Case:**
- Small CSV files (< 1MB)
- Simple use cases where UI blocking is acceptable
- Maximum compatibility

**Characteristics:**
- ✅ No worker initialization overhead
- ✅ Works everywhere
- ❌ Blocks main thread during parsing
- ❌ Not suitable for large files

**Example:**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

for await (const record of parseString(csv, {
  engine: EnginePresets.mainThread()
})) {
  console.log(record);
}
```

---

### `EnginePresets.worker()`

```typescript
{
  worker: true,
  wasm: false,
  workerStrategy: "message-streaming"
}
```

**Description:** Offloads parsing to a worker thread using message-based communication.

**Use Case:**
- Medium files (1-10MB)
- Browser applications with interactive UI
- When Safari support is required

**Characteristics:**
- ✅ Non-blocking: UI remains responsive
- ✅ Works on all browsers including Safari
- ✅ Supports all character encodings
- ⚠️ Message passing overhead for records

**Example:**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

for await (const record of parseString(csv, {
  engine: EnginePresets.worker()
})) {
  console.log(record);
  // UI stays responsive!
}
```

---

### `EnginePresets.workerStreamTransfer()`

```typescript
{
  worker: true,
  wasm: false,
  workerStrategy: "stream-transfer"
}
```

**Description:** Uses Transferable Streams for zero-copy stream transfer to workers.

**Use Case:**
- Large streaming files (> 10MB)
- Memory-sensitive applications
- Chrome/Firefox/Edge browsers

**Characteristics:**
- ✅ Zero-copy stream transfer
- ✅ Constant memory usage
- ✅ Best for streaming workloads
- ⚠️ Not supported on Safari (auto-falls back to message-streaming)

**Example:**
```typescript
import { parse, EnginePresets } from 'web-csv-toolbox';

const response = await fetch('huge-data.csv');

for await (const record of parse(response, {
  engine: EnginePresets.workerStreamTransfer()
})) {
  console.log(record);
  // Memory: O(1) per record
}
```

---

### `EnginePresets.wasm()`

```typescript
{
  worker: false,
  wasm: true
}
```

**Description:** Uses WebAssembly for high-performance parsing on the main thread.

**Use Case:**
- Medium-sized UTF-8 files (1-10MB)
- Performance-critical applications
- When UI blocking is acceptable

**Characteristics:**
- ✅ 2-3x faster than JavaScript
- ✅ Lower CPU usage
- ❌ UTF-8 encoding only
- ❌ Double-quote (`"`) only
- ❌ Blocks main thread

**Limitations:**
- Only supports UTF-8 encoding
- Only supports double-quote (`"`) as quotation character
- Must call `loadWASM()` before use

**Example:**
```typescript
import { parseString, EnginePresets, loadWASM } from 'web-csv-toolbox';

await loadWASM();

for await (const record of parseString(csv, {
  engine: EnginePresets.wasm
})) {
  console.log(record);
}
```

---

### `EnginePresets.workerWasm()`

```typescript
{
  worker: true,
  wasm: true,
  workerStrategy: "message-streaming"
}
```

**Description:** Combines worker offloading with WASM acceleration.

**Use Case:**
- Large UTF-8 files (> 10MB)
- Performance-critical applications with interactive UI
- Best overall performance for compatible files

**Characteristics:**
- ✅ 2-3x faster than JavaScript
- ✅ Non-blocking UI
- ❌ UTF-8 encoding only
- ❌ Double-quote (`"`) only

**Example:**
```typescript
import { parseString, EnginePresets, loadWASM } from 'web-csv-toolbox';

await loadWASM();

for await (const record of parseString(csv, {
  engine: EnginePresets.workerWasm()
})) {
  console.log(record);
  // Fast + non-blocking!
}
```

---

### `EnginePresets.fastest()` ⚡

```typescript
{
  worker: true,
  wasm: true,
  workerStrategy: "stream-transfer"
}
```

**Description:** Automatically selects the best execution strategy for maximum performance.

**Use Case:**
- Large files of any type
- When you want the best performance available
- Production applications handling various file sizes

**Characteristics:**
- ✅ Best overall performance
- ✅ Zero-copy streams when available
- ✅ Non-blocking UI
- ⚠️ UTF-8 + double-quote limitation (WASM)
- ⚠️ Requires `loadWASM()` call

**Example:**
```typescript
import { parse, EnginePresets, loadWASM } from 'web-csv-toolbox';

await loadWASM();

const response = await fetch('data.csv');

for await (const record of parse(response, {
  engine: EnginePresets.fastest
})) {
  console.log(record);
}
```

---

### `EnginePresets.balanced()` ⭐

```typescript
{
  worker: true,
  wasm: false,
  workerStrategy: "stream-transfer"
}
```

**Description:** **Recommended for production** - balanced configuration with broad compatibility.

**Use Case:**
- **Production applications** processing user uploads
- When character encoding support is required
- When Safari support is needed (auto-fallback)
- General-purpose CSV processing

**Characteristics:**
- ✅ Non-blocking UI
- ✅ Zero-copy streams (with fallback)
- ✅ All character encodings supported
- ✅ All quotation characters supported
- ✅ Automatic fallback on Safari

**Why Balanced for Production:**
- Handles all CSV formats (not limited to UTF-8)
- Works on all modern browsers
- Good performance without WASM complexity
- Suitable for user-uploaded files with unknown encoding

**Example:**
```typescript
import { parseStringStream, EnginePresets, WorkerPool } from 'web-csv-toolbox';

const pool = new WorkerPool({ maxWorkers: 4 });

app.post('/validate-csv', async (c) => {
  if (pool.isFull()) {
    return c.json({ error: 'Service busy' }, 503);
  }

  const csvStream = c.req.raw.body?.pipeThrough(new TextDecoderStream());

  for await (const record of parseStringStream(csvStream, {
    engine: EnginePresets.balanced({ workerPool: pool })
  })) {
    // Process securely...
  }
});
```

**Example with Custom Blob Reading Threshold:**
```typescript
import { parseBlob, EnginePresets } from 'web-csv-toolbox';

// Optimize for small files: always use arrayBuffer up to 512KB
const config = EnginePresets.balanced({
  arrayBufferThreshold: 512 * 1024  // 512KB
});

for await (const record of parseBlob(file, {
  engine: config
})) {
  console.log(record);
}
```

**Example with Advanced Performance Tuning (Experimental):**
```typescript
import { parseBlob, EnginePresets } from 'web-csv-toolbox';

// Configuration tuned for potential high-throughput scenarios
const config = EnginePresets.balanced({
  arrayBufferThreshold: 2 * 1024 * 1024,  // 2MB
  backpressureCheckInterval: {
    lexer: 200,      // Check every 200 tokens (less frequent checks)
    assembler: 20    // Check every 20 records (less frequent checks)
  },
  queuingStrategy: {
    // Tune entire pipeline with larger buffers
    lexerWritable: new CountQueuingStrategy({ highWaterMark: 200 }),
    lexerReadable: new CountQueuingStrategy({ highWaterMark: 100 }),
    assemblerWritable: new CountQueuingStrategy({ highWaterMark: 100 }),
    assemblerReadable: new CountQueuingStrategy({ highWaterMark: 50 })
  }
});

for await (const record of parseBlob(file, {
  engine: config
})) {
  console.log(record);
}
```

---

### `EnginePresets.strict()`

```typescript
{
  worker: true,
  wasm: false,
  workerStrategy: "stream-transfer",
  strict: true
}
```

**Description:** Strict mode that throws errors instead of falling back to main thread.

**Use Case:**
- Testing environments
- When you need guaranteed execution mode
- Detecting worker support issues

**Characteristics:**
- ✅ No silent fallbacks
- ✅ Useful for debugging
- ❌ Will throw if workers unavailable

**Example:**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

try {
  for await (const record of parseString(csv, {
    engine: EnginePresets.strict
  })) {
    console.log(record);
  }
} catch (error) {
  console.error('Worker execution failed:', error);
}
```

---

## Decision Guide

### By File Size

- **< 1MB:** `mainThread` or `worker`
  - Note: `parseBlob()` and `parseFile()` automatically optimize for small files using `arrayBufferThreshold` (default 1MB)
- **1-10MB:** `balanced` (production) or `worker`
- **> 10MB:** `fastest` (UTF-8) or `balanced` (any encoding)
- **> 100MB:** `balanced` or `workerStreamTransfer` with streaming input

### By Use Case

- **Production (user uploads):** `balanced` ⭐
- **Maximum performance (UTF-8):** `fastest`
- **Maximum compatibility:** `worker`
- **Testing/debugging:** `strict`
- **Small files, quick prototype:** `mainThread`

### By Environment

- **Browser (UI-critical):** `balanced` or `worker`
- **Node.js (server-side):** `balanced` or `fastest`
- **Safari required:** `worker` or `balanced`
- **Chrome/Firefox/Edge only:** `workerStreamTransfer` or `fastest`

---

## Related Documentation

- **[Engine Configuration](./engine-config.md)** - Detailed configuration options
- **[Execution Strategies](../explanation/execution-strategies.md)** - Understanding how strategies work
- **[How-To: Secure CSV Processing](../how-to-guides/secure-csv-processing.md)** - Using presets securely
