# Engine Configuration Reference

Complete reference for the `engine` configuration option.

## Overview

The `engine` option controls how CSV parsing is executed. It allows you to:
- Offload parsing to worker threads
- Enable WebAssembly acceleration
- Choose streaming strategies
- Configure worker pools
- Control fallback behavior

## Configuration Object

```typescript
interface EngineConfig {
  worker?: boolean;
  wasm?: boolean;
  workerStrategy?: 'message-streaming' | 'stream-transfer';
  workerPool?: WorkerPool;
  workerURL?: string;
  strict?: boolean;
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
