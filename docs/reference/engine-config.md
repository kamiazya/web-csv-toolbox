---
title: Engine Configuration Reference
group: Reference
---

# Engine Configuration Reference

Complete reference for the `engine` configuration option.

## Overview

The `engine` option controls how CSV parsing is executed. It allows you to:
- Offload parsing to worker threads
- Enable WebAssembly acceleration
- Choose streaming strategies
- Configure worker pools
- Control fallback behavior
- Optimize Blob reading strategy (for `parseBlob()` and `parseFile()`)
- Fine-tune backpressure handling (experimental)
- Customize internal queuing strategies (experimental)

## Configuration Object

```typescript
interface EngineConfig {
  worker?: boolean;
  wasm?: boolean;
  workerStrategy?: 'message-streaming' | 'stream-transfer';
  workerPool?: WorkerPool;
  workerURL?: string;
  strict?: boolean;
  arrayBufferThreshold?: number;
  backpressureCheckInterval?: {
    lexer?: number;
    assembler?: number;
  };
  queuingStrategy?: {
    lexerWritable?: QueuingStrategy<string>;
    lexerReadable?: QueuingStrategy<Token>;
    assemblerWritable?: QueuingStrategy<Token>;
    assemblerReadable?: QueuingStrategy<CSVRecord<any>>;
  };
}
```

## Options

### `worker`

**Type:** `boolean`
**Default:** `false`

Enable worker thread execution to offload parsing from the main thread.

**Platforms:**
- **Browser:** Uses Web Workers
- **Node.js:** Uses Worker Threads
- **Deno:** Uses Web Workers API

**Example:**
```typescript
import { parseString } from 'web-csv-toolbox';

for await (const record of parseString(csv, {
  engine: { worker: true }
})) {
  console.log(record);
  // Main thread stays responsive!
}
```

**Benefits:**
- ✅ Non-blocking: UI remains responsive
- ✅ Better performance for large files
- ✅ Parallel processing capability

**Considerations:**
- ⚠️ Worker initialization overhead
- ⚠️ Best for medium to large files

---

### `wasm`

**Type:** `boolean`
**Default:** `false`

Enable WebAssembly-based parsing for improved performance.

**Requirements:**
- Must call `loadWASM()` before use
- Only supports UTF-8 encoding
- Only supports double-quote (`"`) as quotation character

**Example:**
```typescript
import { parseString, loadWASM } from 'web-csv-toolbox';

await loadWASM();

for await (const record of parseString(csv, {
  engine: { wasm: true }
})) {
  console.log(record);
}
```

**Performance:**
- ✅ 2-3x faster than JavaScript implementation
- ✅ Lower CPU usage

**Limitations:**
- ❌ UTF-8 only (no Shift-JIS, EUC-JP, etc.)
- ❌ Double-quote only (no single-quote support)
- ❌ No streaming (must have complete string)

---

### `workerStrategy`

**Type:** `'message-streaming' | 'stream-transfer'`
**Default:** `'message-streaming'`

Choose how data is transferred between main thread and worker.

#### `'message-streaming'`

Records are sent via `postMessage` one by one.

**Characteristics:**
- ✅ Works on all browsers including Safari
- ✅ Reliable and well-supported
- ⚠️ Some message passing overhead

**Example:**
```typescript
{
  worker: true,
  workerStrategy: 'message-streaming'
}
```

#### `'stream-transfer'`

Streams are transferred directly using Transferable Streams (zero-copy).

**Characteristics:**
- ✅ Zero-copy transfer (very efficient)
- ✅ Constant memory usage
- ✅ Best for large streaming workloads
- ⚠️ Only supported on Chrome, Firefox, Edge
- ⚠️ Automatically falls back to message-streaming on Safari

**Example:**
```typescript
{
  worker: true,
  workerStrategy: 'stream-transfer'
}
```

**Browser Support:**
- ✅ Chrome 102+
- ✅ Firefox 103+
- ✅ Edge 102+
- ❌ Safari (auto-falls back)

---

### `workerPool`

**Type:** `WorkerPool`
**Default:** Shared singleton pool

Specify a custom WorkerPool for managing worker lifecycle.

**Why Use Custom Pool:**
- Control maximum concurrent workers
- Manage worker lifecycle explicitly
- Prevent resource exhaustion attacks

**Example:**
```typescript
import { WorkerPool, parseString } from 'web-csv-toolbox';

const pool = new WorkerPool({ maxWorkers: 4 });

app.onShutdown(() => {
  pool.terminate();
});

for await (const record of parseString(csv, {
  engine: { worker: true, workerPool: pool }
})) {
  console.log(record);
}
```

**Security:** Always use `WorkerPool` with limited `maxWorkers` in production applications that process user uploads.

See: [How-To: Secure CSV Processing](../how-to-guides/secure-csv-processing.md)

---

### `workerURL`

**Type:** `string`
**Default:** Bundled worker script

Specify a custom worker script URL.

**Use Case:**
- Custom worker implementations
- CDN-hosted workers
- Self-hosting requirements

**Example:**
```typescript
{
  worker: true,
  workerURL: 'https://cdn.example.com/csv-worker.js'
}
```

**Note:** Custom workers must implement the expected message protocol.

---

### `strict`

**Type:** `boolean`
**Default:** `false`

Enable strict mode to prevent automatic fallbacks.

**Behavior:**
- When `true`: Throws error if worker/WASM unavailable
- When `false`: Silently falls back to main thread

**Use Case:**
- Testing environments
- Ensuring specific execution mode
- Debugging worker issues

**Example:**
```typescript
{
  worker: true,
  strict: true  // Will throw if workers unavailable
}
```

---

### `arrayBufferThreshold`

**Type:** `number` (bytes)
**Default:** `1048576` (1MB)
**Applies to:** `parseBlob()` and `parseFile()` only

Controls the automatic selection between two Blob reading strategies based on file size.

**Strategies:**
1. **Files smaller than threshold:** Use `blob.arrayBuffer()` + `parseBinary()`
   - ✅ **6-8x faster** for small files (confirmed by benchmarks)
   - ❌ Loads entire file into memory
   - ❌ Limited by `maxBufferSize` (default 10MB)

2. **Files equal to or larger than threshold:** Use `blob.stream()` + `parseUint8ArrayStream()`
   - ✅ Memory-efficient streaming
   - ✅ No size limit (processes incrementally)
   - ⚠️ Slight streaming overhead

**Benchmark Results:**

| File Size | Binary (ops/sec) | Stream (ops/sec) | Performance Gain |
|-----------|------------------|------------------|------------------|
| 1KB       | 21,691           | 2,685            | **8.08x faster** |
| 10KB      | 2,187            | 311              | **7.03x faster** |
| 100KB     | 219              | 32               | **6.84x faster** |
| 1MB       | 20               | 3                | **6.67x faster** |

**Special Values:**
- `0` - Always use streaming (maximum memory efficiency)
- `Infinity` - Always use arrayBuffer (maximum performance for small files)

**Default Rationale:**
The 1MB default threshold is determined by benchmarks and provides:
- Optimal performance for files ≤1MB (6-8x faster)
- Memory efficiency for larger files
- Safe margin below the default `maxBufferSize` (10MB)

**Example: Always Use Streaming (Memory-Efficient)**
```typescript
import { parseBlob } from 'web-csv-toolbox';

const largeFile = new Blob([csvData], { type: 'text/csv' });

for await (const record of parseBlob(largeFile, {
  engine: { arrayBufferThreshold: 0 }  // Always stream
})) {
  console.log(record);
}
```

**Example: Custom Threshold (512KB)**
```typescript
import { parseBlob } from 'web-csv-toolbox';

for await (const record of parseBlob(file, {
  engine: { arrayBufferThreshold: 512 * 1024 }  // 512KB threshold
})) {
  console.log(record);
}
```

**Example: Always Use ArrayBuffer (Small Files)**
```typescript
import { parseBlob } from 'web-csv-toolbox';

const smallFile = new Blob([csvData], { type: 'text/csv' });

for await (const record of parseBlob(smallFile, {
  engine: { arrayBufferThreshold: Infinity }  // Always use arrayBuffer
})) {
  console.log(record);
}
```

**Security Note:**
When using `arrayBufferThreshold > 0`, ensure files stay below `maxBufferSize` (default 10MB). Files exceeding this limit will throw a `RangeError` for security reasons.

**See Also:**
- [Security: maxBufferSize](../explanation/security-model.md#maxbuffersize) - Buffer size limit
- [parseBlob API](./api/parseBlob.md) - Blob parsing

---

### `backpressureCheckInterval` 🧪

**Type:** `{ lexer?: number; assembler?: number }`
**Default:** `{ lexer: 100, assembler: 10 }`
**Status:** Experimental

Controls how frequently the internal parsers check for backpressure during streaming operations (count-based: number of tokens/records processed).

**⚠️ Advanced Performance Tuning**

This is an **experimental** feature for advanced users. The default values are designed to work well for most scenarios. Only adjust these if profiling indicates a need for tuning or you're experiencing specific performance issues with large streaming operations.

**Parameters:**
- `lexer` - Check interval for the lexer stage (default: every 100 tokens processed)
- `assembler` - Check interval for the assembler stage (default: every 10 records processed)

**Lower values:**
- ✅ Better responsiveness to backpressure
- ⚠️ Slight performance overhead

**Higher values:**
- ✅ Less overhead
- ⚠️ Slower backpressure response

**Example: Increase Check Frequency**
```typescript
import { parseString } from 'web-csv-toolbox';

for await (const record of parseString(csv, {
  engine: {
    backpressureCheckInterval: {
      lexer: 50,      // Check every 50 tokens (more responsive)
      assembler: 5    // Check every 5 records (more responsive)
    }
  }
})) {
  console.log(record);
}
```

**Example: Decrease Check Frequency (Performance-Focused)**
```typescript
for await (const record of parseString(csv, {
  engine: {
    backpressureCheckInterval: {
      lexer: 200,     // Check every 200 tokens (less overhead)
      assembler: 20   // Check every 20 records (less overhead)
    }
  }
})) {
  console.log(record);
}
```

**When to Consider Adjusting:**
- **Memory-constrained environments:** Consider lower values for more responsive backpressure
- **Scenarios where checking overhead is a concern:** Consider higher values
- **Slow consumers:** Consider lower values to propagate backpressure more quickly

**Note:** This API may change in future versions based on ongoing performance research.

---

### `queuingStrategy` 🧪

**Type:** `object`
**Status:** Experimental

Controls the internal queuing behavior of the CSV parser's streaming pipeline.

**⚠️ Advanced Performance Tuning**

This is an **experimental** feature for advanced users. The default queuing strategies are designed to balance memory usage and buffering behavior. Only adjust these if profiling indicates a need for tuning or you have specific memory or performance requirements.

**Structure:**
```typescript
{
  lexerWritable?: QueuingStrategy<string>;
  lexerReadable?: QueuingStrategy<Token>;
  assemblerWritable?: QueuingStrategy<Token>;
  assemblerReadable?: QueuingStrategy<CSVRecord<any>>;
}
```

**Pipeline Stages:**

The CSV parser uses a two-stage pipeline:
1. **Lexer**: String → Token
2. **Assembler**: Token → CSVRecord

Each stage has both writable (input) and readable (output) sides:

1. **lexerWritable** - Lexer input (string chunks)
2. **lexerReadable** - Lexer output (tokens) → Assembler input buffer
3. **assemblerWritable** - Assembler input (tokens from lexer)
4. **assemblerReadable** - Assembler output (CSV records)

**Example: Memory-Constrained Environment**
```typescript
import { parseString } from 'web-csv-toolbox';

for await (const record of parseString(csv, {
  engine: {
    queuingStrategy: {
      // Minimize memory usage with smaller buffers across entire pipeline
      lexerWritable: new CountQueuingStrategy({ highWaterMark: 1 }),
      lexerReadable: new CountQueuingStrategy({ highWaterMark: 1 }),
      assemblerWritable: new CountQueuingStrategy({ highWaterMark: 1 }),
      assemblerReadable: new CountQueuingStrategy({ highWaterMark: 1 })
    }
  }
})) {
  console.log(record);
}
```

**Example: Tuning for Potential High-Throughput Scenarios**
```typescript
for await (const record of parseString(csv, {
  engine: {
    queuingStrategy: {
      // Larger buffers to allow more buffering
      lexerWritable: new CountQueuingStrategy({ highWaterMark: 200 }),
      lexerReadable: new CountQueuingStrategy({ highWaterMark: 100 }),
      assemblerWritable: new CountQueuingStrategy({ highWaterMark: 100 }),
      assemblerReadable: new CountQueuingStrategy({ highWaterMark: 50 })
    }
  }
})) {
  console.log(record);
}
```

**Example: Optimize Token Buffer (Between Lexer and Assembler)**
```typescript
for await (const record of parseString(csv, {
  engine: {
    queuingStrategy: {
      // Only tune the token transfer between stages
      lexerReadable: new CountQueuingStrategy({ highWaterMark: 2048 }),
      assemblerWritable: new CountQueuingStrategy({ highWaterMark: 2048 })
    }
  }
})) {
  console.log(record);
}
```

**Theoretical Trade-offs:**

Adjusting `highWaterMark` values affects the balance between memory usage and buffering behavior:

- **Smaller values (1-10)**: Less memory used for buffering, backpressure applied more quickly
- **Larger values (100+)**: More memory used for buffering, backpressure applied less frequently

**Note:** The actual performance impact depends on your specific use case, data characteristics, and runtime environment. The default values are designed to work well for most scenarios. Only adjust these settings if profiling indicates a need for tuning.

**Potential Use Cases:**
- **Memory-constrained environments**: Consider smaller highWaterMark values
- **High-throughput batch processing**: Consider larger highWaterMark values
- **Responsive streaming**: Consider smaller highWaterMark values for faster backpressure propagation

**Note:** This API may change in future versions based on ongoing performance research.

**See Also:**
- [MDN: Streams API - Queuing Strategy](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API/Concepts#queuing_strategies)
- [Web Streams Specification](https://streams.spec.whatwg.org/#qs-api)

---

## Configuration Patterns

### Production (Secure User Uploads)

```typescript
import { WorkerPool, EnginePresets } from 'web-csv-toolbox';

const pool = new WorkerPool({ maxWorkers: 4 });

const config = EnginePresets.balanced({
  workerPool: pool
});
```

**Why:**
- ✅ Resource protection with WorkerPool
- ✅ Broad encoding support (no WASM limitation)
- ✅ Automatic fallback on Safari

### Maximum Performance (UTF-8)

```typescript
import { EnginePresets, loadWASM } from 'web-csv-toolbox';

await loadWASM();

const config = EnginePresets.fastest();
```

**Why:**
- ✅ WASM acceleration (2-3x faster)
- ✅ Zero-copy streams
- ✅ Non-blocking UI

### Maximum Compatibility

```typescript
const config = EnginePresets.worker();
```

**Why:**
- ✅ Works on all browsers
- ✅ All encodings supported
- ✅ Reliable message-streaming

### Testing/Debugging

```typescript
const config = EnginePresets.strict();
```

**Why:**
- ✅ No silent fallbacks
- ✅ Explicit error handling
- ✅ Guaranteed execution mode

### Advanced Performance Tuning 🧪

```typescript
import { EnginePresets } from 'web-csv-toolbox';

const config = EnginePresets.fastest({
  arrayBufferThreshold: 2 * 1024 * 1024,  // 2MB threshold
  backpressureCheckInterval: {
    lexer: 50,      // Check every 50 tokens (more responsive)
    assembler: 5    // Check every 5 records (more responsive)
  },
  queuingStrategy: {
    // Tune entire pipeline with larger buffers
    lexerWritable: new CountQueuingStrategy({ highWaterMark: 200 }),
    lexerReadable: new CountQueuingStrategy({ highWaterMark: 100 }),
    assemblerWritable: new CountQueuingStrategy({ highWaterMark: 100 }),
    assemblerReadable: new CountQueuingStrategy({ highWaterMark: 50 })
  }
});
```

**Configuration:**
- ✅ Custom blob reading threshold
- ✅ Adjusted backpressure checking frequency
- ✅ Larger queuing buffers throughout pipeline

**⚠️ Note:** These are experimental APIs that may change in future versions.

### Memory-Constrained Environment 🧪

```typescript
import { EnginePresets } from 'web-csv-toolbox';

const config = EnginePresets.balanced({
  arrayBufferThreshold: 0,  // Always use streaming
  backpressureCheckInterval: {
    lexer: 10,      // Check every 10 tokens (frequent checks)
    assembler: 5    // Check every 5 records (frequent checks)
  },
  queuingStrategy: {
    // Minimal buffers throughout entire pipeline
    lexerWritable: new CountQueuingStrategy({ highWaterMark: 1 }),
    lexerReadable: new CountQueuingStrategy({ highWaterMark: 1 }),
    assemblerWritable: new CountQueuingStrategy({ highWaterMark: 1 }),
    assemblerReadable: new CountQueuingStrategy({ highWaterMark: 1 })
  }
});
```

**Why:**
- ✅ Minimal memory footprint
- ✅ Aggressive backpressure handling
- ✅ Small buffers throughout pipeline

**Use Cases:**
- IoT devices
- Embedded systems
- Lambda/Edge functions with memory limits

---

## WorkerPool API

### Constructor

```typescript
new WorkerPool(options?: WorkerPoolOptions)
```

**Options:**
```typescript
interface WorkerPoolOptions {
  maxWorkers?: number;  // Default: 1
}
```

**Example:**
```typescript
const pool = new WorkerPool({ maxWorkers: 4 });
```

### Methods

#### `isFull()`

Check if the pool has reached maximum capacity.

**Returns:** `boolean`

**Example:**
```typescript
if (pool.isFull()) {
  return c.json({ error: 'Service busy' }, 503);
}
```

#### `terminate()`

Terminate all workers and clean up resources.

**Example:**
```typescript
app.onShutdown(() => {
  pool.terminate();
});
```

#### `getWorker()`

Get a worker from the pool (internal use).

**Returns:** `Promise<Worker>`

### Properties

#### `size`

Get the current number of active workers.

**Type:** `number` (read-only)

**Example:**
```typescript
console.log(`Active workers: ${pool.size}`);
```

---

## Platform-Specific Notes

### Browser

**Web Workers:**
- Automatic worker script bundling
- Transferable Streams support (Chrome/Firefox/Edge)
- Message-streaming fallback (Safari)

**Memory:**
- Workers run in separate memory space
- Good for isolating parsing from UI

### Node.js

**Worker Threads:**
- Available in Node.js LTS
- Slightly higher overhead than browser
- Useful for CPU-intensive parsing

**Considerations:**
- Workers share V8 instance
- Less isolation than browser workers

### Deno

**Web Workers API:**
- Similar to browser implementation
- Good compatibility

---

## Performance Characteristics

### Strategy Comparison

<!-- TODO: Add actual performance measurements based on benchmarks -->

| Configuration | Init Cost | Parse Speed | Memory | UI Blocking |
|--------------|-----------|-------------|---------|-------------|
| `{ worker: false }` | None | Baseline | Low | Yes |
| `{ worker: true }` | Low (worker init) | Baseline | Low | No |
| `{ wasm: true }` | Very Low | Faster | Low | Yes |
| `{ worker: true, wasm: true }` | Low (worker init) | Faster | Low | No |

**Note:** Actual performance varies based on hardware, runtime, and CSV complexity. See [CodSpeed benchmarks](https://codspeed.io/kamiazya/web-csv-toolbox) for measured results.

### When to Use Workers

✅ **Use workers when:**
- File size > 1MB
- UI responsiveness required
- Processing multiple files concurrently
- Server-side with spare CPU cores

❌ **Skip workers when:**
- File size < 100KB
- Worker initialization overhead matters
- Simple scripts without UI

---

## Error Handling

### Worker Unavailable

```typescript
try {
  for await (const record of parseString(csv, {
    engine: { worker: true, strict: true }
  })) {
    console.log(record);
  }
} catch (error) {
  if (error.message.includes('Worker')) {
    console.error('Workers not available, falling back...');
    // Handle fallback
  }
}
```

### WASM Not Loaded

```typescript
import { parseString, loadWASM } from 'web-csv-toolbox';

try {
  await loadWASM();
} catch (error) {
  console.error('WASM failed to load:', error);
  // Use non-WASM config
}

for await (const record of parseString(csv, {
  engine: { wasm: true }
})) {
  console.log(record);
}
```

---

## Related Documentation

- **[Engine Presets](./engine-presets.md)** - Pre-configured settings
- **[Execution Strategies](../explanation/execution-strategies.md)** - Understanding strategies
- **[How-To: Secure CSV Processing](../how-to-guides/secure-csv-processing.md)** - Security best practices
