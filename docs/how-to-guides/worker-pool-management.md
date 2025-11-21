---
title: Worker Pool Management
group: How-to Guides
---

# How to Manage Worker Pools

This guide shows you how to use `ReusableWorkerPool` effectively in production environments for high-throughput CSV processing.

> **API Reference:** For detailed type definitions, see:
> - [ReusableWorkerPool](https://kamiazya.github.io/web-csv-toolbox/classes/ReusableWorkerPool.html)
> - [WorkerPool Interface](https://kamiazya.github.io/web-csv-toolbox/interfaces/WorkerPool.html)

> **Understanding:** For design rationale, see [Worker Pool Architecture](../explanation/worker-pool-architecture.md)

> **Learning:** For beginner tutorials, see [Working with Workers](../tutorials/working-with-workers.md)

## When to Use Worker Pools

Worker pools are essential for production environments where:

- ✅ **Server applications** processing multiple concurrent CSV uploads
- ✅ **Batch processing** systems handling large volumes of CSV files
- ✅ **API endpoints** requiring controlled resource usage
- ✅ **Long-running services** where worker reuse reduces overhead

**Skip worker pools when:**
- ❌ One-time scripts or CLI tools (use default worker behavior)
- ❌ Single file processing with no concurrency
- ❌ Environments without worker support

## Basic Production Setup

### Step 1: Create a Global Worker Pool

**Server Application (Node.js/Deno/Bun):**

```typescript
import { ReusableWorkerPool } from 'web-csv-toolbox';

// Create pool once at application startup
export const csvWorkerPool = new ReusableWorkerPool({
  maxWorkers: 4  // Adjust based on your CPU cores
});

// Cleanup on shutdown
process.on('SIGTERM', () => {
  csvWorkerPool.terminate();
  process.exit(0);
});
```

### Step 2: Use Pool in Request Handlers

**Hono Example:**

```typescript
import { Hono } from 'hono';
import { parseRequest, EnginePresets } from 'web-csv-toolbox';
import { csvWorkerPool } from './worker-pool';

const app = new Hono();

app.post('/upload-csv', async (c) => {
  // Early rejection if pool is saturated
  if (csvWorkerPool.isFull()) {
    return c.json({ error: 'Service busy, try again later' }, 503);
  }

  try {
    const records = [];
    for await (const record of parseRequest(c.req.raw, {
      engine: EnginePresets.balanced({ workerPool: csvWorkerPool })
    })) {
      records.push(record);
    }

    return c.json({ success: true, count: records.length });
  } catch (error) {
    return c.json({ error: error.message }, 400);
  }
});

export default app;
```

> **Note:** For Node.js-specific stream handling (Express, Fastify, etc.), see [Node.js Stream Conversion](./platform-usage/nodejs/stream-conversion.md).

> **Complete Example:** See the [Hono Secure API Example](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/hono-secure-api) for a production-ready implementation with comprehensive security measures and tests.

## Choosing the Right Pool Size

### Guidelines by Environment

**CPU-Bound Workloads (CSV Parsing):**

```typescript
import os from 'node:os';

// Conservative: Leave some CPU for other tasks
const maxWorkers = Math.max(1, Math.floor(os.cpus().length * 0.75));

// Aggressive: Use all available cores
const maxWorkers = os.cpus().length;

const pool = new ReusableWorkerPool({ maxWorkers });
```

**Memory-Constrained Environments:**

```typescript
// Limit based on available memory
// Estimate: ~50MB per worker for moderate CSV files
const availableMemoryMB = 1024; // 1GB
const estimatedMemoryPerWorker = 50;
const maxWorkers = Math.floor(availableMemoryMB / estimatedMemoryPerWorker);

const pool = new ReusableWorkerPool({
  maxWorkers: Math.min(maxWorkers, 4) // Cap at 4
});
```

**Container Environments (Docker/Kubernetes):**

```typescript
// Read from environment variable
const maxWorkers = process.env.CSV_WORKER_POOL_SIZE
  ? parseInt(process.env.CSV_WORKER_POOL_SIZE, 10)
  : 2; // Default to 2 in containers

const pool = new ReusableWorkerPool({ maxWorkers });
```

### Benchmarking Your Configuration

```typescript
import { performance } from 'node:perf_hooks';
import { parseString } from 'web-csv-toolbox';

async function benchmarkPoolSize(csv: string, poolSize: number) {
  using pool = new ReusableWorkerPool({ maxWorkers: poolSize });

  const start = performance.now();

  // Parse 10 files concurrently
  await Promise.all(
    Array(10).fill(csv).map(async (c) => {
      const records = [];
      for await (const record of parseString(c, {
        engine: { worker: true, workerPool: pool }
      })) {
        records.push(record);
      }
      return records;
    })
  );

  const duration = performance.now() - start;
  console.log(`Pool size ${poolSize}: ${duration.toFixed(2)}ms`);

  return duration;
}

// Test different pool sizes
const csv = generateLargeCSV(); // Your test data
for (const size of [1, 2, 4, 8]) {
  await benchmarkPoolSize(csv, size);
}
```

## Backpressure and Rate Limiting

### Early Request Rejection

**Why:** Prevents queue buildup and provides immediate feedback.

```typescript
import { Hono } from 'hono';
import { csvWorkerPool } from './worker-pool';

const app = new Hono();

app.post('/upload-csv', async (c) => {
  // Check pool capacity BEFORE accepting request
  if (csvWorkerPool.isFull()) {
    console.warn('Worker pool saturated, rejecting request');

    return c.json({
      error: 'Service temporarily unavailable',
      retryAfter: 5  // Suggest retry delay in seconds
    }, 503);
  }

  // Process request...
});
```

### Client-Side Retry Logic

```typescript
// Client-side example
async function uploadCSVWithRetry(
  file: File,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch('/upload-csv', {
      method: 'POST',
      body: file
    });

    if (response.status === 503) {
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Service busy, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }

    return response;
  }

  throw new Error('Service unavailable after retries');
}
```

### Request Queuing (Advanced)

**When pool saturation is temporary:**

```typescript
import { Hono } from 'hono';
import { parseRequest, EnginePresets } from 'web-csv-toolbox';
import { csvWorkerPool } from './worker-pool';

const app = new Hono();

// Simple in-memory queue (use Redis/RabbitMQ for production)
const requestQueue: Array<() => Promise<void>> = [];
let processing = false;

async function processQueue() {
  if (processing || requestQueue.length === 0) return;

  processing = true;

  while (requestQueue.length > 0 && !csvWorkerPool.isFull()) {
    const handler = requestQueue.shift();
    if (handler) {
      handler().catch(console.error);
    }
  }

  processing = false;

  // Check again after a delay
  if (requestQueue.length > 0) {
    setTimeout(processQueue, 100);
  }
}

app.post('/upload-csv', async (c) => {
  if (csvWorkerPool.isFull()) {
    // Queue the request instead of rejecting
    if (requestQueue.length >= 10) {
      return c.json({ error: 'Queue full' }, 503);
    }

    const promise = new Promise<void>((resolve, reject) => {
      requestQueue.push(async () => {
        try {
          // Process CSV...
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });

    processQueue(); // Trigger queue processing

    await promise;
    return c.json({ success: true, queued: true });
  }

  // Process immediately...
});
```

## Error Handling and Resilience

### Handle Worker Failures

```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';
import { csvWorkerPool } from './worker-pool';

async function parseWithErrorHandling(csv: string) {
  try {
    const records = [];

    for await (const record of parseString(csv, {
      engine: EnginePresets.balanced({ workerPool: csvWorkerPool })
    })) {
      records.push(record);
    }

    return { success: true, records };
  } catch (error) {
    // Worker errors
    if (error.message.includes('Worker')) {
      console.error('Worker failed:', error);

      // Optional: Recreate pool on worker failure
      // csvWorkerPool.terminate();
      // csvWorkerPool = new ReusableWorkerPool({ maxWorkers: 4 });

      return { success: false, error: 'Worker failure' };
    }

    // CSV format errors
    if (error.name === 'ParseError') {
      console.error('Invalid CSV:', error);
      return { success: false, error: 'Invalid CSV format' };
    }

    // Other errors
    console.error('Unexpected error:', error);
    return { success: false, error: 'Processing failed' };
  }
}
```

### Timeout Protection

```typescript
async function parseWithTimeout(csv: string, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const records = [];

    for await (const record of parseString(csv, {
      engine: EnginePresets.balanced({ workerPool: csvWorkerPool }),
      signal: controller.signal
    })) {
      records.push(record);
    }

    clearTimeout(timeoutId);
    return { success: true, records };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      console.error('Parsing timeout');
      return { success: false, error: 'Timeout' };
    }

    throw error;
  }
}
```

## Monitoring and Observability

### Pool Metrics

```typescript
import { csvWorkerPool } from './worker-pool';

// Expose metrics endpoint
app.get('/metrics/worker-pool', (c) => {
  return c.json({
    activeWorkers: csvWorkerPool.size,
    isFull: csvWorkerPool.isFull(),
    timestamp: new Date().toISOString()
  });
});

// Periodic logging
setInterval(() => {
  console.log('Worker pool status:', {
    active: csvWorkerPool.size,
    full: csvWorkerPool.isFull()
  });
}, 60000); // Every minute
```

### Request Tracking

```typescript
let activeRequests = 0;
let totalRequests = 0;
let rejectedRequests = 0;

app.post('/upload-csv', async (c) => {
  totalRequests++;

  if (csvWorkerPool.isFull()) {
    rejectedRequests++;
    console.warn(`Request rejected (${rejectedRequests}/${totalRequests})`);
    return c.json({ error: 'Service busy' }, 503);
  }

  activeRequests++;

  try {
    // Process CSV...
    return c.json({ success: true });
  } finally {
    activeRequests--;
  }
});

// Expose metrics
app.get('/metrics', (c) => {
  return c.json({
    total: totalRequests,
    active: activeRequests,
    rejected: rejectedRequests,
    rejectionRate: (rejectedRequests / totalRequests * 100).toFixed(2) + '%'
  });
});
```

### Integration with Monitoring Tools

**Prometheus Example:**

```typescript
import { register, Counter, Gauge } from 'prom-client';

const csvRequestsTotal = new Counter({
  name: 'csv_requests_total',
  help: 'Total CSV parsing requests',
  labelNames: ['status']
});

const csvWorkerPoolSize = new Gauge({
  name: 'csv_worker_pool_size',
  help: 'Current worker pool size'
});

// Update metrics
app.post('/upload-csv', async (c) => {
  if (csvWorkerPool.isFull()) {
    csvRequestsTotal.inc({ status: 'rejected' });
    return c.json({ error: 'Service busy' }, 503);
  }

  csvRequestsTotal.inc({ status: 'accepted' });
  csvWorkerPoolSize.set(csvWorkerPool.size);

  // Process...
});

// Metrics endpoint
app.get('/metrics', async (c) => {
  c.header('Content-Type', register.contentType);
  return c.body(await register.metrics());
});
```

## Advanced Patterns

### Multiple Worker Pools

**Use different pools for different workloads:**

```typescript
// Small files: dedicated pool
const smallFilePool = new ReusableWorkerPool({ maxWorkers: 2 });

// Large files: dedicated pool with more workers
const largeFilePool = new ReusableWorkerPool({ maxWorkers: 6 });

app.post('/upload-csv', async (c) => {
  const contentLength = parseInt(c.req.header('Content-Length') || '0');

  // Choose pool based on file size
  const pool = contentLength > 10 * 1024 * 1024  // 10MB
    ? largeFilePool
    : smallFilePool;

  if (pool.isFull()) {
    return c.json({ error: 'Service busy' }, 503);
  }

  // Process with appropriate pool...
});
```

### Priority Queuing

```typescript
interface QueuedRequest {
  priority: 'high' | 'normal' | 'low';
  handler: () => Promise<void>;
}

const priorityQueue: QueuedRequest[] = [];

async function processQueueByPriority() {
  // Sort by priority
  priorityQueue.sort((a, b) => {
    const priorities = { high: 0, normal: 1, low: 2 };
    return priorities[a.priority] - priorities[b.priority];
  });

  while (priorityQueue.length > 0 && !csvWorkerPool.isFull()) {
    const request = priorityQueue.shift();
    if (request) {
      request.handler().catch(console.error);
    }
  }
}
```

### Dynamic Pool Sizing

```typescript
class AdaptiveWorkerPool {
  private pool: ReusableWorkerPool;
  private minWorkers = 1;
  private maxWorkers = 8;
  private currentSize = 2;

  constructor() {
    this.pool = new ReusableWorkerPool({ maxWorkers: this.currentSize });
  }

  adjustPoolSize(load: number) {
    // Scale up if load is high
    if (load > 0.8 && this.currentSize < this.maxWorkers) {
      this.currentSize = Math.min(this.currentSize + 1, this.maxWorkers);
      this.pool.terminate();
      this.pool = new ReusableWorkerPool({ maxWorkers: this.currentSize });
      console.log(`Scaled up to ${this.currentSize} workers`);
    }

    // Scale down if load is low
    if (load < 0.2 && this.currentSize > this.minWorkers) {
      this.currentSize = Math.max(this.currentSize - 1, this.minWorkers);
      this.pool.terminate();
      this.pool = new ReusableWorkerPool({ maxWorkers: this.currentSize });
      console.log(`Scaled down to ${this.currentSize} workers`);
    }
  }
}
```

## Best Practices

### ✅ Do

- **Create pool once at startup** and reuse across requests
- **Use `using` syntax** for automatic cleanup in scoped contexts
- **Check `isFull()` before accepting requests** to prevent queue buildup
- **Set appropriate `maxWorkers`** based on your CPU cores and memory
- **Monitor pool metrics** to detect saturation
- **Implement retry logic** on the client side for 503 errors
- **Handle worker errors gracefully** with proper error boundaries
- **Use timeouts** with `AbortSignal` for long-running operations
- **Clean up on shutdown** with proper signal handling

### ❌ Don't

- **Don't create pools per request** - causes resource exhaustion
- **Don't ignore `isFull()` checks** - leads to queue buildup
- **Don't set `maxWorkers` too high** - causes memory/CPU exhaustion
- **Don't forget cleanup** - workers prevent process exit
- **Don't queue unlimited requests** - implement queue size limits
- **Don't use blocking operations** inside CSV processing
- **Don't parse very large files in memory** - use streaming instead

## Troubleshooting

### Issue: Process Won't Exit

**Symptoms:** Node.js process hangs after completion

**Solution:**
```typescript
// Ensure pool is terminated
process.on('SIGTERM', () => {
  csvWorkerPool.terminate();
  process.exit(0);
});

process.on('SIGINT', () => {
  csvWorkerPool.terminate();
  process.exit(0);
});
```

### Issue: High Memory Usage

**Symptoms:** Memory grows continuously

**Solutions:**
1. Reduce `maxWorkers`
2. Process files as streams instead of loading into memory
3. Implement memory limits per worker
4. Monitor and restart workers periodically

### Issue: Frequent 503 Errors

**Symptoms:** Many requests rejected

**Solutions:**
1. Increase `maxWorkers` if CPU allows
2. Implement request queuing
3. Add more server instances (horizontal scaling)
4. Optimize CSV processing (use WASM, reduce validation)

### Issue: Workers Crash Unexpectedly

**Symptoms:** Intermittent worker failures

**Solutions:**
1. Add error boundaries around worker operations
2. Implement worker restart logic
3. Check for resource limits (memory, file descriptors)
4. Review CSV validation logic for edge cases

## Related Documentation

- **[Working with Workers Tutorial](../tutorials/working-with-workers.md)** - Beginner guide
- **[Worker Pool Architecture](../explanation/worker-pool-architecture.md)** - Design rationale
- **[Secure CSV Processing](./secure-csv-processing.md)** - Security best practices
- **[Engine Presets Reference](../reference/engine-presets.md)** - Execution strategies
- **[API Reference](https://kamiazya.github.io/web-csv-toolbox/)** - Complete type definitions
