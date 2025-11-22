---
title: Engine Presets Reference
group: Reference
---

# Engine Presets Reference

Pre-configured engine settings for common use cases.

## Overview

Engine presets provide convenient configurations that combine worker execution, WASM acceleration, and streaming strategies for optimal performance in different scenarios.

**Stability Considerations:**

- **Most Stable**: `stable` - Uses only standard JavaScript APIs, works everywhere, supports WHATWG Encoding Standard encodings
- **Stable**: `responsive`, `fast`, `responsiveFast` - Use stable Web Workers and/or WebAssembly APIs but may require bundler configuration
- **Experimental**: `memoryEfficient`, `balanced` - Use Transferable Streams API which is still evolving and may change (both have automatic stable fallback)

**All presets are functions** that optionally accept configuration options like `workerPool`, `workerURL`, `arrayBufferThreshold`, `backpressureCheckInterval`, `queuingStrategy`, and `onFallback`.

**Each preset is optimized for specific performance characteristics:**
- Parse speed (execution time)
- UI responsiveness (non-blocking)
- Memory efficiency
- Stability

**Basic usage:**
```typescript
engine: EnginePresets.balanced()
```

**With WorkerPool:**
```typescript
import { ReusableWorkerPool } from 'web-csv-toolbox';
const pool = new ReusableWorkerPool({ maxWorkers: 4 });
engine: EnginePresets.balanced({ workerPool: pool })
```

## Quick Reference

| Preset | Optimization Target | Worker | WASM | Strategy | Stability |
|--------|---------------------|--------|------|----------|-----------|
| `stable` | Stability | ❌ | ❌ | - | ⭐ Most Stable |
| `responsive` | UI responsiveness | ✅ | ❌ | message-streaming | ✅ Stable |
| `memoryEfficient` | Memory efficiency | ✅ | ❌ | stream-transfer | ⚠️ Experimental |
| `fast` | Parse speed | ❌ | ✅ | - | ✅ Stable |
| `responsiveFast` | UI responsiveness + parse speed | ✅ | ✅ | message-streaming | ✅ Stable |
| `balanced` | Balanced (general-purpose) | ✅ | ❌ | stream-transfer | ⚠️ Experimental |

## Available Presets

### `EnginePresets.stable()`

```typescript
{
  worker: false,
  wasm: false
}
```

**Description:** Most stable configuration using only standard JavaScript APIs.

**Optimization target:** Stability

**Performance characteristics:**
- Parse speed: Standard (JavaScript execution)
- UI responsiveness: ❌ Blocks main thread
- Memory efficiency: Standard
- Stability: ⭐ Most stable (standard JavaScript APIs only)

**Trade-offs:**
- ✅ Most stable: Uses only standard JavaScript APIs
- ✅ No worker initialization overhead
- ✅ No worker communication overhead
- ✅ Supports WHATWG Encoding Standard encodings (via TextDecoder)
- ✅ Supports all quotation characters
- ✅ Works everywhere without configuration
- ❌ Blocks main thread during parsing

**Use when:**
- Stability is the highest priority
- UI blocking is acceptable
- Server-side parsing
- Maximum compatibility required

**Example:**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

for await (const record of parseString(csv, {
  engine: EnginePresets.stable()
})) {
  console.log(record);
}
```

---

### `EnginePresets.responsive()`

```typescript
{
  worker: true,
  wasm: false,
  workerStrategy: "message-streaming"
}
```

**Description:** UI responsiveness optimized configuration.

**Optimization target:** UI responsiveness (non-blocking)

**Performance characteristics:**
- Parse speed: Slower (worker communication overhead)
- UI responsiveness: ✅ Non-blocking (worker execution)
- Memory efficiency: Standard
- Stability: ✅ Stable (Web Workers API)

**Trade-offs:**
- ✅ Non-blocking UI: Parsing runs in worker thread
- ✅ Supports WHATWG Encoding Standard encodings (via TextDecoder)
- ✅ Supports all quotation characters
- ✅ Works on all browsers including Safari
- ⚠️ Worker communication overhead: Data transfer between threads
- ⚠️ Requires bundler configuration for worker URL

**Use when:**
- UI responsiveness is critical
- Browser applications with interactive UI
- Broad encoding support required
- Safari compatibility needed

**Example:**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

for await (const record of parseString(csv, {
  engine: EnginePresets.responsive()
})) {
  console.log(record);
  // UI stays responsive!
}
```

---

### `EnginePresets.memoryEfficient()`

```typescript
{
  worker: true,
  wasm: false,
  workerStrategy: "stream-transfer"
}
```

**Description:** Memory efficiency optimized configuration.

**Optimization target:** Memory efficiency

**Performance characteristics:**
- Parse speed: Slower (worker communication overhead)
- UI responsiveness: ✅ Non-blocking (worker execution)
- Memory efficiency: ✅ Optimized (zero-copy stream transfer)
- Stability: ⚠️ Experimental (Transferable Streams API)

**Trade-offs:**
- ✅ Memory efficient: Zero-copy stream transfer when supported
- ✅ Non-blocking UI: Parsing runs in worker thread
- ✅ Constant memory usage for streaming workloads
- ✅ Supports WHATWG Encoding Standard encodings (via TextDecoder)
- ✅ Supports all quotation characters
- ✅ Automatic fallback to message-streaming on Safari
- ⚠️ Experimental API: Transferable Streams may change
- ⚠️ Worker communication overhead: Data transfer between threads

**Use when:**
- Memory efficiency is important
- Streaming large CSV files
- Chrome/Firefox/Edge browsers (auto-fallback on Safari)

**Example:**
```typescript
import { parse, EnginePresets } from 'web-csv-toolbox';

const response = await fetch('huge-data.csv');

for await (const record of parse(response, {
  engine: EnginePresets.memoryEfficient()
})) {
  console.log(record);
  // Memory: O(1) per record
}
```

---

### `EnginePresets.fast()`

```typescript
{
  worker: false,
  wasm: true
}
```

**Description:** Parse speed optimized configuration.

**Optimization target:** Parse speed (execution time)

**Performance characteristics:**
- Parse speed: ✅ Fast (compiled WASM code, no worker overhead)
- UI responsiveness: ❌ Blocks main thread
- Memory efficiency: Standard
- Stability: ✅ Stable (WebAssembly standard)

**Trade-offs:**
- ✅ Fast parse speed: Compiled WASM code
- ✅ No worker initialization overhead
- ✅ No worker communication overhead
- ⚠️ WASM implementation may change in future versions
- ❌ Blocks main thread during parsing
- ❌ UTF-8 encoding only
- ❌ Double-quote (`"`) only
- ❌ Requires loadWASM() initialization

**Use when:**
- Parse speed is the highest priority
- UI blocking is acceptable
- UTF-8 CSV files with double-quote
- Server-side parsing

**Limitations:**
- Only supports UTF-8 encoding
- Only supports double-quote (`"`) as quotation character
- Must call `loadWASM()` before use

**Example:**
```typescript
import { parseString, EnginePresets, loadWASM } from 'web-csv-toolbox';

await loadWASM();

for await (const record of parseString(csv, {
  engine: EnginePresets.fast()
})) {
  console.log(record);
}
```

---

### `EnginePresets.responsiveFast()`

```typescript
{
  worker: true,
  wasm: true,
  workerStrategy: "message-streaming"
}
```

**Description:** UI responsiveness + parse speed optimized configuration.

**Optimization target:** UI responsiveness + parse speed

**Performance characteristics:**
- Parse speed: Fast (compiled WASM code) but slower than fast() due to worker overhead
- UI responsiveness: ✅ Non-blocking (worker execution)
- Memory efficiency: Standard
- Stability: ✅ Stable (Web Workers + WebAssembly)

**Trade-offs:**
- ✅ Non-blocking UI: Parsing runs in worker thread
- ✅ Fast parse speed: Compiled WASM code
- ⚠️ Worker communication overhead: Slower than fast() on main thread
- ⚠️ Requires bundler configuration for worker URL
- ⚠️ WASM implementation may change in future versions
- ❌ UTF-8 encoding only
- ❌ Double-quote (`"`) only
- ❌ Requires loadWASM() initialization

**Use when:**
- Both UI responsiveness and parse speed are important
- UTF-8 CSV files with double-quote
- Browser applications requiring non-blocking parsing

**Example:**
```typescript
import { parseString, EnginePresets, loadWASM } from 'web-csv-toolbox';

await loadWASM();

for await (const record of parseString(csv, {
  engine: EnginePresets.responsiveFast()
})) {
  console.log(record);
  // Fast + non-blocking!
}
```

---

### `EnginePresets.balanced()`

```typescript
{
  worker: true,
  wasm: false,
  workerStrategy: "stream-transfer"
}
```

**Description:** Balanced configuration for general-purpose CSV processing.

**Optimization target:** Balanced (UI responsiveness + memory efficiency + broad compatibility)

**Performance characteristics:**
- Parse speed: Slower (worker communication overhead)
- UI responsiveness: ✅ Non-blocking (worker execution)
- Memory efficiency: ✅ Optimized (zero-copy stream transfer when supported)
- Stability: ⚠️ Experimental (Transferable Streams) with stable fallback

**Trade-offs:**
- ✅ Non-blocking UI: Parsing runs in worker thread
- ✅ Memory efficient: Zero-copy stream transfer when supported
- ✅ Supports WHATWG Encoding Standard encodings (via TextDecoder)
- ✅ Supports all quotation characters
- ✅ Automatic fallback to message-streaming on Safari
- ✅ Broad compatibility: Handles user uploads with various encodings
- ⚠️ Experimental API: Transferable Streams may change
- ⚠️ Worker communication overhead: Data transfer between threads

**Use when:**
- General-purpose CSV processing
- Broad encoding support required
- Safari compatibility needed (auto-fallback)
- User-uploaded files with various encodings

**Example:**
```typescript
import { parseStringStream, EnginePresets, ReusableWorkerPool } from 'web-csv-toolbox';

const pool = new ReusableWorkerPool({ maxWorkers: 4 });

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

## Decision Guide

### By Optimization Priority

Choose the preset that matches your primary optimization goal:

- **Stability:** `stable` ⭐
  - Most stable: Uses only standard JavaScript APIs
  - WHATWG Encoding Standard encodings and all quotation characters
  - Works everywhere without configuration
  - Accept main thread blocking

- **UI Responsiveness:** `responsive` or `balanced`
  - `responsive`: ✅ Stable, WHATWG Encoding Standard encodings
  - `balanced`: ⚠️ Experimental (with stable fallback), memory efficient

- **Parse Speed:** `fast` or `responsiveFast`
  - `fast`: ✅ Fastest parse time, blocks main thread, UTF-8 only
  - `responsiveFast`: ✅ Non-blocking + fast parsing, UTF-8 only

- **Memory Efficiency:** `memoryEfficient` or `balanced`
  - `memoryEfficient`: ⚠️ Experimental, zero-copy streams
  - `balanced`: ⚠️ Experimental (with stable fallback), general-purpose

### By Use Case

- **General-purpose CSV processing:** `balanced`
  - Balanced performance characteristics
  - WHATWG Encoding Standard encodings supported
  - Automatic Safari fallback
  - ⚠️ Uses experimental API but has stable fallback

- **Maximum stability required:** `stable`
  - Uses only standard JavaScript APIs
  - WHATWG Encoding Standard encodings
  - Accept main thread blocking

- **Browser with interactive UI:** `responsive` or `balanced`
  - `responsive`: ✅ Stable, WHATWG Encoding Standard encodings
  - `balanced`: ⚠️ Experimental with fallback, memory efficient

- **Server-side parsing:** `stable` or `fast`
  - `stable`: ⭐ Most stable, WHATWG Encoding Standard encodings
  - `fast`: ✅ Faster parse speed, UTF-8 only

- **UTF-8 files only:** `fast` or `responsiveFast`
  - `fast`: ✅ Fastest parse time, blocks main thread
  - `responsiveFast`: ✅ Non-blocking + fast parsing

- **Streaming large files:** `memoryEfficient` or `balanced`
  - Zero-copy streams when supported
  - Constant memory usage
  - ⚠️ Both use experimental API

### By Environment

- **Browser (UI-critical):** `responsive` or `balanced`
  - Non-blocking UI
  - WHATWG Encoding Standard encodings
  - `responsive`: ✅ Stable
  - `balanced`: ⚠️ Experimental with stable fallback

- **Browser (UTF-8 only):** `responsiveFast`
  - ✅ Stable
  - Non-blocking UI + fast parsing
  - Compiled WASM code

- **Server-side:** `stable` or `fast`
  - No worker overhead
  - Blocking acceptable
  - `stable`: ⭐ Most stable, WHATWG Encoding Standard encodings
  - `fast`: ✅ Faster parsing, UTF-8 only

- **Safari required:** `responsive` or `balanced`
  - `responsive`: ✅ Stable, message-streaming
  - `balanced`: ⚠️ Experimental with automatic fallback

- **Chrome/Firefox/Edge only:** `memoryEfficient`
  - ⚠️ Experimental
  - Zero-copy stream transfer

**Note:** Choose execution strategy based on your requirements (stability, blocking vs non-blocking, parse speed, memory efficiency, encoding support) rather than file size alone. Benchmark your specific use case to determine the best approach.

---

## Related Documentation

- **[Execution Strategies](../explanation/execution-strategies.md)** - Understanding how strategies work
- **[How-To: Secure CSV Processing](../how-to-guides/secure-csv-processing.md)** - Using presets securely

For advanced configuration options beyond presets, refer to the [`EngineConfig`](https://kamiazya.github.io/web-csv-toolbox/interfaces/EngineConfig.html) type documentation in your IDE or the [API Reference](https://kamiazya.github.io/web-csv-toolbox/).
