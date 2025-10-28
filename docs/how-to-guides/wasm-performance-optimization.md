# WASM Performance Optimization

This guide shows you how to maximize CSV parsing performance using WebAssembly in web-csv-toolbox.

## Prerequisites

- Completed [Using WebAssembly](../tutorials/using-webassembly.md) tutorial
- Basic understanding of performance optimization
- Familiarity with browser DevTools or Node.js profiling

## Understanding Performance Bottlenecks

Before optimizing, understand where time is spent:

```
┌────────────────────────────────────────────────────────────┐
│ Total Parsing Time                                          │
└────────────────────────────────────────────────────────────┘
  │
  ├─ WASM Initialization (one-time)        ~10-50ms
  │
  ├─ Data Transfer (Main → WASM)           ~1-5% of total
  │
  ├─ CSV Parsing (in WASM)                 ~80-90% of total
  │
  ├─ Result Transfer (WASM → Main)         ~1-5% of total
  │
  └─ Record Processing (JavaScript)        ~5-10% of total
```

**Key insight:** Parsing dominates, so optimizing WASM usage has the biggest impact.

---

## Optimization 1: Initialize WASM Once

### ❌ Bad: Initialize Before Each Parse

```typescript
import { loadWASM, parse } from 'web-csv-toolbox';

async function parseCSV(csv: string) {
  await loadWASM(); // ❌ Slow! Loads WASM every time

  for await (const record of parse(csv, {
    engine: { wasm: true }
  })) {
    console.log(record);
  }
}

// Called multiple times
await parseCSV(csv1); // Loads WASM ~50ms
await parseCSV(csv2); // Loads WASM ~50ms
await parseCSV(csv3); // Loads WASM ~50ms
```

**Performance impact:** Initialization overhead for each parse

---

### ✅ Good: Initialize Once at Startup

```typescript
import { loadWASM, parse } from 'web-csv-toolbox';

// Load once at application startup
await loadWASM();

async function parseCSV(csv: string) {
  for await (const record of parse(csv, {
    engine: { wasm: true }
  })) {
    console.log(record);
  }
}

// Called multiple times
await parseCSV(csv1); // Fast (WASM cached)
await parseCSV(csv2); // Fast (WASM cached)
await parseCSV(csv3); // Fast (WASM cached)
```

**Performance improvement:** Eliminates repeated initialization overhead

---

## Optimization 2: Use Engine Presets

### ❌ Bad: Manual Configuration

```typescript
for await (const record of parse(csv, {
  engine: {
    worker: true,
    wasm: true,
    workerStrategy: 'stream-transfer'
  }
})) {
  console.log(record);
}
```

**Problems:**
- Verbose
- Easy to misconfigure
- May not use optimal settings

---

### ✅ Good: Use Presets

```typescript
import { parse, EnginePresets } from 'web-csv-toolbox';

for await (const record of parse(csv, {
  engine: EnginePresets.fastest
})) {
  console.log(record);
}
```

**Benefits:**
- Optimal configuration
- Automatic fallback
- Less code

---

## Optimization 3: Combine Worker + WASM

### ❌ Bad: WASM on Main Thread

```typescript
for await (const record of parse(csv, {
  engine: { wasm: true } // Blocks main thread
})) {
  console.log(record);
  // UI frozen during parsing
}
```

**Problems:**
- Blocks main thread
- UI freezes
- Poor user experience

---

### ✅ Good: Worker + WASM

```typescript
for await (const record of parse(csv, {
  engine: EnginePresets.fastest() // Worker + WASM
})) {
  console.log(record);
  // UI stays responsive
}
```

**Benefits:**
- ✅ Non-blocking UI
- ✅ Maximum performance
- ✅ Best user experience

---

## Optimization 4: Batch Processing

### ❌ Bad: Process Records One by One

```typescript
for await (const record of parse(csv, {
  engine: EnginePresets.fastest
})) {
  await processRecord(record); // Async operation
  // Wait for each record to complete
}
```

**Problem:** Sequential processing is slow

---

### ✅ Good: Batch Records

```typescript
const BATCH_SIZE = 1000;
let batch: any[] = [];

for await (const record of parse(csv, {
  engine: EnginePresets.fastest
})) {
  batch.push(record);

  if (batch.length >= BATCH_SIZE) {
    await processBatch(batch); // Process 1000 records at once
    batch = [];
  }
}

// Process remaining records
if (batch.length > 0) {
  await processBatch(batch);
}
```

**Performance improvement:** Significantly faster for I/O-bound operations (database writes, API calls, etc.)

---

## Optimization 5: Worker Pool for Concurrent Files

### ❌ Bad: No Worker Pool

```typescript
const files = ['data1.csv', 'data2.csv', 'data3.csv', 'data4.csv'];

for (const file of files) {
  const csv = await fetch(file).then(r => r.text());

  for await (const record of parse(csv, {
    engine: { worker: true, wasm: true }
  })) {
    console.log(record);
  }
}
```

**Problems:**
- Creates new worker for each file
- No worker reuse
- Unbounded resource usage

---

### ✅ Good: Use Worker Pool

```typescript
import { WorkerPool, parse } from 'web-csv-toolbox';

// Limit concurrent workers
using pool = new WorkerPool({ maxWorkers: 4 });

const files = ['data1.csv', 'data2.csv', 'data3.csv', 'data4.csv'];

await Promise.all(
  files.map(async (file) => {
    const csv = await fetch(file).then(r => r.text());

    for await (const record of parse(csv, {
      engine: {
        worker: true,
        wasm: true,
        workerPool: pool
      }
    })) {
      console.log(record);
    }
  })
);

// Pool automatically cleaned up
```

**Benefits:**
- ✅ Worker reuse (eliminates initialization overhead)
- ✅ Bounded resource usage
- ✅ Concurrent processing

---

## Optimization 6: Minimize Memory Allocations

### ❌ Bad: Create New Objects

```typescript
for await (const record of parse(csv, {
  engine: EnginePresets.fastest
})) {
  // ❌ Creates new object for each record
  const transformed = {
    ...record,
    fullName: `${record.firstName} ${record.lastName}`,
    age: Number(record.age)
  };

  results.push(transformed);
}
```

**Problem:** Excessive object allocation

---

### ✅ Good: Reuse Objects

```typescript
const results: any[] = [];

for await (const record of parse(csv, {
  engine: EnginePresets.fastest
})) {
  // ✅ Modify record in-place
  (record as any).fullName = `${record.firstName} ${record.lastName}`;
  (record as any).age = Number(record.age);

  results.push(record);
}
```

**Performance improvement:** Reduces memory allocation and GC pressure

---

## Optimization 7: Use Appropriate maxBufferSize

### ❌ Bad: Default for All Cases

```typescript
// Default: 10MB
for await (const record of parse(csv, {
  engine: EnginePresets.fastest
})) {
  console.log(record);
}
```

**Problems:**
- May be too small for legitimate large fields
- May be too large for memory-constrained environments

---

### ✅ Good: Tune for Your Use Case

```typescript
// Small fields (typical CSV)
for await (const record of parse(csv, {
  engine: EnginePresets.fastest(),
  maxBufferSize: 1024 * 1024 // 1MB
})) {
  console.log(record);
}
```

```typescript
// Large fields (e.g., embedded JSON, long text)
for await (const record of parse(csv, {
  engine: EnginePresets.fastest(),
  maxBufferSize: 50 * 1024 * 1024 // 50MB
})) {
  console.log(record);
}
```

**Benefits:**
- Lower memory usage
- Earlier error detection
- Better security

---

## Optimization 8: Stream Processing

### ❌ Bad: Load Entire Result into Memory

```typescript
const records = [];

for await (const record of parse(csv, {
  engine: EnginePresets.fastest
})) {
  records.push(record);
}

// Process all at once
processAllRecords(records); // High memory usage
```

**Problem:** High memory usage for large files

---

### ✅ Good: Stream Processing

```typescript
for await (const record of parse(csv, {
  engine: EnginePresets.fastest
})) {
  // Process immediately
  await processRecord(record);
  // Record can be garbage collected
}
```

**Benefits:**
- Constant memory usage
- Works with arbitrarily large files

---

## Optimization 9: Parallel Processing with Multiple Workers

### ❌ Bad: Single Worker for Large File

```typescript
for await (const record of parse(largeCSV, {
  engine: EnginePresets.fastest() // Single worker
})) {
  console.log(record);
}
```

**Problem:** Single worker can't utilize all CPU cores

---

### ✅ Good: Split and Process in Parallel

```typescript
import { WorkerPool, parse } from 'web-csv-toolbox';

using pool = new WorkerPool({ maxWorkers: 4 });

// Split CSV into chunks (by line boundaries)
const chunks = splitCSVIntoChunks(largeCSV, 4);

await Promise.all(
  chunks.map(async (chunk) => {
    for await (const record of parse(chunk, {
      engine: {
        worker: true,
        wasm: true,
        workerPool: pool
      }
    })) {
      console.log(record);
    }
  })
);
```

**Performance improvement:** Better CPU utilization on multi-core systems

**Note:** Ensure chunks start at record boundaries (include header in each chunk or use pre-defined headers).

---

## Optimization 10: Avoid Unnecessary Validation

### ❌ Bad: Validate Every Record

```typescript
import { z } from 'zod';

const schema = z.object({
  name: z.string(),
  age: z.coerce.number(),
  email: z.string().email()
});

for await (const record of parse(csv, {
  engine: EnginePresets.fastest
})) {
  // ❌ Expensive validation on every record
  const validated = schema.parse(record);
  console.log(validated);
}
```

**Problem:** Validation overhead can dominate

---

### ✅ Good: Validate Selectively

```typescript
import { z } from 'zod';

const schema = z.object({
  name: z.string(),
  age: z.coerce.number(),
  email: z.string().email()
});

for await (const record of parse(csv, {
  engine: EnginePresets.fastest
})) {
  // ✅ Quick check first
  if (record.age && Number(record.age) > 0) {
    // Only validate suspicious records
    const validated = schema.parse(record);
    console.log(validated);
  } else {
    console.log(record);
  }
}
```

**Performance improvement:** Reduced validation overhead for valid records

---

## Performance Benchmarking

### Measuring Performance

```typescript
import { performance } from 'perf_hooks'; // Node.js
import { loadWASM, parse, EnginePresets } from 'web-csv-toolbox';

await loadWASM();

async function benchmark(csv: string, label: string) {
  const start = performance.now();
  let count = 0;

  for await (const record of parse(csv, {
    engine: EnginePresets.fastest
  })) {
    count++;
  }

  const end = performance.now();
  const duration = end - start;
  const recordsPerSecond = (count / duration) * 1000;

  console.log(`${label}:`);
  console.log(`  Time: ${duration.toFixed(2)}ms`);
  console.log(`  Records: ${count}`);
  console.log(`  Speed: ${recordsPerSecond.toFixed(0)} records/sec`);
}

await benchmark(csv, 'WASM Performance');
```

---

### Comparing Implementations

```typescript
// Benchmark JavaScript
for await (const record of parse(csv, {
  engine: { wasm: false }
})) {
  count++;
}

// Benchmark WASM
for await (const record of parse(csv, {
  engine: { wasm: true }
})) {
  count++;
}

// Benchmark Worker + WASM
for await (const record of parse(csv, {
  engine: EnginePresets.fastest
})) {
  count++;
}
```

---

## Real-World Example: Optimized CSV Processor

```typescript
import { Hono } from 'hono';
import { loadWASM, parse, WorkerPool, EnginePresets } from 'web-csv-toolbox';
import { z } from 'zod';

const app = new Hono();

// 1. Initialize WASM once
await loadWASM();

// 2. Create worker pool
using pool = new WorkerPool({ maxWorkers: 4 });

// 3. Define validation schema
const recordSchema = z.object({
  name: z.string().min(1).max(100),
  age: z.coerce.number().int().min(0).max(150),
  email: z.string().email(),
});

app.post('/parse-csv', async (c) => {
  const csv = await c.req.text();
  const results: any[] = [];
  const errors: any[] = [];

  // 4. Use fastest engine
  for await (const record of parse(csv, {
    engine: {
      worker: true,
      wasm: true,
      workerPool: pool
    }
  })) {
    try {
      // 5. Validate (with error recovery)
      const validated = recordSchema.parse(record);
      results.push(validated);
    } catch (error) {
      errors.push({ record, error: error.message });
    }
  }

  return c.json({
    success: true,
    data: results,
    errors: errors.length > 0 ? errors : undefined
  });
});

export default app;
```

**Optimizations applied:**
- ✅ WASM initialized once
- ✅ Worker pool for resource management
- ✅ Worker + WASM for maximum performance
- ✅ Streaming processing (constant memory)
- ✅ Error recovery

---

## Performance Checklist

### Before Production

- [ ] Call `loadWASM()` once at startup
- [ ] Use `EnginePresets.fastest()` for UTF-8 CSV
- [ ] Use `WorkerPool` to limit concurrent workers
- [ ] Handle errors gracefully
- [ ] Set appropriate `maxBufferSize`
- [ ] Benchmark with realistic data
- [ ] Profile with DevTools/Node.js profiler
- [ ] Test with large files (>10MB)
- [ ] Test with many concurrent requests
- [ ] Monitor memory usage

---

## Common Performance Pitfalls

### Pitfall 1: Blocking UI

**Problem:** Using WASM on main thread in browser

**Solution:** Use `EnginePresets.fastest()` (Worker + WASM)

---

### Pitfall 2: Memory Leaks

**Problem:** Accumulating all records in memory

**Solution:** Process records as they arrive (streaming)

---

### Pitfall 3: Worker Pool Exhaustion

**Problem:** Not limiting concurrent workers

**Solution:** Use `WorkerPool` with `maxWorkers`

---

### Pitfall 4: Redundant WASM Loading

**Problem:** Loading WASM before each parse

**Solution:** Load once at startup

---

### Pitfall 5: Synchronous Operations

**Problem:** Using `await` inside parsing loop

**Solution:** Batch operations or use parallel processing

---

## Related Documentation

- **[Using WebAssembly](../tutorials/using-webassembly.md)** - Getting started with WASM
- **[WebAssembly Architecture](../explanation/webassembly-architecture.md)** - Understanding WASM internals
- **[WASM API Reference](../reference/api/wasm.md)** - API documentation
- **[Working with Workers](../tutorials/working-with-workers.md)** - Worker threads guide

---

## Summary

To maximize WASM performance:

1. **Initialize once** - Call `loadWASM()` at startup
2. **Use presets** - `EnginePresets.fastest()` for optimal config
3. **Combine strategies** - Worker + WASM for best results
4. **Batch processing** - Process records in batches
5. **Worker pool** - Limit concurrent workers
6. **Stream processing** - Avoid loading all into memory
7. **Tune limits** - Set appropriate `maxBufferSize`
8. **Benchmark** - Measure and optimize based on data
9. **Parallel processing** - Split large files across workers
10. **Minimize overhead** - Avoid unnecessary operations

**Expected improvements:**
- Improved performance through compiled code (WASM)
- Non-blocking UI (Worker + WASM)
- Constant memory usage (streaming)
- Scalable concurrent processing (Worker pool)

**Performance measurements:** See [CodSpeed benchmarks](https://codspeed.io/kamiazya/web-csv-toolbox) for actual measured performance.
