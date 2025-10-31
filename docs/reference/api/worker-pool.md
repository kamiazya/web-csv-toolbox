# WorkerPool API Reference

Worker pool management for concurrent CSV parsing.

## Overview

web-csv-toolbox provides two worker pool implementations:

- **`ReusableWorkerPool`** - For high-throughput scenarios (servers, batch processing)
- **`TransientWorkerPool`** - For one-shot operations (CLI tools, scripts) - used internally

Both implement the same `WorkerPool` interface for consistent behavior.

## WorkerPool Interface

```typescript
interface WorkerPool {
  getWorker(workerURL?: string | URL): Promise<Worker>;
  releaseWorker(worker: Worker): void;
  getNextRequestId(): number;
  readonly size: number;
  isFull(): boolean;
  terminate(): void;
  [Symbol.dispose](): void;
}
```

### Methods

#### `getWorker(workerURL?)`

Obtains a worker instance from the pool.

**Parameters:**
- `workerURL` (optional): Custom worker script URL

**Returns:** `Promise<Worker>`

**Behavior:**
- **ReusableWorkerPool**: Returns existing worker or creates new one up to `maxWorkers`
- **TransientWorkerPool**: Always creates a new worker

**Example:**
```typescript
const worker = await pool.getWorker();
```

---

#### `releaseWorker(worker)`

Returns a worker to the pool after job completion.

**Parameters:**
- `worker`: Worker instance to release

**Returns:** `void`

**Behavior:**
- **ReusableWorkerPool**: Keeps worker alive for reuse
- **TransientWorkerPool**: Terminates worker immediately

**Example:**
```typescript
pool.releaseWorker(worker);
```

**Note:** Typically handled automatically by `WorkerSession`.

---

#### `getNextRequestId()`

Generates unique request IDs for worker message tracking.

**Returns:** `number` - Monotonically increasing ID

**Example:**
```typescript
const id = pool.getNextRequestId(); // 0
const id2 = pool.getNextRequestId(); // 1
```

---

#### `size`

Current number of active workers in the pool.

**Type:** `number` (readonly)

**Returns:**
- **ReusableWorkerPool**: Number of workers currently in pool
- **TransientWorkerPool**: Always `0` (no persistent workers)

**Example:**
```typescript
console.log(pool.size); // 3
```

---

#### `isFull()`

Checks if the pool has reached maximum capacity.

**Returns:** `boolean`

**Returns:**
- **ReusableWorkerPool**: `true` if `size >= maxWorkers`
- **TransientWorkerPool**: Always `false`

**Example:**
```typescript
if (pool.isFull()) {
  return res.status(503).json({ error: 'Service busy' });
}
```

---

#### `terminate()`

Terminates all workers and cleans up resources.

**Returns:** `void`

**Behavior:**
- **ReusableWorkerPool**: Terminates all workers, resets pool
- **TransientWorkerPool**: No-op (workers already terminated)

**Example:**
```typescript
pool.terminate();
```

---

#### `[Symbol.dispose]()`

Dispose method for automatic resource cleanup with `using` syntax.

**Returns:** `void`

**Behavior:** Calls `terminate()` internally

**Example:**
```typescript
using pool = new ReusableWorkerPool({ maxWorkers: 4 });
// Workers automatically terminated when leaving scope
```

---

## ReusableWorkerPool

Worker pool that keeps workers alive for reuse across multiple jobs.

### Constructor

```typescript
new ReusableWorkerPool(options?: ReusableWorkerPoolOptions)
```

#### Options

```typescript
interface ReusableWorkerPoolOptions {
  maxWorkers?: number;
  workerURL?: string | URL;
}
```

**`maxWorkers`** (default: `1`)
- Maximum number of concurrent workers
- Workers are created on-demand up to this limit
- Additional requests wait or reuse existing workers (round-robin)

**`workerURL`** (optional)
- Custom worker script URL
- Overrides bundled worker

**Example:**
```typescript
const pool = new ReusableWorkerPool({
  maxWorkers: 4,
  workerURL: new URL('./custom-worker.js', import.meta.url)
});
```

### Usage Examples

#### Basic Usage

```typescript
import { ReusableWorkerPool, parseString } from 'web-csv-toolbox';

using pool = new ReusableWorkerPool({ maxWorkers: 4 });

for await (const record of parseString(csv, {
  engine: { worker: true, workerPool: pool }
})) {
  console.log(record);
}
```

#### Server Application

```typescript
import { Hono } from 'hono';
import { ReusableWorkerPool, parseString } from 'web-csv-toolbox';

const app = new Hono();
const pool = new ReusableWorkerPool({ maxWorkers: 4 });

app.post('/parse-csv', async (c) => {
  if (pool.isFull()) {
    return c.json({ error: 'Service busy, try again later' }, 503);
  }

  const csv = await c.req.text();
  const records = [];

  for await (const record of parseString(csv, {
    engine: { worker: true, workerPool: pool }
  })) {
    records.push(record);
  }

  return c.json({ records });
});

// Cleanup on shutdown
process.on('SIGTERM', () => {
  pool.terminate();
  process.exit(0);
});

export default app;
```

#### Concurrent File Processing

```typescript
import { ReusableWorkerPool, parseString } from 'web-csv-toolbox';

using pool = new ReusableWorkerPool({ maxWorkers: 4 });

const files = ['data1.csv', 'data2.csv', 'data3.csv'];

await Promise.all(
  files.map(async (filename) => {
    const csv = await fs.readFile(filename, 'utf-8');
    const records = [];

    for await (const record of parseString(csv, {
      engine: { worker: true, workerPool: pool }
    })) {
      records.push(record);
    }

    return records;
  })
);
```

### Error Handling

```typescript
using pool = new ReusableWorkerPool({ maxWorkers: 4 });

try {
  for await (const record of parseString(csv, {
    engine: { worker: true, workerPool: pool }
  })) {
    console.log(record);
  }
} catch (error) {
  console.error('Parsing failed:', error);
  // Pool cleanup happens automatically via 'using'
}
```

### Load Balancing

ReusableWorkerPool uses round-robin load balancing:

```typescript
using pool = new ReusableWorkerPool({ maxWorkers: 3 });

const w1 = await pool.getWorker(); // Creates worker 1
const w2 = await pool.getWorker(); // Creates worker 2
const w3 = await pool.getWorker(); // Creates worker 3
const w4 = await pool.getWorker(); // Returns worker 1 (round-robin)
```

---

## TransientWorkerPool

Worker pool that terminates workers immediately after each job.

### Constructor

```typescript
new TransientWorkerPool(options?: TransientWorkerPoolOptions)
```

#### Options

```typescript
interface TransientWorkerPoolOptions {
  workerURL?: string | URL;
}
```

**`workerURL`** (optional)
- Custom worker script URL

**Note:** `maxWorkers` option is not available (always creates new workers)

**Example:**
```typescript
const pool = new TransientWorkerPool({
  workerURL: new URL('./custom-worker.js', import.meta.url)
});
```

### Characteristics

- Workers are created for each job
- Workers are terminated immediately after use
- No persistent workers (`size` always returns `0`)
- `isFull()` always returns `false`
- Lower memory usage
- Higher per-job overhead

### When to Use

**✅ Use TransientWorkerPool when:**
- Building CLI tools or scripts
- Processing single files
- Want zero-maintenance cleanup
- Memory usage is a concern

**❌ Avoid TransientWorkerPool when:**
- Processing multiple files
- Running long-lived server applications
- Worker creation overhead is significant

### Internal Usage

TransientWorkerPool is used internally as the default pool:

```typescript
// No pool specified → TransientWorkerPool used automatically
const records = await parseString(csv, { engine: { worker: true } });
// Worker already terminated
```

---

## Best Practices

### 1. Use `using` syntax

```typescript
// ✅ Recommended
using pool = new ReusableWorkerPool({ maxWorkers: 4 });
// Automatic cleanup

// ❌ Manual cleanup required
const pool = new ReusableWorkerPool({ maxWorkers: 4 });
try {
  // ...
} finally {
  pool.terminate(); // Easy to forget!
}
```

### 2. Limit pool size appropriately

```typescript
// ✅ Reasonable limits
const pool = new ReusableWorkerPool({
  maxWorkers: Math.min(4, navigator.hardwareConcurrency)
});

// ❌ Unbounded workers
const pool = new ReusableWorkerPool({
  maxWorkers: 1000 // Resource exhaustion risk!
});
```

### 3. Implement backpressure

```typescript
app.post('/parse', async (c) => {
  // ✅ Early rejection
  if (pool.isFull()) {
    return c.json({ error: 'Service busy' }, 503);
  }

  // Process request...
});
```

### 4. Share pools across requests

```typescript
// ✅ Single pool for entire application
const globalPool = new ReusableWorkerPool({ maxWorkers: 4 });

app.post('/parse1', handler1);
app.post('/parse2', handler2);

// ❌ New pool per request
app.post('/parse', async (c) => {
  const pool = new ReusableWorkerPool({ maxWorkers: 4 }); // Wasteful!
});
```

---

## Performance Considerations

### Worker Initialization

Worker creation has measurable overhead that varies by:
- JavaScript runtime (Node.js, Deno, browser)
- System resources
- WASM usage (additional loading time if enabled)

### Memory Characteristics

| Pool Type | Memory Pattern | Resource Release |
|-----------|----------------|------------------|
| ReusableWorkerPool | Persistent | On pool termination |
| TransientWorkerPool | Transient | After each job |

### Recommendations

**Choose based on your use case:**

| Scenario | Recommended Pool |
|----------|-----------------|
| Single file, CLI tool | Default (TransientWorkerPool) |
| Multiple files, batch | ReusableWorkerPool |
| Long-running server | ReusableWorkerPool |
| Memory-constrained | TransientWorkerPool |

**Note:** Actual performance depends on file size, system resources, and CSV complexity. Test with your specific workload for accurate measurements.

---

## Related Documentation

- **[Worker Pool Architecture](../../explanation/worker-pool-architecture.md)** - Design rationale and internals
- **[Working with Workers](../../tutorials/working-with-workers.md)** - Tutorial
- **[Execution Strategies](../../explanation/execution-strategies.md)** - Performance patterns
- **[Secure CSV Processing](../../how-to-guides/secure-csv-processing.md)** - Security best practices
