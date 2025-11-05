# parseRequest() API Reference

Parse HTTP Request containing CSV data with automatic header processing for server-side environments.

## Overview

`parseRequest()` is a middle-level API specifically designed for parsing CSV data from HTTP `Request` objects in server-side environments like Cloudflare Workers, Service Workers, and other edge computing platforms. It automatically handles request headers like `Content-Type`, `Content-Encoding`, and charset detection.

**Category:** Middle-level API (Production)

**Input:** `Request`

**Output:** `AsyncIterableIterator<CSVRecord<Header>>`

**Primary Use Cases:**
- Cloudflare Workers
- Service Workers
- Deno Deploy
- Edge computing platforms
- Any environment using the Request API

---

## Function Signature

```typescript
function parseRequest<Header extends ReadonlyArray<string>>(
  request: Request,
  options?: ParseBinaryOptions<Header>
): AsyncIterableIterator<CSVRecord<Header>>
```

---

## Parameters

### `request`

**Type:** `Request`

**Required:** Yes

The HTTP Request object to parse.

**Example:**
```typescript
// Cloudflare Workers
export default {
  async fetch(request: Request) {
    if (request.method === 'POST') {
      for await (const record of parseRequest(request)) {
        console.log(record);
      }
    }
  }
};
```

**Requirements:**
- Must have non-null body (`request.body !== null`)
- Content-Type should be `text/csv` (auto-detected if not specified)

---

### `options`

**Type:** `ParseBinaryOptions<Header>`

**Required:** No

Parsing options to customize behavior. Options specified here override values from request headers.

```typescript
interface ParseBinaryOptions<Header> {
  // Parsing options
  delimiter?: string;           // Default: ','
  quotation?: string;           // Default: '"'
  header?: Header;              // Explicit header list

  // Binary options (relevant for Request)
  charset?: string;             // Default: from Content-Type header or 'utf-8'
  decompression?: CompressionFormat;
  ignoreBOM?: boolean;          // Default: false

  // Resource limits
  maxBufferSize?: number;       // Default: 10485760 (10MB)
  maxFieldCount?: number;       // Default: 100000

  // Execution strategy
  engine?: EngineConfig;        // Execution configuration

  // Abort control
  signal?: AbortSignal;         // Cancellation signal
}
```

---

## Automatic Header Processing

`parseRequest()` automatically processes HTTP request headers:

### Content-Type

**Behavior:**
- If `Content-Type` header is missing, assumes `text/csv`
- If `Content-Type` is not `text/csv`, throws `TypeError`
- Extracts charset parameter if present (e.g., `text/csv; charset=shift-jis`)

**Example headers:**
```
Content-Type: text/csv
Content-Type: text/csv; charset=utf-8
Content-Type: text/csv; charset=shift-jis
```

---

### Content-Encoding

**Behavior:**
- Auto-detects compression from `Content-Encoding` header
- Automatically decompresses using DecompressionStream
- Only single encoding values are supported (comma-separated values will throw an error)

**Supported values:**
- `gzip`
- `deflate`
- `deflate-raw` (experimental, requires `allowExperimentalCompressions: true`)

**Example:**
```typescript
// Single encoding only
const request = new Request('https://example.com', {
  method: 'POST',
  headers: {
    'Content-Type': 'text/csv',
    'Content-Encoding': 'gzip'  // ✓ Supported
  },
  body: compressedData
});

// Multiple encodings are NOT supported
const request = new Request('https://example.com', {
  method: 'POST',
  headers: {
    'Content-Type': 'text/csv',
    'Content-Encoding': 'gzip, deflate'  // ✗ Throws TypeError
  },
  body: compressedData
});
```

---

## Returns

`AsyncIterableIterator<CSVRecord<Header>>`

An async iterable iterator that yields CSV records one by one.

---

## Usage Examples

### Example 1: Cloudflare Workers

```typescript
import { parseRequest } from 'web-csv-toolbox';

export default {
  async fetch(request: Request) {
    if (request.method === 'POST' &&
        request.headers.get('content-type')?.includes('text/csv')) {

      const records = [];
      for await (const record of parseRequest(request)) {
        records.push(record);
      }

      return new Response(JSON.stringify(records), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};
```

---

### Example 2: Service Worker

```typescript
import { parseRequest } from 'web-csv-toolbox';

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method === 'POST' && request.url.endsWith('/upload-csv')) {
    event.respondWith(
      (async () => {
        const records = [];

        for await (const record of parseRequest(request)) {
          records.push(record);
        }

        return new Response(JSON.stringify({
          success: true,
          count: records.length,
          data: records
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      })()
    );
  }
});
```

---

### Example 3: Deno Deploy

```typescript
import { parseRequest } from 'web-csv-toolbox';

Deno.serve(async (request) => {
  if (request.method === 'POST' &&
      new URL(request.url).pathname === '/api/csv') {

    try {
      const records = [];
      for await (const record of parseRequest(request)) {
        // Process record
        records.push(record);
      }

      return new Response(JSON.stringify({
        success: true,
        records
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Not Found', { status: 404 });
});
```

---

### Example 4: With Validation

```typescript
import { parseRequest } from 'web-csv-toolbox';

export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('text/csv')) {
      return new Response('Content-Type must be text/csv', {
        status: 400
      });
    }

    const records = [];
    const errors = [];

    for await (const record of parseRequest(request)) {
      // Validate each record
      if (!record.email?.includes('@')) {
        errors.push(`Invalid email: ${record.email}`);
      } else {
        records.push(record);
      }
    }

    return new Response(JSON.stringify({
      records,
      errors
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

---

### Example 5: Streaming Processing

```typescript
import { parseRequest } from 'web-csv-toolbox';

export default {
  async fetch(request: Request) {
    if (request.method === 'POST') {
      let count = 0;

      for await (const record of parseRequest(request)) {
        // Process records as they arrive
        await database.insert(record);
        count++;
      }

      return new Response(JSON.stringify({
        success: true,
        processed: count
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method Not Allowed', { status: 405 });
  }
};
```

---

### Example 6: With TypeScript Headers

```typescript
import { parseRequest } from 'web-csv-toolbox';

type UserRecord = ['name', 'email', 'age'];

export default {
  async fetch(request: Request) {
    if (request.method === 'POST') {
      const users = [];

      for await (const record of parseRequest<UserRecord>(request)) {
        // TypeScript knows: record.name, record.email, record.age
        users.push({
          name: record.name,
          email: record.email,
          age: parseInt(record.age)
        });
      }

      return Response.json({ users });
    }

    return new Response('Method Not Allowed', { status: 405 });
  }
};
```

---

### Example 7: Compressed Requests (gzip/deflate)

**Automatic decompression:**

```typescript
import { parseRequest } from 'web-csv-toolbox';

export default {
  async fetch(request: Request) {
    if (request.method === 'POST') {
      // Content-Encoding header is automatically detected
      // No need to manually specify decompression option
      const records = [];

      for await (const record of parseRequest(request)) {
        records.push(record);
      }

      return Response.json({
        success: true,
        count: records.length,
        encoding: request.headers.get('content-encoding') || 'none'
      });
    }

    return new Response('Method Not Allowed', { status: 405 });
  }
};
```

**Test with curl:**
```bash
# Send gzip-compressed CSV
echo "name,age\nAlice,30\nBob,25" | gzip | \
  curl -X POST \
    -H "Content-Type: text/csv" \
    -H "Content-Encoding: gzip" \
    --data-binary @- \
    https://your-worker.workers.dev

# Send deflate-compressed CSV
echo "name,age\nAlice,30\nBob,25" | \
  curl -X POST \
    -H "Content-Type: text/csv" \
    -H "Content-Encoding: deflate" \
    --data-binary @- \
    https://your-worker.workers.dev
```

**Supported compression formats:**
- `gzip` - Most common
- `deflate` - Less common
- Automatically detected from `Content-Encoding` header
- No manual configuration needed

---

## Namespace Methods

### parseRequest.toArray()

Convert the entire request body to an array of records.

```typescript
function toArray<Header extends ReadonlyArray<string>>(
  request: Request,
  options?: ParseBinaryOptions<Header>
): Promise<CSVRecord<Header>[]>
```

**Example:**
```typescript
import { parseRequest } from 'web-csv-toolbox';

export default {
  async fetch(request: Request) {
    const records = await parseRequest.toArray(request);
    return Response.json({ records });
  }
};
```

⚠️ **Warning:** Loads entire result into memory. Not suitable for very large requests.

---

### parseRequest.toStream()

Convert request body to a ReadableStream of records.

```typescript
function toStream<Header extends ReadonlyArray<string>>(
  request: Request,
  options?: ParseBinaryOptions<Header>
): ReadableStream<CSVRecord<Header>>
```

**Example:**
```typescript
import { parseRequest } from 'web-csv-toolbox';

export default {
  async fetch(request: Request) {
    const stream = parseRequest.toStream(request);

    await stream.pipeTo(
      new WritableStream({
        write(record) {
          console.log(record);
        }
      })
    );

    return Response.json({ success: true });
  }
};
```

---

## Performance Characteristics

### Memory Usage

- **Streaming (default):** O(1) - constant per record
- **toArray():** O(n) - proportional to request size

**Recommendation:** Always use streaming for large requests to minimize memory usage.

---

### Request Processing

`parseRequest()` processes data as it arrives:

```
Request Body → Decompress (if needed) → Decode (charset) → Parse → Yield records
     ↓              ↓                        ↓                ↓           ↓
 Streaming      Streaming                Streaming        Streaming   Streaming
```

**Benefits:**
- Start processing before entire request received
- Constant memory usage regardless of request size
- Can handle arbitrarily large uploads

---

## Error Handling

### TypeError - Null Request Body

```typescript
import { parseRequest } from 'web-csv-toolbox';

export default {
  async fetch(request: Request) {
    try {
      for await (const record of parseRequest(request)) {
        console.log(record);
      }
    } catch (error) {
      if (error instanceof TypeError &&
          error.message.includes('null')) {
        return new Response('Request body is required', {
          status: 400
        });
      }
      throw error;
    }
  }
};
```

---

### TypeError - Invalid Content-Type

```typescript
import { parseRequest } from 'web-csv-toolbox';

export default {
  async fetch(request: Request) {
    try {
      for await (const record of parseRequest(request)) {
        console.log(record);
      }
    } catch (error) {
      if (error instanceof TypeError &&
          error.message.includes('mime type')) {
        return new Response('Content-Type must be text/csv', {
          status: 400
        });
      }
      throw error;
    }
  }
};
```

---

### ParseError - Invalid CSV

```typescript
import { parseRequest } from 'web-csv-toolbox';

export default {
  async fetch(request: Request) {
    try {
      const records = [];
      for await (const record of parseRequest(request)) {
        records.push(record);
      }
      return Response.json({ records });
    } catch (error) {
      if (error.name === 'ParseError') {
        return new Response(JSON.stringify({
          error: 'Invalid CSV format',
          message: error.message
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw error;
    }
  }
};
```

---

## Comparison with Other APIs

### parseRequest() vs parseResponse()

| Feature | `parseRequest()` | `parseResponse()` |
|---------|------------------|-------------------|
| **Input type** | `Request` | `Response` |
| **Use case** | Server-side (receiving data) | Client-side (fetching data) |
| **Environment** | Workers, edge, servers | Browsers, Node.js |
| **Header processing** | Automatic | Automatic |

---

## Real-World Examples

### Example: CSV Upload API

```typescript
import { parseRequest } from 'web-csv-toolbox';

export default {
  async fetch(request: Request, env: Env) {
    if (request.method === 'POST' &&
        new URL(request.url).pathname === '/api/upload') {

      const records = [];
      const timestamp = Date.now();

      try {
        for await (const record of parseRequest(request)) {
          await env.DB.prepare(
            'INSERT INTO records (data, created_at) VALUES (?, ?)'
          ).bind(JSON.stringify(record), timestamp).run();

          records.push(record);
        }

        return Response.json({
          success: true,
          count: records.length
        });
      } catch (error) {
        return Response.json({
          error: error.message
        }, { status: 400 });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};
```

---

### Example: Batch Processing with Rate Limiting

```typescript
import { parseRequest } from 'web-csv-toolbox';

export default {
  async fetch(request: Request, env: Env) {
    const BATCH_SIZE = 100;
    const batch: any[] = [];
    let total = 0;

    for await (const record of parseRequest(request)) {
      batch.push(record);

      if (batch.length >= BATCH_SIZE) {
        await env.DB.batch(
          batch.map(r =>
            env.DB.prepare('INSERT INTO data VALUES (?)').bind(r)
          )
        );

        total += batch.length;
        batch.length = 0;

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Process remaining
    if (batch.length > 0) {
      await env.DB.batch(
        batch.map(r =>
          env.DB.prepare('INSERT INTO data VALUES (?)').bind(r)
        )
      );
      total += batch.length;
    }

    return Response.json({
      success: true,
      processed: total
    });
  }
};
```

---

## Platform Support

`parseRequest()` is supported across all platforms with Request API:

| Platform | Support | Notes |
|----------|---------|-------|
| Cloudflare Workers | ✅ | Full support |
| Deno Deploy | ✅ | Full support |
| Service Workers | ✅ | Full support |
| Node.js 18+ | ✅ | Via undici Request |
| Bun | ✅ | Full support |

**Required APIs:**
- `Request` API
- `DecompressionStream` (for compressed requests)
- `TextDecoder` (for charset conversion)

---

## Related Documentation

- **[parseResponse() API Reference](./parseResponse.md)** - Client-side response parser
- **[parse() API Reference](./parse.md)** - High-level universal API
- **[Choosing the Right API](../../how-to-guides/choosing-the-right-api.md)** - API selection guide
- **[Use with Bundlers](../../how-to-guides/use-with-bundlers.md)** - Bundler integration

---

## Best Practices

### ✅ Do

- Use `parseRequest()` for server-side request handling
- Let automatic header processing handle charset/encoding
- Use streaming iteration for large requests
- Implement request size limits
- Validate Content-Type before parsing
- Handle errors gracefully
- Use TypeScript for type safety

### ❌ Don't

- Don't use `toArray()` for very large requests
- Don't ignore error handling
- Don't forget to validate Content-Type
- Don't allow unlimited request sizes (DoS risk)
- Don't manually decompress (automatic)
- Don't parse non-CSV requests

---

## Summary

`parseRequest()` is the optimal choice for parsing CSV data from HTTP requests in server-side environments:

**Key Features:**
- ✅ Automatic Content-Type handling
- ✅ Automatic Content-Encoding decompression
- ✅ Automatic charset detection and conversion
- ✅ Streaming for memory efficiency
- ✅ Full TypeScript support
- ✅ Works with standard Request API

**When to use:**
- Cloudflare Workers
- Service Workers
- Deno Deploy
- Edge computing platforms
- Any server-side request handling

**When to avoid:**
- Client-side fetch responses - use `parseResponse()` instead
- File uploads in browsers - use `parseBlob()` or `parseFile()` instead
- Non-Request data sources - use appropriate parser
