---
title: Secure CSV Processing
group: How-to Guides
---

# How-To: Secure CSV Processing

## Problem

You need to process user-uploaded CSV files in a web application without exposing your system to Denial of Service (DoS) attacks or other security threats.

## Solution Overview

This guide shows you how to implement secure CSV processing using multiple defense layers:

1. **Resource limits** - Prevent resource exhaustion (Worker pool, record count, error count)
2. **Early rejection** - Reject requests when saturated
3. **Input validation** - Verify content type and size
4. **Actual byte counting** - Prevent Content-Length bypass attacks
5. **Data validation** - Validate parsed records with schema
6. **Timeout protection** - Prevent long-running operations
7. **Proper error handling** - Return appropriate HTTP status codes

## Prerequisites

```bash
npm install web-csv-toolbox zod hono
```

## Step 1: Set up WorkerPool with Resource Limits

**Why:** Attackers could upload multiple large CSV files simultaneously to overwhelm your server.

```typescript
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { z } from 'zod';
import { ReusableWorkerPool, EnginePresets, parseStringStream } from 'web-csv-toolbox';

const app = new Hono();

// ✅ CRITICAL: Limit concurrent workers
const pool = new ReusableWorkerPool({ maxWorkers: 4 });

// Clean up on shutdown
app.onShutdown(() => {
  pool.terminate();
});
```

**Guidelines:**
- Web applications: Use `maxWorkers: 2-4`
- Server applications: Use `Math.min(4, os.cpus().length)`

## Step 2: Implement Early Request Rejection

**Why:** Rejecting requests early when the pool is saturated prevents cascading failures.

```typescript
const recordSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.coerce.number().int().min(0).max(150),
});

app.post('/validate-csv', async (c) => {
  // 1. Early rejection if pool is saturated
  if (pool.isFull()) {
    console.warn('WorkerPool saturated - rejecting request');
    return c.json(
      { error: 'Service temporarily unavailable. Please try again later.' },
      503
    );
  }

  // 2. Verify Content-Type
  const contentType = c.req.header('Content-Type');
  if (!contentType?.startsWith('text/csv')) {
    return c.json({ error: 'Content-Type must be text/csv' }, 400);
  }

  // 3. Get request body as stream
  const csvStream = c.req.raw.body?.pipeThrough(new TextDecoderStream());

  if (!csvStream) {
    return c.json({ error: 'Request body is required' }, 400);
  }

  // 4. Process with streaming validation (see next step)
  // ...
});
```

**Benefits:**
- ✅ Immediate feedback to clients (503 instead of timeout)
- ✅ Prevents resource exhaustion
- ✅ Better UX - clients can implement retry logic
- ✅ Protects backend services

## Step 3: Stream Validation with Server-Sent Events

**Why:** Streaming validation prevents memory exhaustion and provides real-time feedback.

```typescript
app.post('/validate-csv', async (c) => {
  // ... (early rejection and validation from Step 2)

  return stream(c, async (stream) => {
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');

    let validCount = 0;
    let errorCount = 0;

    for await (const record of parseStringStream(csvStream, {
      engine: EnginePresets.balanced({ workerPool: pool })
    })) {
      try {
        // Validate each record
        recordSchema.parse(record);
        validCount++;
      } catch (error) {
        errorCount++;
        if (error instanceof z.ZodError) {
          const errorMessage = {
            line: validCount + errorCount,
            errors: error.errors.map(e => ({
              path: e.path.join('.'),
              message: e.message
            }))
          };

          // Send error as SSE event
          await stream.write(`event: error\n`);
          await stream.write(`data: ${JSON.stringify(errorMessage)}\n\n`);

          console.warn('CSV validation error:', errorMessage);
        }
      }
    }

    // Send summary as final SSE event
    await stream.write(`event: summary\n`);
    await stream.write(`data: ${JSON.stringify({ valid: validCount, errors: errorCount })}\n\n`);
  });
});
```

**Why SSE?**
- ✅ Safe: JSON.stringify() handles escaping automatically
- ✅ Real-time: Errors reported as they're found
- ✅ Efficient: No manual JSON construction

## Step 4: Add Comprehensive Security Layers

For production applications, implement defense in depth:

```typescript
// Security configuration
const SECURITY_CONFIG = {
  maxRequestBodySize: 50 * 1024 * 1024,  // 50MB
  maxWorkers: 4,
  parseTimeout: 30000,                    // 30 seconds
  maxBufferSize: 5 * 1024 * 1024,        // 5M characters
  maxFieldCount: 10000,                   // 10k fields/record
  maxRecordCount: 100000,                 // 100k records max
  maxErrorCount: 1000,                    // Stop after 1000 validation errors
};

/**
 * Creates a TransformStream that counts actual bytes received and enforces size limits.
 * This prevents attackers from bypassing Content-Length header checks with chunked encoding
 * or by sending more data than declared.
 */
function createByteLimitStream(maxBytes: number) {
  let bytesRead = 0;

  const stream = new TransformStream({
    transform(chunk, controller) {
      bytesRead += chunk.byteLength;

      if (bytesRead > maxBytes) {
        controller.error(
          new RangeError(`Request body size ${bytesRead} exceeds limit of ${maxBytes} bytes`)
        );
        return;
      }

      controller.enqueue(chunk);
    },
  });

  return {
    stream,
    getBytesRead: () => bytesRead,
  };
}

const pool = new ReusableWorkerPool({ maxWorkers: SECURITY_CONFIG.maxWorkers });

app.post('/validate-csv', async (c) => {
  // 1. Early rejection
  if (pool.isFull()) {
    return c.json({ error: 'Service busy' }, 503);
  }

  // 2. Verify Content-Type
  const contentType = c.req.header('Content-Type');
  if (!contentType?.startsWith('text/csv')) {
    return c.json({ error: 'Content-Type must be text/csv' }, 415);
  }

  // 3. Check Content-Length header (early rejection only - actual bytes will be counted)
  const contentLength = c.req.header('Content-Length');
  if (contentLength && Number.parseInt(contentLength) > SECURITY_CONFIG.maxRequestBodySize) {
    return c.json({ error: 'Request body too large' }, 413);
  }

  // 4. Get request body and add byte counting
  const rawBody = c.req.raw.body;
  if (!rawBody) {
    return c.json({ error: 'Request body is required' }, 400);
  }

  // 5. Create byte-counting stream to track actual received bytes
  // This prevents attackers from bypassing Content-Length checks with chunked encoding
  const byteLimitStream = createByteLimitStream(SECURITY_CONFIG.maxRequestBodySize);
  const csvStream = rawBody.pipeThrough(byteLimitStream.stream);

  // 6. Timeout protection
  const signal = AbortSignal.timeout(SECURITY_CONFIG.parseTimeout);

  try {
    return stream(c, async (stream) => {
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');

      let validCount = 0;
      let errorCount = 0;
      let recordCount = 0;

      try {
        for await (const record of parseUint8ArrayStream(csvStream, {
          signal,
          engine: EnginePresets.balanced({ workerPool: pool }),
          maxBufferSize: SECURITY_CONFIG.maxBufferSize,
          maxFieldCount: SECURITY_CONFIG.maxFieldCount,
        })) {
          recordCount++;

          // Enforce record count limit
          if (recordCount > SECURITY_CONFIG.maxRecordCount) {
            await stream.write(`event: fatal\n`);
            await stream.write(`data: ${JSON.stringify({
              error: 'Record count limit exceeded',
              limit: SECURITY_CONFIG.maxRecordCount,
              bytesRead: byteLimitStream.getBytesRead(),
            })}\n\n`);
            throw new RangeError(`Record count ${recordCount} exceeds limit`);
          }

          // Enforce error count limit
          if (errorCount >= SECURITY_CONFIG.maxErrorCount) {
            await stream.write(`event: fatal\n`);
            await stream.write(`data: ${JSON.stringify({
              error: 'Error count limit exceeded - stopping validation',
              limit: SECURITY_CONFIG.maxErrorCount,
              valid: validCount,
              errors: errorCount,
            })}\n\n`);
            throw new Error('VALIDATION_ERROR_LIMIT');
          }

          try {
            recordSchema.parse(record);
            validCount++;
          } catch (error) {
            errorCount++;
            if (error instanceof z.ZodError) {
              const errorMessage = {
                line: validCount + errorCount,
                errors: error.errors.map(e => ({
                  path: e.path.join('.'),
                  message: e.message
                }))
              };

              await stream.write(`event: error\n`);
              await stream.write(`data: ${JSON.stringify(errorMessage)}\n\n`);

              // Log first 10 errors for monitoring
              if (errorCount <= 10) {
                console.warn('CSV validation error:', errorMessage);
              }
            }
          }
        }

        await stream.write(`event: summary\n`);
        await stream.write(`data: ${JSON.stringify({
          valid: validCount,
          errors: errorCount,
          total: recordCount,
          bytesRead: byteLimitStream.getBytesRead(),
        })}\n\n`);
      } catch (error) {
        // Fatal errors that should close the connection with proper HTTP status
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            await stream.write(`event: fatal\n`);
            await stream.write(`data: ${JSON.stringify({ error: 'Parsing timeout' })}\n\n`);
            throw error;
          }
          if (error.message === 'VALIDATION_ERROR_LIMIT') {
            throw new Error('Too many validation errors');
          }
        }
        if (error instanceof RangeError) {
          throw error;
        }

        // Non-fatal errors: send error event but continue
        await stream.write(`event: error\n`);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await stream.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
      }
    });
  } catch (error) {
    // Return proper HTTP status codes for fatal errors
    if (error instanceof Error && error.name === 'AbortError') {
      return c.json({ error: 'Parsing timeout' }, 408);
    }
    if (error instanceof RangeError) {
      return c.json({
        error: 'CSV exceeds limits',
        details: error.message,
      }, 413);
    }
    if (error instanceof Error && error.message === 'Too many validation errors') {
      return c.json({
        error: 'Too many validation errors',
        limit: SECURITY_CONFIG.maxErrorCount,
      }, 422);
    }
    return c.json({ error: 'Invalid CSV format' }, 400);
  }
});

export default app;
```

## Security Layer Details

### Layer 1: Actual Byte Counting (Content-Length Bypass Prevention)

**Threat:** Attackers can bypass Content-Length header checks by:
- Omitting the Content-Length header (chunked encoding)
- Sending more data than declared in the header
- Keeping the stream open to consume resources

**Defense:** Use a TransformStream to count actual received bytes:

```typescript
function createByteLimitStream(maxBytes: number) {
  let bytesRead = 0;

  const stream = new TransformStream({
    transform(chunk, controller) {
      bytesRead += chunk.byteLength;

      if (bytesRead > maxBytes) {
        controller.error(
          new RangeError(`Request body size ${bytesRead} exceeds limit of ${maxBytes} bytes`)
        );
        return;
      }

      controller.enqueue(chunk);
    },
  });

  return {
    stream,
    getBytesRead: () => bytesRead,
  };
}

// Usage
const byteLimitStream = createByteLimitStream(SECURITY_CONFIG.maxRequestBodySize);
const csvStream = rawBody.pipeThrough(byteLimitStream.stream);
```

**Why it works:**
- ✅ Counts actual bytes received, not header-declared size
- ✅ Works with chunked encoding (no Content-Length header)
- ✅ Terminates stream immediately when limit exceeded
- ✅ Reports actual bytes read in error responses

### Layer 2: Record Count Limits

**Threat:** Attackers send millions of valid records to exhaust CPU/memory over time, even if individual records are small.

**Defense:** Enforce maximum record count:

```typescript
let recordCount = 0;

for await (const record of parseUint8ArrayStream(csvStream, { ... })) {
  recordCount++;

  if (recordCount > SECURITY_CONFIG.maxRecordCount) {
    await stream.write(`event: fatal\n`);
    await stream.write(`data: ${JSON.stringify({
      error: 'Record count limit exceeded',
      limit: SECURITY_CONFIG.maxRecordCount,
    })}\n\n`);
    throw new RangeError('Record count exceeded');
  }

  // Process record...
}
```

**Why it works:**
- ✅ Hard limit on total records processed
- ✅ Prevents long-running operations
- ✅ Complements timeout protection
- ✅ Returns 413 Payload Too Large

### Layer 3: Error Count Limits

**Threat:** Attackers send CSV with millions of invalid records, causing:
- Unlimited SSE error event streaming (bandwidth exhaustion)
- CPU exhaustion from validation attempts
- Client-side DoS from processing too many error events

**Defense:** Stop processing after maxErrorCount validation errors:

```typescript
let errorCount = 0;

for await (const record of parseUint8ArrayStream(csvStream, { ... })) {
  if (errorCount >= SECURITY_CONFIG.maxErrorCount) {
    await stream.write(`event: fatal\n`);
    await stream.write(`data: ${JSON.stringify({
      error: 'Error count limit exceeded - stopping validation',
      limit: SECURITY_CONFIG.maxErrorCount,
    })}\n\n`);
    throw new Error('VALIDATION_ERROR_LIMIT');
  }

  try {
    recordSchema.parse(record);
    validCount++;
  } catch (error) {
    errorCount++;
    // Send error event...
  }
}
```

**Why it works:**
- ✅ Prevents unlimited error streaming
- ✅ Stops wasting CPU on hopeless validation
- ✅ Protects both server and client
- ✅ Returns 422 Unprocessable Entity

### Layer 4: Proper HTTP Status Codes

**Threat:** Without proper status codes, clients can't determine if their request was accepted or if processing is complete.

**Defense:** Return 202 Accepted when SSE streaming starts, and communicate fatal errors via `event: fatal` in the stream:

```typescript
try {
  return stream(c, async (stream) => {
    c.status(202); // Accepted - processing in progress
    c.header('Content-Type', 'text/event-stream');

    try {
      // ... parsing and validation
    } catch (error) {
      // Send fatal event to client
      if (error instanceof Error && error.name === 'AbortError') {
        await stream.write(`event: fatal\n`);
        await stream.write(`data: ${JSON.stringify({ error: 'Parsing timeout' })}\n\n`);
      }
      if (error instanceof RangeError) {
        await stream.write(`event: fatal\n`);
        await stream.write(`data: ${JSON.stringify({
          error: 'CSV exceeds limits',
          bytesRead: bytesRead
        })}\n\n`);
      }
      // ... other fatal errors
    }
  });
} catch (error) {
  // Only errors before SSE starts return non-202 status
  if (!sseStarted) {
    return c.json({ error: 'Validation failed' }, 400);
  }
  // ...
}
```

**Why it works:**
- ✅ Clients can detect fatal errors via HTTP status
- ✅ 408 Request Timeout - parsing timed out
- ✅ 413 Payload Too Large - size/record/field limit exceeded
- ✅ 422 Unprocessable Entity - too many validation errors
- ✅ Enables proper retry logic and error handling

## Step 5: Monitor Resource Usage

Implement monitoring to detect potential attacks:

```typescript
// Monitor pool usage
setInterval(() => {
  if (pool.isFull()) {
    console.warn('WorkerPool at capacity - possible attack or high load');
    // Alert your monitoring system (e.g., Datadog, Sentry)
  }
}, 5000);
```

## Security Checklist

Before deploying to production, verify:

- [ ] WorkerPool configured with `maxWorkers` limit
- [ ] Early rejection implemented with `isFull()`
- [ ] Content-Type header validation
- [ ] Content-Length header check (early rejection only)
- [ ] **Actual byte counting with TransformStream** (prevents Content-Length bypass)
- [ ] Timeout protection with AbortSignal
- [ ] maxBufferSize and maxFieldCount configured
- [ ] **maxRecordCount limit** (prevents unlimited record processing)
- [ ] **maxErrorCount limit** (prevents unlimited error streaming)
- [ ] Schema validation with Zod (or similar)
- [ ] **Proper HTTP status codes** (202 Accepted for SSE streaming)
- [ ] **Fatal event streaming** (event: fatal for critical errors during processing)
- [ ] Error logging for monitoring
- [ ] Rate limiting at application/infrastructure level

## Related Documentation

- **Understanding:** [Security Model](../explanation/security-model.md) - Why these defenses work
- **Reference:** [Engine Presets](../reference/engine-presets.md) - Available presets

For advanced configuration options, refer to the [`EngineConfig`](https://kamiazya.github.io/web-csv-toolbox/interfaces/EngineConfig.html) type documentation in your IDE or the [API Reference](https://kamiazya.github.io/web-csv-toolbox/).

## Troubleshooting

### Issue: Getting 503 errors frequently

**Cause:** WorkerPool is saturated
**Solution:** Increase `maxWorkers` or add rate limiting

### Issue: Memory usage still high

**Cause:** Large CSV files or not using streaming
**Solution:** Verify you're using `parseStringStream()` with stream input, not `parseString()` with string input

### Issue: Timeout errors

**Cause:** CSV processing takes too long
**Solution:** Increase timeout or optimize parsing (use WASM, reduce validation)

## Complete Example

For a complete, production-ready implementation of all security measures described in this guide, see the [Hono Secure API Example](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/hono-secure-api) on GitHub.

The example includes:
- All 7 security layers:
  - Resource limits (Worker pool, record count, error count)
  - Early rejection when saturated
  - Input validation (Content-Type, Content-Length)
  - **Actual byte counting** (prevents Content-Length bypass)
  - Data validation (Zod schema)
  - Timeout protection (AbortSignal)
  - **Proper HTTP status codes** (202 Accepted for streaming)
- Server-Sent Events (SSE) for real-time validation feedback with **fatal event support**
- Comprehensive Vitest test suite covering security vulnerabilities
- Ready-to-run Hono application with `@hono/node-server`
