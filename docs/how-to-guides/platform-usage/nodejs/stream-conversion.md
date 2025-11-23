---
title: Node.js - Stream Conversion
group: Platform Usage
---

# Node.js Stream Conversion

Convert Node.js streams to Web Streams for use with web-csv-toolbox.

## Problem

Node.js frameworks like Express and Fastify use Node.js Streams (`stream.Readable`, `IncomingMessage`), but web-csv-toolbox expects Web Streams (`ReadableStream`). You need to convert between the two stream types.

## Solution

Node.js provides `Readable.toWeb()` to convert Node.js streams to Web ReadableStreams.

## Express

### Basic CSV Upload

```typescript
import express from 'express';
import { Readable } from 'stream';
import { parseBinaryStream } from 'web-csv-toolbox';

const app = express();

app.post('/upload-csv', async (req, res) => {
  try {
    // Convert Node.js stream to Web ReadableStream
    const webStream = Readable.toWeb(req) as ReadableStream<Uint8Array>;

    const records = [];
    for await (const record of parseBinaryStream(webStream)) {
      records.push(record);
    }

    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3000);
```

### With Content-Type Validation

```typescript
import express from 'express';
import { Readable } from 'stream';
import { parseBinaryStream } from 'web-csv-toolbox';

const app = express();

app.post('/upload-csv', async (req, res) => {
  // Verify Content-Type
  if (!req.headers['content-type']?.includes('text/csv')) {
    return res.status(415).json({ error: 'Content-Type must be text/csv' });
  }

  try {
    const webStream = Readable.toWeb(req) as ReadableStream<Uint8Array>;

    const records = [];
    for await (const record of parseBinaryStream(webStream)) {
      records.push(record);
    }

    res.json({ success: true, count: records.length });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3000);
```

### With Security Limits

```typescript
import express from 'express';
import { Readable } from 'stream';
import { parseBinaryStream } from 'web-csv-toolbox';

const app = express();

app.post('/upload-csv', async (req, res) => {
  try {
    const webStream = Readable.toWeb(req) as ReadableStream<Uint8Array>;

    const records = [];
    for await (const record of parseBinaryStream(webStream, {
      maxBufferSize: 10 * 1024 * 1024,  // 10MB
      maxFieldCount: 10000,
      signal: AbortSignal.timeout(30000) // 30 seconds
    })) {
      records.push(record);
    }

    res.json({ success: true, count: records.length });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(408).json({ error: 'Request timeout' });
    }
    if (error instanceof RangeError) {
      return res.status(413).json({ error: 'CSV exceeds limits' });
    }
    res.status(400).json({ error: error.message });
  }
});

app.listen(3000);
```

## Fastify

### Basic CSV Upload

```typescript
import Fastify from 'fastify';
import { Readable } from 'stream';
import { parseBinaryStream } from 'web-csv-toolbox';

const fastify = Fastify();

fastify.post('/upload-csv', async (request, reply) => {
  try {
    // Convert Node.js stream to Web ReadableStream
    const webStream = Readable.toWeb(request.raw) as ReadableStream<Uint8Array>;

    const records = [];
    for await (const record of parseBinaryStream(webStream)) {
      records.push(record);
    }

    return { success: true, count: records.length, data: records };
  } catch (error) {
    reply.status(400);
    return { error: error.message };
  }
});

fastify.listen({ port: 3000 });
```

### With Validation

```typescript
import Fastify from 'fastify';
import { Readable } from 'stream';
import { parseBinaryStream } from 'web-csv-toolbox';

const fastify = Fastify();

fastify.post('/upload-csv', async (request, reply) => {
  // Verify Content-Type
  if (!request.headers['content-type']?.includes('text/csv')) {
    reply.status(415);
    return { error: 'Content-Type must be text/csv' };
  }

  try {
    const webStream = Readable.toWeb(request.raw) as ReadableStream<Uint8Array>;

    const records = [];
    for await (const record of parseBinaryStream(webStream, {
      maxBufferSize: 10 * 1024 * 1024,
      maxFieldCount: 10000
    })) {
      records.push(record);
    }

    return { success: true, count: records.length };
  } catch (error) {
    reply.status(400);
    return { error: error.message };
  }
});

fastify.listen({ port: 3000 });
```

## Koa

### Basic CSV Upload

```typescript
import Koa from 'koa';
import { Readable } from 'stream';
import { parseBinaryStream } from 'web-csv-toolbox';

const app = new Koa();

app.use(async (ctx) => {
  if (ctx.method === 'POST' && ctx.path === '/upload-csv') {
    try {
      // Convert Node.js stream to Web ReadableStream
      const webStream = Readable.toWeb(ctx.req) as ReadableStream<Uint8Array>;

      const records = [];
      for await (const record of parseBinaryStream(webStream)) {
        records.push(record);
      }

      ctx.body = { success: true, count: records.length, data: records };
    } catch (error) {
      ctx.status = 400;
      ctx.body = { error: error.message };
    }
  }
});

app.listen(3000);
```

## NestJS

### Controller with Stream Conversion

```typescript
import { Controller, Post, Req, Res, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { Readable } from 'stream';
import { parseBinaryStream } from 'web-csv-toolbox';

@Controller('csv')
export class CsvController {
  @Post('upload')
  async uploadCSV(@Req() req: Request, @Res() res: Response) {
    try {
      // Convert Node.js stream to Web ReadableStream
      const webStream = Readable.toWeb(req) as ReadableStream<Uint8Array>;

      const records = [];
      for await (const record of parseBinaryStream(webStream)) {
        records.push(record);
      }

      res.status(HttpStatus.OK).json({
        success: true,
        count: records.length,
        data: records
      });
    } catch (error) {
      res.status(HttpStatus.BAD_REQUEST).json({
        error: error.message
      });
    }
  }
}
```

### With Injectable Service

```typescript
import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { parseBinaryStream } from 'web-csv-toolbox';

@Injectable()
export class CsvService {
  async parseCSVStream(nodeStream: Readable): Promise<any[]> {
    const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    const records = [];
    for await (const record of parseBinaryStream(webStream, {
      maxBufferSize: 10 * 1024 * 1024,
      maxFieldCount: 10000
    })) {
      records.push(record);
    }

    return records;
  }
}
```

## Why Use parseBinaryStream?

When converting Node.js streams to Web Streams, you should use `parseBinaryStream()` because:

1. **Node.js streams are binary** - They emit `Buffer` objects (Uint8Array)
2. **Type safety** - `parseBinaryStream()` expects `ReadableStream<Uint8Array>`
3. **Character encoding** - Specify charset via options

```typescript
// ✅ Correct - handles binary data
const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
for await (const record of parseBinaryStream(webStream, {
  charset: 'utf-8' // Specify encoding
})) {
  console.log(record);
}

// ❌ Wrong - assumes text stream
const webStream = Readable.toWeb(nodeStream) as ReadableStream<string>;
for await (const record of parseStringStream(webStream)) {
  // Won't work - Node.js streams are binary
}
```

## Complete Production Example

```typescript
import express from 'express';
import { Readable } from 'stream';
import { parseBinaryStream } from 'web-csv-toolbox';
import { z } from 'zod';

const app = express();

// Validation schema
const recordSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.coerce.number().int().min(0).max(150),
});

app.post('/upload-csv', async (req, res) => {
  // 1. Verify Content-Type
  if (!req.headers['content-type']?.includes('text/csv')) {
    return res.status(415).json({ error: 'Content-Type must be text/csv' });
  }

  // 2. Check Content-Length
  const contentLength = req.headers['content-length'];
  if (contentLength && Number(contentLength) > 50 * 1024 * 1024) {
    return res.status(413).json({ error: 'File too large (max 50MB)' });
  }

  try {
    // 3. Convert stream
    const webStream = Readable.toWeb(req) as ReadableStream<Uint8Array>;

    const validRecords = [];
    const errors = [];

    // 4. Parse with security limits
    for await (const record of parseBinaryStream(webStream, {
      maxBufferSize: 10 * 1024 * 1024,
      maxFieldCount: 10000,
      signal: AbortSignal.timeout(30000)
    })) {
      try {
        // 5. Validate each record
        const validated = recordSchema.parse(record);
        validRecords.push(validated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          errors.push({
            record,
            errors: error.errors
          });
        }
      }
    }

    // 6. Return results
    res.json({
      success: true,
      valid: validRecords.length,
      errors: errors.length,
      data: validRecords,
      validationErrors: errors.length > 0 ? errors.slice(0, 10) : undefined
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(408).json({ error: 'Request timeout' });
    }
    if (error instanceof RangeError) {
      return res.status(413).json({ error: 'CSV exceeds limits' });
    }
    res.status(400).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});
```

## Common Pitfalls

### ❌ Don't Use parseStringStream

```typescript
// ❌ Wrong - Node.js streams are binary
const webStream = Readable.toWeb(req) as ReadableStream<string>;
for await (const record of parseStringStream(webStream)) {
  // Won't work correctly
}
```

### ✅ Use parseBinaryStream

```typescript
// ✅ Correct - handles binary data
const webStream = Readable.toWeb(req) as ReadableStream<Uint8Array>;
for await (const record of parseBinaryStream(webStream)) {
  console.log(record);
}
```

### ❌ Don't Forget Error Handling

```typescript
// ❌ Missing error handling
app.post('/upload', async (req, res) => {
  const webStream = Readable.toWeb(req) as ReadableStream<Uint8Array>;
  for await (const record of parseBinaryStream(webStream)) {
    // Can throw errors
  }
});
```

### ✅ Always Use Try-Catch

```typescript
// ✅ Proper error handling
app.post('/upload', async (req, res) => {
  try {
    const webStream = Readable.toWeb(req) as ReadableStream<Uint8Array>;
    for await (const record of parseBinaryStream(webStream)) {
      console.log(record);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

## Related Documentation

- **[HTTP Requests](./http.md)** - HTTP requests with fetch API
- **[Worker Pool Management](../../worker-pool-management.md)** - Managing concurrent CSV processing
- **[Secure CSV Processing](../../secure-csv-processing.md)** - Security best practices
- **[Node.js Streams API](https://nodejs.org/api/stream.html)** - Official Node.js documentation
- **[Web Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API)** - MDN Web Docs

## Summary

**Key Points:**

1. Use `Readable.toWeb()` to convert Node.js streams to Web Streams
2. Use `parseBinaryStream()` for converted streams (not `parseStringStream()`)
3. Always specify charset via options if not UTF-8
4. Always use try-catch for error handling
5. Set security limits (`maxBufferSize`, `maxFieldCount`, timeout)
6. Validate Content-Type headers
7. Works with Express, Fastify, Koa, NestJS, and other Node.js frameworks
