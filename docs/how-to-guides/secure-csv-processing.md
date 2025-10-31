# How-To: Secure CSV Processing

## Problem

You need to process user-uploaded CSV files in a web application without exposing your system to Denial of Service (DoS) attacks or other security threats.

## Solution Overview

This guide shows you how to implement secure CSV processing using multiple defense layers:

1. **Resource limits** - Prevent resource exhaustion
2. **Early rejection** - Reject requests when saturated
3. **Input validation** - Verify content and size
4. **Data validation** - Validate parsed records with schema
5. **Timeout protection** - Prevent long-running operations

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
import { WorkerPool, EnginePresets, parseStringStream } from 'web-csv-toolbox';

const app = new Hono();

// ✅ CRITICAL: Limit concurrent workers
const pool = new WorkerPool({ maxWorkers: 4 });

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
};

const pool = new WorkerPool({ maxWorkers: SECURITY_CONFIG.maxWorkers });

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

  // 3. Check Content-Length header
  const contentLength = c.req.header('Content-Length');
  if (contentLength && Number.parseInt(contentLength) > SECURITY_CONFIG.maxRequestBodySize) {
    return c.json({ error: 'Request body too large' }, 413);
  }

  // 4. Get request body as stream
  const csvStream = c.req.raw.body?.pipeThrough(new TextDecoderStream());
  if (!csvStream) {
    return c.json({ error: 'Request body is required' }, 400);
  }

  // 5. Timeout protection
  const signal = AbortSignal.timeout(SECURITY_CONFIG.parseTimeout);

  try {
    return stream(c, async (stream) => {
      c.header('Content-Type', 'text/event-stream');
      c.header('Cache-Control', 'no-cache');
      c.header('Connection', 'keep-alive');

      let validCount = 0;
      let errorCount = 0;

      for await (const record of parseStringStream(csvStream, {
        signal,
        engine: EnginePresets.balanced({ workerPool: pool }),
        maxBufferSize: SECURITY_CONFIG.maxBufferSize,
        maxFieldCount: SECURITY_CONFIG.maxFieldCount,
      })) {
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
      await stream.write(`data: ${JSON.stringify({ valid: validCount, errors: errorCount })}\n\n`);
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return c.json({ error: 'Parsing timeout' }, 408);
    }
    if (error.name === 'RangeError') {
      return c.json({ error: 'CSV exceeds limits' }, 413);
    }
    return c.json({ error: 'Invalid CSV format' }, 400);
  }
});

export default app;
```

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
- [ ] Content-Length header check
- [ ] Timeout protection with AbortSignal
- [ ] maxBufferSize and maxFieldCount configured
- [ ] Schema validation with Zod (or similar)
- [ ] Error logging for monitoring
- [ ] Rate limiting at application/infrastructure level

## Related Documentation

- **Understanding:** [Security Model](../explanation/security-model.md) - Why these defenses work
- **Reference:** [Engine Presets](../reference/engine-presets.md) - Available presets
- **Reference:** [Engine Config](../reference/engine-config.md) - Configuration options

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
