# Worker Pool Architecture

This document explains how worker pool management works in web-csv-toolbox and why two different pool implementations exist.

> **Note for Bundler Users**: When using Workers with bundlers, you must specify the `workerURL` option. See [How to Use with Bundlers](../how-to-guides/use-with-bundlers.md) for configuration details.

## Background

Web Workers are asynchronous resources that, if not properly terminated, can prevent Node.js processes from exiting. This creates a critical challenge for library design:

### Problem 1: Process Hanging

```typescript
// Without proper cleanup
const records = await parseString(csv, { engine: { worker: true } });
console.log('Done');
// Process never exits! Worker is still alive
```

### Problem 2: User Experience

```typescript
// Forcing users to clean up
const records = await parseString(csv, { engine: { worker: true } });
await terminateWorkers(); // Users must remember this!
```

These conflicting requirements led to the dual-pool architecture.

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────┐
│ WorkerPool Interface                                    │
│  Defines the contract for all worker pool              │
│  implementations                                        │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────────┐    ┌─────────────────────────────┐
│ ReusableWorkerPool  │    │ TransientWorkerPool         │
│                     │    │                             │
│ User-facing API     │    │ Internal default pool       │
│ Persistent workers  │    │ Auto-terminating workers    │
└─────────────────────┘    └─────────────────────────────┘
```

## WorkerPool Interface

The `WorkerPool` interface defines the contract that both implementations follow:

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

### Key Methods

**`getWorker()`**
- Obtains a worker instance for parsing
- Behavior varies by implementation

**`releaseWorker(worker)`**
- Returns worker to the pool after job completion
- Critical for lifecycle management

**`getNextRequestId()`**
- Generates unique IDs for worker message tracking
- Prevents message confusion in concurrent scenarios

**`size`**
- Number of active workers in the pool
- Always 0 for TransientWorkerPool

**`isFull()`**
- Checks if pool reached capacity
- Useful for backpressure and rate limiting

## ReusableWorkerPool

### Design Philosophy

ReusableWorkerPool is designed for **high-throughput scenarios** where worker reuse significantly reduces overhead.

### Characteristics

**Worker Lifecycle:**
```text
getWorker() → [Worker Pool] → releaseWorker()
                 │    ▲              │
                 │    └──────────────┘
                 │    (Worker kept alive)
                 │
              terminate()
                 │
                 ▼
            [Workers terminated]
```

**Key Features:**
- ✅ Workers are kept alive and reused
- ✅ Configurable pool size via `maxWorkers`
- ✅ Round-robin load balancing
- ✅ Explicit cleanup with `using` syntax
- ✅ Optimal for server applications

### Implementation Details

```typescript
interface WorkerEntry {
  worker: Worker;
  url: string;
}

class ReusableWorkerPool implements WorkerPool {
  private workers: WorkerEntry[] = [];
  private currentWorkerIndex = 0;
  private readonly maxWorkers: number;
  private pendingWorkerCreations: Map<string, Promise<Worker>> = new Map();
  private pendingCreationsByURL: Map<string, Set<string>> = new Map();
  private disposed = false;
  private nextPendingId = 0;

  async getWorker(workerURL?: string | URL): Promise<Worker> {
    if (this.disposed) {
      throw new Error("Worker pool has been disposed");
    }

    const urlKey = workerURL ? String(workerURL) : "default";

    // Find workers matching the requested URL
    const matchingWorkers = this.workers.filter(entry => entry.url === urlKey);

    if (this.workers.length < this.maxWorkers) {
      // Create new worker with unique ID
      const pendingId = `${urlKey}-${this.nextPendingId++}`;
      const workerPromise = createWorker(workerURL)
        .then(worker => {
          if (this.disposed) {
            worker.terminate();
            throw new Error("Worker pool was disposed during worker creation");
          }
          this.workers.push({ worker, url: urlKey });
          // Cleanup pending maps
          this.pendingWorkerCreations.delete(pendingId);
          const urlPendings = this.pendingCreationsByURL.get(urlKey);
          if (urlPendings) {
            urlPendings.delete(pendingId);
            if (urlPendings.size === 0) {
              this.pendingCreationsByURL.delete(urlKey);
            }
          }
          return worker;
        });

      this.pendingWorkerCreations.set(pendingId, workerPromise);
      if (!this.pendingCreationsByURL.has(urlKey)) {
        this.pendingCreationsByURL.set(urlKey, new Set());
      }
      this.pendingCreationsByURL.get(urlKey)!.add(pendingId);
      return workerPromise;
    }

    // Pool is full - use round-robin among matching workers
    if (matchingWorkers.length === 0) {
      throw new Error(
        `Worker pool is at maximum capacity and no worker with URL "${urlKey}" is available`
      );
    }

    const matchingIndices = this.workers
      .map((entry, index) => entry.url === urlKey ? index : -1)
      .filter(index => index !== -1);

    let selectedIndex = matchingIndices[0];
    for (const index of matchingIndices) {
      if (index >= this.currentWorkerIndex) {
        selectedIndex = index;
        break;
      }
    }

    this.currentWorkerIndex = (selectedIndex + 1) % this.workers.length;
    return this.workers[selectedIndex].worker;
  }

  releaseWorker(worker: Worker): void {
    // Keep worker alive for reuse
  }

  terminate(): void {
    this.disposed = true;

    // Terminate all existing workers
    for (const entry of this.workers) {
      entry.worker.terminate();
    }
    this.workers = [];
    this.currentWorkerIndex = 0;

    // Clear all pending creations
    this.pendingWorkerCreations.clear();
    this.pendingCreationsByURL.clear();
  }
}
```

#### Disposed State Management

The `disposed` flag prevents new worker creation after the pool has been terminated:

**Problem:** Without disposal tracking, workers could be created during or after `terminate()`:
```typescript
const pool = new ReusableWorkerPool({ maxWorkers: 2 });

// Start worker creation
const promise1 = pool.getWorker(); // Worker creation in progress

// Terminate pool
pool.terminate();

// This worker is created AFTER termination, causing resource leak
const worker = await promise1; // ❌ Worker created but not tracked
```

**Solution:** Check `disposed` flag and terminate orphaned workers:
```typescript
async getWorker(workerURL?: string | URL): Promise<Worker> {
  if (this.disposed) {
    throw new Error("Worker pool has been disposed");
  }

  const workerPromise = createWorker(workerURL).then(worker => {
    if (this.disposed) {
      // Pool was disposed during worker creation
      worker.terminate(); // Immediately terminate orphaned worker
      throw new Error("Worker pool was disposed during worker creation");
    }
    // Safe to add worker to pool
    this.workers.push({ worker, url: urlKey });
    return worker;
  });

  return workerPromise;
}
```

This ensures:
1. No new requests are accepted after disposal
2. Workers created during disposal are immediately terminated
3. No resource leaks from race conditions

#### URL-Based Worker Isolation

Workers are tracked by their source URL to prevent URL mixing:

**Problem:** Different worker URLs should create separate worker instances:
```typescript
const pool = new ReusableWorkerPool({ maxWorkers: 2 });

// Worker from default URL
const worker1 = await pool.getWorker(); // default URL

// Worker from custom URL - should create NEW worker, not reuse worker1
const worker2 = await pool.getWorker(new URL('./custom-worker.js', import.meta.url));
```

**Solution:** Track each worker's URL and match requests:
```typescript
interface WorkerEntry {
  worker: Worker;
  url: string; // Track worker's source URL
}

// Separate workers by URL
private workers: WorkerEntry[] = [];
private pendingCreationsByURL: Map<string, Set<string>> = new Map();

async getWorker(workerURL?: string | URL): Promise<Worker> {
  const urlKey = workerURL ? String(workerURL) : "default";

  // Find workers matching the requested URL
  const matchingWorkers = this.workers.filter(entry => entry.url === urlKey);

  if (matchingWorkers.length === 0 && this.isFull()) {
    // Pool is full but no matching URL workers exist
    throw new Error(
      `Worker pool is at maximum capacity and no worker with URL "${urlKey}" is available`
    );
  }

  // Use round-robin ONLY among workers with matching URL
  const matchingIndices = this.workers
    .map((entry, index) => entry.url === urlKey ? index : -1)
    .filter(index => index !== -1);

  return this.workers[matchingIndices[selectedIndex]].worker;
}
```

**Concurrent Creation Handling:**
```typescript
// Use unique IDs to allow multiple workers with same URL
private nextPendingId = 0;

async getWorker(workerURL?: string | URL): Promise<Worker> {
  const urlKey = workerURL ? String(workerURL) : "default";
  const pendingId = `${urlKey}-${this.nextPendingId++}`;

  // Multiple concurrent requests with same URL each create a worker
  this.pendingWorkerCreations.set(pendingId, workerPromise);

  // Track by URL for matching logic
  if (!this.pendingCreationsByURL.has(urlKey)) {
    this.pendingCreationsByURL.set(urlKey, new Set());
  }
  this.pendingCreationsByURL.get(urlKey)!.add(pendingId);

  return workerPromise;
}
```

This ensures:
1. Workers with different URLs are never mixed
2. Multiple workers with the same URL can be created up to `maxWorkers`
3. Concurrent requests for the same URL each create their own worker
4. Pool capacity is correctly tracked including pending creations

### Use Cases

**Server-side processing:**
```typescript
using pool = new ReusableWorkerPool({ maxWorkers: 4 });

// Workers are reused across all requests
app.post('/parse', async (c) => {
  const csv = await c.req.text();
  const records = [];

  for await (const record of parseString(csv, {
    engine: { worker: true, workerPool: pool }
  })) {
    records.push(record);
  }

  return c.json(records);
});
```

**Batch processing:**
```typescript
using pool = new ReusableWorkerPool({ maxWorkers: 4 });

await Promise.all(
  files.map(file => parseString(file, {
    engine: { worker: true, workerPool: pool }
  }))
);
// Pool automatically cleaned up
```

## TransientWorkerPool

### Design Philosophy

TransientWorkerPool is designed for **one-shot operations** where automatic cleanup is more important than performance.

### Characteristics

**Worker Lifecycle:**
```text
getWorker() → [New Worker] → releaseWorker()
                                   │
                                   ▼
                              [Immediately terminated]
```

**Key Features:**
- ✅ Workers terminated after each job
- ✅ No memory leaks
- ✅ No process hanging
- ✅ Zero maintenance for users
- ✅ Optimal for CLI tools and scripts

### Implementation Details

```typescript
class TransientWorkerPool implements WorkerPool {
  async getWorker(workerURL?: string | URL): Promise<Worker> {
    // Always create new worker
    return createWorker(workerURL);
  }

  releaseWorker(worker: Worker): void {
    // Immediately terminate
    worker.terminate();
  }

  get size(): number {
    // No persistent workers
    return 0;
  }

  terminate(): void {
    // No-op: workers already terminated
  }
}
```

### Use Cases

**Default behavior (no pool specified):**
```typescript
// TransientWorkerPool used internally
const records = await parseString(csv, { engine: { worker: true } });
// Worker already terminated
```

**CLI tools:**
```typescript
#!/usr/bin/env node
import { parseString } from 'web-csv-toolbox';

const csv = await fs.readFile('data.csv', 'utf-8');
const records = [];

for await (const record of parseString(csv, {
  engine: { worker: true }
})) {
  records.push(record);
}

console.log(records);
// Process exits cleanly
```

## Performance Trade-offs

### Worker Creation Overhead

| Pool Type | Per-Job Overhead | Memory Usage | Best For |
|-----------|-----------------|--------------|----------|
| ReusableWorkerPool | Low (reuse) | High (persistent) | Servers |
| TransientWorkerPool | High (recreate) | Low (transient) | CLI/Scripts |

### Performance Characteristics

**ReusableWorkerPool:**
```typescript
using pool = new ReusableWorkerPool({ maxWorkers: 4 });
// Workers created once and reused
// Initial: Worker creation overhead
// Subsequent: Minimal overhead (reuse)
```

**TransientWorkerPool:**
```typescript
// Default behavior
// Per-job: Worker creation + termination overhead
// Memory: Released immediately after each job
```

**Trade-off:**
- **Single use**: TransientWorkerPool overhead is acceptable
- **Multiple uses**: ReusableWorkerPool amortizes creation cost
- **Memory-constrained**: TransientWorkerPool releases resources immediately
- **High-throughput**: ReusableWorkerPool reduces per-request latency

## Internal Default Pool

The library uses TransientWorkerPool internally when no pool is specified:

```typescript
// src/execution/worker/helpers/WorkerManager.ts
const defaultPool = new TransientWorkerPool();

export async function getWorker(workerURL?: string | URL): Promise<Worker> {
  return defaultPool.getWorker(workerURL);
}

export function releaseWorker(worker: Worker): void {
  defaultPool.releaseWorker(worker);
}
```

This ensures:
1. Users don't need to call cleanup functions
2. Processes exit cleanly
3. No memory leaks in simple use cases

## Memory and Resource Management

### ReusableWorkerPool Memory Pattern

```text
Memory Usage:
│
│     ┌─── Pool created
│     │
│     ├─── Workers created (persistent)
│     │    ████████████
│     │    ████████████
│     │    ████████████
│     │
│     └─── Pool disposed
│          Memory freed
└─────────────────────────► Time
```

### TransientWorkerPool Memory Pattern

```text
Memory Usage:
│
│     ┌─── Job 1 ──┐
│     │   ████     │ Worker terminated
│     │            │
│     ├─── Job 2 ──┤
│     │   ████     │ Worker terminated
│     │            │
│     └─── Job 3 ──┘
│         ████        Worker terminated
└─────────────────────────► Time
```

## Integration with WorkerSession

`WorkerSession` acts as a bridge between parse functions and worker pools:

```typescript
class WorkerSession implements Disposable {
  private worker: Worker;
  private readonly workerPool?: WorkerPool;

  [Symbol.dispose](): void {
    if (this.workerPool) {
      // Return to pool (behavior depends on pool type)
      this.workerPool.releaseWorker(this.worker);
    } else {
      // Terminate directly
      this.worker.terminate();
    }
  }
}
```

**Usage:**
```typescript
// With ReusableWorkerPool
using session = await WorkerSession.create({ workerPool: pool });
// Worker returned to pool on dispose

// With TransientWorkerPool (default)
using session = await WorkerSession.create();
// Worker terminated on dispose
```

## Why Not Just One Pool?

### Option 1: Always Reusable (rejected)
```typescript
// ❌ Users must always clean up
const pool = new WorkerPool({ maxWorkers: 1 });
const records = await parseString(csv, { engine: { worker: true, workerPool: pool } });
pool.terminate(); // Forgetting this = process hangs
```

### Option 2: Always Transient (rejected)
```typescript
// ❌ Poor performance for servers
app.post('/parse', async (c) => {
  // Worker created/destroyed per request
  // ~50ms overhead per request
  const records = await parseString(csv, { engine: { worker: true } });
  return c.json(records);
});
```

### Option 3: Dual Implementation (chosen) ✅
```typescript
// ✅ Simple use case: automatic cleanup
const records = await parseString(csv, { engine: { worker: true } });

// ✅ High-performance use case: manual pool
using pool = new ReusableWorkerPool({ maxWorkers: 4 });
const records = await parseString(csv, {
  engine: { worker: true, workerPool: pool }
});
```

## Design Principles

1. **Pit of Success**: Default behavior should work correctly without user intervention
2. **Progressive Enhancement**: Advanced users can opt into high-performance patterns
3. **Explicit Resource Management**: Use `using` syntax for clear ownership
4. **Zero-Cost Abstraction**: Overhead only when features are used
5. **Fail-Safe Defaults**: Prevent common mistakes (process hanging, memory leaks)

## Related Documentation

- **[Working with Workers](../tutorials/working-with-workers.md)** - Tutorial on worker usage
- **[WorkerPool Reference](../reference/api/worker-pool.md)** - API documentation
- **[Execution Strategies](./execution-strategies.md)** - Worker execution patterns
- **[Secure CSV Processing](../how-to-guides/secure-csv-processing.md)** - Security considerations
