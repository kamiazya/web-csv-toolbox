---
title: Security Model
group: Explanation
---

# Security Model

This document explains the security architecture of web-csv-toolbox and the reasoning behind its design decisions.

## Threat Landscape

When building applications that process user-uploaded CSV files, you face several security threats:

### 1. Resource Exhaustion Attacks (DoS)

**Attack Scenario:**
An attacker uploads multiple large CSV files simultaneously to overwhelm your server.

```
Attacker → 100 concurrent requests × 100MB CSV each
         ↓
Server   → Spawns 100 workers
         → Consumes 10GB+ memory
         → CPU exhaustion
         ↓
Result   → Application crashes or becomes unresponsive
```

**Impact:**
- Service unavailability
- Degraded performance for legitimate users
- Potential cascading failures in backend systems

### 2. Memory Exhaustion

**Attack Scenario:**
An attacker uploads a CSV with extremely long fields or an enormous number of records.

**Impact:**
- Out of memory errors
- Application crashes
- System instability

### 3. CPU Exhaustion

**Attack Scenario:**
An attacker uploads maliciously crafted CSV files that are computationally expensive to parse (e.g., deeply nested quotes, complex escaping).

**Impact:**
- High CPU usage
- Slow response times
- Service degradation

### 4. Compression Bombs

**Attack Scenario:**
An attacker uploads a small compressed file that expands to enormous size when decompressed.

**Example:**
```
Input:  small.csv.gz (100KB)
Output: 10GB uncompressed data
```

**Impact:**
- Disk space exhaustion
- Memory exhaustion
- Processing timeout

---

## Defense Strategy

web-csv-toolbox implements a **defense-in-depth** approach with multiple security layers.

### Layer 1: Built-in Resource Limits

The library provides built-in limits that protect against basic attacks:

#### `maxBufferSize`

**Default:** 10M characters (10 × 1024 × 1024)

**Purpose:** Prevents memory exhaustion from unbounded input accumulation.

**How It Works:**
```typescript
// Internal buffer management
if (buffer.length > maxBufferSize) {
  throw new RangeError('Buffer size exceeded maximum limit');
}
```

**Why 10M:**
- Large enough for most legitimate use cases
- Small enough to prevent memory issues (typically ~20MB RAM per buffer)
- Can be adjusted based on your requirements

#### `maxFieldCount`

**Default:** 100,000 fields per record

**Purpose:** Prevents attacks that create records with millions of columns.

**How It Works:**
```typescript
// Field counting during parsing
if (fieldCount > maxFieldCount) {
  throw new RangeError('Field count exceeded maximum limit');
}
```

**Why 100k:**
- Far exceeds typical CSV use cases (most have < 100 columns)
- Prevents excessive memory allocation for field arrays
- Stops before performance degrades

#### `maxBinarySize`

**Default:** 100MB (100 × 1024 × 1024 bytes)

**Purpose:** Prevents processing of excessively large binary inputs.

**How It Works:**
```typescript
// Size check before processing
if (buffer.byteLength > maxBinarySize) {
  throw new RangeError('Binary size exceeded maximum limit');
}
```

**Why 100MB:**
- Sufficient for most file uploads
- Prevents memory issues from huge files
- Forces streaming for larger files

---

### Layer 2: WorkerPool Resource Management

**The Problem:**
Without resource management, each CSV processing request could spawn a new worker, leading to:
```
Request 1 → Worker 1 (uses CPU + memory)
Request 2 → Worker 2 (uses CPU + memory)
Request 3 → Worker 3 (uses CPU + memory)
...
Request 100 → Worker 100 (💥 system overwhelmed)
```

**The Solution: WorkerPool**

```typescript
const pool = new ReusableWorkerPool({ maxWorkers: 4 });
```

**How It Works:**

1. **Pool Initialization:**
   ```
   Pool: [Empty] maxWorkers=4
   ```

2. **Request Arrives:**
   ```
   Request 1 → Pool creates Worker 1
   Pool: [Worker 1] (1/4 workers)
   ```

3. **Multiple Requests:**
   ```
   Request 2 → Pool creates Worker 2
   Request 3 → Pool creates Worker 3
   Request 4 → Pool creates Worker 4
   Pool: [Worker 1, Worker 2, Worker 3, Worker 4] (4/4 workers)
   ```

4. **Pool Full:**
   ```
   Request 5 → Pool is full (4/4 workers)
             → Request reuses existing worker (round-robin)
             → OR rejected early (see Layer 3)
   ```

**Key Benefits:**

✅ **Bounded Resource Usage:**
```
4 workers × ~50MB each = ~200MB maximum
```
Instead of unbounded growth.

✅ **Worker Reuse:**
Workers are shared across requests, reducing initialization overhead.

✅ **Predictable Performance:**
System performance remains consistent regardless of request volume.

#### Design Decision: Why Pooling?

**Alternative 1: One Worker Per Request**
```typescript
// ❌ Dangerous
for each request {
  const worker = new Worker();  // Unbounded growth
  await parse(csv, { worker });
  worker.terminate();
}
```

**Problems:**
- Unlimited resource consumption
- Vulnerable to DoS
- High initialization overhead

**Alternative 2: Single Shared Worker**
```typescript
// ❌ Bottleneck
const worker = new Worker();
for each request {
  await parse(csv, { worker });  // Sequential processing
}
```

**Problems:**
- No parallelism
- Head-of-line blocking
- Single point of failure

**Our Solution: WorkerPool (Goldilocks Approach)**
```typescript
// ✅ Balanced
const pool = new ReusableWorkerPool({ maxWorkers: 4 });
for each request {
  await parse(csv, { workerPool: pool });
}
```

**Advantages:**
- Bounded resource usage (max 4 workers)
- Parallel processing (up to 4 concurrent)
- Worker reuse (amortized initialization)
- Resilient to failures (workers are independent)

---

### Layer 3: Early Request Rejection

**The Problem:**
Even with WorkerPool limits, accepting requests when the pool is saturated causes:
- Request queuing
- Timeout errors
- Poor user experience
- Wasted resources

**The Solution: `isFull()` Check**

```typescript
if (pool.isFull()) {
  return c.json({ error: 'Service busy' }, 503);
}
```

**How It Works:**

```typescript
class WorkerPool {
  isFull(): boolean {
    // Counts both active workers and pending worker creations
    const totalWorkers = this.workers.length + this.pendingWorkerCreations.size;
    return totalWorkers >= this.maxWorkers;
  }
}
```

**Why This Matters:**

**Without Early Rejection:**
```
Time: 0s
Request 1-4 → Processing (pool full)
Request 5   → Queued, waits 30s → Timeout (poor UX)

User Experience: 30s wait → 408 Timeout Error
```

**With Early Rejection:**
```
Time: 0s
Request 1-4 → Processing (pool full)
Request 5   → Immediate 503 response

User Experience: Instant feedback → Retry with backoff
```

**Benefits:**

✅ **Immediate Feedback:**
Clients receive instant 503 response instead of waiting for timeout.

✅ **Resource Protection:**
Prevents queuing of requests that will fail anyway.

✅ **Better UX:**
Enables clients to implement intelligent retry logic:
```typescript
// Client-side retry with exponential backoff
async function uploadCSV(file, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const response = await fetch('/validate-csv', {
      method: 'POST',
      body: file
    });

    if (response.status === 503) {
      // Server busy, wait and retry
      await sleep(1000 * Math.pow(2, i));  // Exponential backoff
      continue;
    }

    return response;
  }
  throw new Error('Service unavailable after retries');
}
```

✅ **Load Shedding:**
Protects backend services from cascading failures.

#### Design Decision: Why Early Rejection?

**Alternative: Request Queuing**
```typescript
// ❌ Queue requests when pool is full
if (pool.isFull()) {
  await queueRequest(request);  // Wait for worker to become available
}
```

**Problems:**
- Unbounded queue growth
- Memory exhaustion from queued requests
- Timeout errors for queued requests
- No feedback to client

**Our Solution: Fail Fast**
```typescript
// ✅ Reject immediately
if (pool.isFull()) {
  return 503;  // Instant feedback
}
```

**Advantages:**
- Bounded memory usage (no queue)
- Instant client feedback
- Enables client-side retry logic
- Prevents resource exhaustion

---

### Layer 4: Input Validation

Multiple validation layers protect against malicious input:

#### Content-Type Verification

```typescript
const contentType = c.req.header('Content-Type');
if (!contentType?.startsWith('text/csv')) {
  return c.json({ error: 'Content-Type must be text/csv' }, 415);
}
```

**Why:**
- Prevents processing of non-CSV data
- `startsWith()` ensures the media type is at the beginning (e.g., `text/csv; charset=utf-8` is valid, but `application/json; text/csv` is not)
- Early rejection of invalid requests
- Reduces attack surface

#### Content-Length Check

```typescript
const contentLength = c.req.header('Content-Length');
if (contentLength && Number.parseInt(contentLength) > MAX_SIZE) {
  return c.json({ error: 'Request too large' }, 413);
}
```

**Why:**
- Rejects large files before reading body
- Protects against bandwidth exhaustion
- Fast rejection (no data transfer)

#### Stream-Based Size Limiting

```typescript
class SizeLimitStream extends TransformStream {
  constructor(maxBytes) {
    let bytesRead = 0;
    super({
      transform(chunk, controller) {
        bytesRead += chunk.length;
        if (bytesRead > maxBytes) {
          controller.error(new Error('Size limit exceeded'));
        } else {
          controller.enqueue(chunk);
        }
      }
    });
  }
}
```

**Why:**
- Protects against compression bombs
- Stops processing immediately when limit exceeded
- Works with streaming (constant memory)

---

### Layer 5: Timeout Protection

```typescript
const signal = AbortSignal.timeout(30000);  // 30 seconds

for await (const record of parseStringStream(csvStream, {
  signal,
  // ...
})) {
  // Processing
}
```

**How It Works:**

```typescript
// Internal signal handling
if (signal.aborted) {
  throw new DOMException('Operation timed out', 'AbortError');
}
```

**Why Timeouts Matter:**

**Without Timeout:**
```
Malicious CSV → Complex escaping → 10 minutes to parse
                ↓
Server resources tied up for 10 minutes
                ↓
DoS achieved
```

**With Timeout:**
```
Malicious CSV → Complex escaping → 30 seconds
                ↓
AbortError thrown
                ↓
Resources freed immediately
```

**Benefits:**

✅ **Predictable Resource Usage:**
No request can consume resources indefinitely.

✅ **DoS Prevention:**
Limits impact of CPU-intensive attack payloads.

✅ **Better UX:**
Clients receive timely error responses.

---

### Layer 6: Data Validation

After parsing, validate data with schema validation:

```typescript
import { z } from 'zod';

const recordSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.coerce.number().int().min(0).max(150),
});

for await (const record of parse(csv)) {
  try {
    const validated = recordSchema.parse(record);
    // Use validated data
  } catch (error) {
    // Handle validation error
  }
}
```

**Why:**
- Prevents injection attacks via malicious data
- Ensures data integrity
- Type safety for downstream processing
- Early detection of malformed data

---

## Complete Security Architecture

Putting it all together:

```
┌─────────────────────────────────────────────────────────┐
│ Client Request                                           │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Early Rejection (pool.isFull())                │
│ Status: 503 if saturated                                │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Content-Type Verification                      │
│ Status: 415 if not text/csv                            │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Content-Length Check                           │
│ Status: 413 if too large                                │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Stream Processing with Timeout                 │
│ - WorkerPool manages workers (max 4)                    │
│ - AbortSignal enforces timeout (30s)                    │
│ - maxBufferSize limits memory (10M chars)               │
│ - maxFieldCount limits fields (100k)                    │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 5: Data Validation (Zod schema)                   │
│ - Validates each record                                 │
│ - Reports errors via SSE                                │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Success Response (SSE)                                   │
│ - Validation errors sent in real-time                   │
│ - Summary sent at end                                   │
└─────────────────────────────────────────────────────────┘
```

---

## Security Principles

### 1. Defense in Depth

Multiple layers ensure that if one layer fails, others provide protection.

### 2. Fail Fast

Reject invalid requests as early as possible to minimize resource consumption.

### 3. Resource Bounds

All resources (memory, CPU, workers) have explicit upper bounds.

### 4. Graceful Degradation

When limits are reached, provide clear error messages instead of crashing.

### 5. Least Privilege

Workers run in isolated contexts with minimal privileges.

---

## Related Documentation

- **[How-To: Secure CSV Processing](../how-to-guides/secure-csv-processing.md)** - Implementation guide
- **[Engine Presets](../reference/engine-presets.md)** - Recommended presets

For advanced configuration options, refer to the [`EngineConfig`](https://kamiazya.github.io/web-csv-toolbox/interfaces/EngineConfig.html) type documentation in your IDE or the [API Reference](https://kamiazya.github.io/web-csv-toolbox/).
