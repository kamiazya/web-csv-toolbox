# Choosing the Right API

This guide helps you select the appropriate API for your CSV parsing needs in web-csv-toolbox.

> **Note for Bundler Users**: When using Worker-based engines (e.g., `EnginePresets.worker()`), you must specify the `workerURL` option with bundlers. See [How to Use with Bundlers](./use-with-bundlers.md).

## Quick Decision Tree

```
What type of input do you have?
│
├─ Learning/Prototyping?
│  └─ Use parse() (high-level API)
│
├─ String (CSV text)
│  └─ Use parseString() ✅
│
├─ ReadableStream<string> (text stream)
│  └─ Use parseStringStream() ✅
│
├─ Uint8Array or ArrayBuffer (binary data)
│  └─ Use parseBinary() ✅
│
├─ ReadableStream<Uint8Array> (binary stream)
│  └─ Use parseUint8ArrayStream() ✅
│
├─ Response (fetch result)
│  └─ Use parseResponse() ✅
│
├─ Request (server-side)
│  └─ Use parseRequest() ✅
│
└─ Blob or File (file upload, drag-and-drop)
   ├─ Generic: Use parseBlob() ✅
   └─ File-specific: Use parseFile() ✅
```

---

## API Categories

### High-Level API

**When to use:**
- Learning the library
- Quick prototyping
- Scripts where input type varies at runtime

**API:**
- `parse()` - Universal CSV parser with automatic input detection

**Trade-off:**
- Convenience vs. slight performance overhead from type detection

---

### Middle-Level APIs (Production)

**When to use:**
- Production applications
- Performance-critical code
- When input type is known at compile time

**APIs:**
- `parseString()` - Parse CSV string
- `parseStringStream()` - Parse text stream
- `parseBinary()` - Parse binary data (Uint8Array/ArrayBuffer)
- `parseUint8ArrayStream()` - Parse binary stream
- `parseResponse()` - Parse HTTP Response
- `parseRequest()` - Parse HTTP Request (server-side)
- `parseBlob()` - Parse Blob or File
- `parseFile()` - Parse File (alias for parseBlob)

**Trade-off:**
- Optimal performance vs. need to know input type

---

### Low-Level APIs

**When to use:**
- Custom parsing pipelines
- Special transformations
- Building higher-level abstractions

**APIs:**
- `CSVLexer` / `CSVLexerTransformer` - Tokenization
- `CSVRecordAssembler` / `CSVRecordAssemblerTransformer` - Record assembly

**Trade-off:**
- Maximum flexibility vs. complexity

---

## Detailed API Comparison

### parse() - High-Level Universal API

**Input:** `string | Uint8Array | ArrayBuffer | ReadableStream | Response`

**Use Cases:**
```typescript
import { parse } from 'web-csv-toolbox';

// ✅ Good for: Learning and prototyping
const csv = 'name,age\nAlice,30';
for await (const record of parse(csv)) {
  console.log(record);
}

// ✅ Good for: Input type varies at runtime
async function processCSV(input: string | Response) {
  for await (const record of parse(input)) {
    console.log(record);
  }
}
```

**Avoid for:**
- Production applications where input type is known
- Performance-critical code

**Performance:**
- Small overhead from input type detection
- Otherwise same as corresponding middle-level API

---

### parseString() - String Parser

**Input:** `string`

**Use Cases:**
```typescript
import { parseString } from 'web-csv-toolbox';

// ✅ Perfect for: Known string input
const csv = await file.text();
for await (const record of parseString(csv)) {
  console.log(record);
}

// ✅ Good for: Small to medium CSV strings
const data = `name,age\nAlice,30\nBob,25`;
for await (const record of parseString(data)) {
  console.log(record);
}
```

**Best for:**
- CSV text already in memory
- Small to medium files (<100MB)
- When entire CSV is available upfront

**Performance:**
- No type detection overhead
- Supports Worker + WASM for large strings

---

### parseStringStream() - Text Stream Parser

**Input:** `ReadableStream<string>`

**Use Cases:**
```typescript
import { parseStringStream } from 'web-csv-toolbox';

// ✅ Perfect for: Large text streams
const response = await fetch('large-data.csv');
const textStream = response.body
  .pipeThrough(new TextDecoderStream());

for await (const record of parseStringStream(textStream)) {
  console.log(record);
}

// ✅ Good for: Real-time data processing
const stream = getRealtimeCSVStream();
for await (const record of parseStringStream(stream)) {
  await processInRealtime(record);
}
```

**Best for:**
- Large files (>100MB)
- Streaming data sources
- Memory-constrained environments

**Performance:**
- O(1) memory usage per record
- Supports Worker with stream-transfer strategy

---

### parseBinary() - Binary Data Parser

**Input:** `Uint8Array | ArrayBuffer`

**Use Cases:**
```typescript
import { parseBinary } from 'web-csv-toolbox';

// ✅ Perfect for: Binary CSV data
const fileBuffer = await file.arrayBuffer();
for await (const record of parseBinary(fileBuffer, {
  charset: 'utf-8'
})) {
  console.log(record);
}

// ✅ Good for: Non-UTF-8 encodings
const shiftJISData = new Uint8Array([...]);
for await (const record of parseBinary(shiftJISData, {
  charset: 'shift-jis'
})) {
  console.log(record);
}

// ✅ Good for: Compressed data
for await (const record of parseBinary(data, {
  decompression: 'gzip'
})) {
  console.log(record);
}
```

**Best for:**
- Binary CSV data (Uint8Array, ArrayBuffer)
- Non-UTF-8 encodings (Shift-JIS, EUC-JP, etc.)
- Compressed CSV files (gzip, deflate)
- BOM handling required

**Performance:**
- Handles charset conversion
- Supports decompression
- Worker + WASM for large files

---

### parseUint8ArrayStream() - Binary Stream Parser

**Input:** `ReadableStream<Uint8Array>`

**Use Cases:**
```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';

// ✅ Perfect for: Large binary streams
const response = await fetch('large-data.csv.gz');
const binaryStream = response.body;

for await (const record of parseUint8ArrayStream(binaryStream, {
  charset: 'utf-8',
  decompression: 'gzip'
})) {
  console.log(record);
}

// ✅ Good for: Compressed streaming data
const stream = getCompressedCSVStream();
for await (const record of parseUint8ArrayStream(stream, {
  decompression: 'gzip'
})) {
  console.log(record);
}
```

**Best for:**
- Large binary streams (>100MB)
- Compressed streaming data
- Non-UTF-8 streaming data
- Memory-constrained environments

**Performance:**
- O(1) memory usage per record
- Handles decompression in streaming fashion

---

### parseResponse() - HTTP Response Parser

**Input:** `Response`

**Use Cases:**
```typescript
import { parseResponse } from 'web-csv-toolbox';

// ✅ Perfect for: Fetch API responses
const response = await fetch('https://example.com/data.csv');
for await (const record of parseResponse(response)) {
  console.log(record);
}

// ✅ Automatic header processing
// - Content-Type charset detection
// - Content-Encoding decompression
// - BOM handling
const response = await fetch('https://example.com/data.csv.gz');
for await (const record of parseResponse(response)) {
  // Automatically decompressed and decoded
  console.log(record);
}
```

**Best for:**
- HTTP/HTTPS responses from `fetch()`
- Automatic Content-Type handling
- Automatic Content-Encoding decompression
- Remote CSV files

**Performance:**
- Automatically uses streaming for large responses
- Handles compression transparently

---

### parseRequest() - HTTP Request Parser (Server-Side)

**Input:** `Request`

**Use Cases:**
```typescript
import { parseRequest } from 'web-csv-toolbox';

// ✅ Perfect for: Server-side request handling
// Cloudflare Workers
export default {
  async fetch(request: Request) {
    if (request.method === 'POST') {
      for await (const record of parseRequest(request)) {
        await database.insert(record);
      }
      return Response.json({ success: true });
    }
  }
};

// ✅ Service Workers
self.addEventListener('fetch', async (event) => {
  const request = event.request;
  if (request.url.endsWith('/upload-csv')) {
    const records = [];
    for await (const record of parseRequest(request)) {
      records.push(record);
    }
    event.respondWith(Response.json({ records }));
  }
});
```

**Best for:**
- Cloudflare Workers
- Service Workers
- Deno Deploy
- Edge computing platforms
- Any server-side Request handling

**Performance:**
- Streaming request processing
- Automatic Content-Type and Content-Encoding handling

---

### parseBlob() / parseFile() - Blob/File Parser

**Input:** `Blob` (including `File`)

**Use Cases:**
```typescript
import { parseBlob, parseFile } from 'web-csv-toolbox';

// ✅ Perfect for: File input elements
const input = document.querySelector('input[type="file"]');
input.addEventListener('change', async (event) => {
  const file = event.target.files[0];

  // Use parseFile for semantic clarity with File objects
  for await (const record of parseFile(file)) {
    console.log(record);
  }
});

// ✅ Perfect for: Drag-and-drop
dropZone.addEventListener('drop', async (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files[0];

  for await (const record of parseFile(file)) {
    console.log(record);
  }
});

// ✅ Good for: Blob objects
const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
for await (const record of parseBlob(blob)) {
  console.log(record);
}
```

**Best for:**
- File input elements (`<input type="file">`)
- Drag-and-drop file uploads
- Blob objects with charset in type parameter
- Browser file handling

**Performance:**
- Streaming for large files
- Automatic charset detection from Blob type

---

## Common Scenarios

### Scenario 1: User File Upload (Browser)

```typescript
import { parseFile } from 'web-csv-toolbox';

async function handleFileUpload(file: File) {
  for await (const record of parseFile(file)) {
    console.log(record);
  }
}
```

**Why `parseFile()`?**
- Direct File object support
- Automatic charset detection from file.type
- Streaming for large files
- Clean and simple API

**With validation:**
```typescript
import { parseFile } from 'web-csv-toolbox';

async function handleFileUpload(file: File) {
  // Validate file type
  if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
    throw new Error('Please upload a CSV file');
  }

  // Validate file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File too large (max 10MB)');
  }

  const records = [];
  for await (const record of parseFile(file)) {
    records.push(record);
  }

  return records;
}
```

---

### Scenario 2: Fetch Remote CSV

```typescript
import { parseResponse } from 'web-csv-toolbox';

async function fetchCSV(url: string) {
  const response = await fetch(url);

  for await (const record of parseResponse(response)) {
    console.log(record);
  }
}
```

**Why `parseResponse()`?**
- Automatic header processing (Content-Type, Content-Encoding)
- Streaming for large files
- Handles compression automatically

---

### Scenario 3: Parse CSV String from Database

```typescript
import { parseString } from 'web-csv-toolbox';

async function parseStoredCSV(csvText: string) {
  for await (const record of parseString(csvText)) {
    console.log(record);
  }
}
```

**Why `parseString()`?**
- Input is already a string
- No type detection overhead
- Clean and simple

---

### Scenario 4: Large File Processing (Node.js)

```typescript
import { parseStringStream, EnginePresets } from 'web-csv-toolbox';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

async function processLargeFile(filePath: string) {
  const nodeStream = createReadStream(filePath, 'utf-8');
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<string>;

  for await (const record of parseStringStream(webStream, {
    engine: EnginePresets.balanced
  })) {
    await processRecord(record);
  }
}
```

**Why `parseStringStream()`?**
- Streaming minimizes memory usage
- Worker execution for non-blocking processing
- Suitable for files of any size

---

### Scenario 5: Real-Time Data Processing

```typescript
import { parseStringStream } from 'web-csv-toolbox';

async function processRealtimeCSV(stream: ReadableStream<string>) {
  for await (const record of parseStringStream(stream)) {
    await sendToAnalytics(record);
  }
}
```

**Why `parseStringStream()`?**
- Streaming handles unbounded data
- Process records as they arrive
- Low latency

---

### Scenario 6: API Endpoint (Server)

```typescript
import { parseRequest } from 'web-csv-toolbox';

// Cloudflare Workers
export default {
  async fetch(request: Request) {
    if (request.method === 'POST' &&
        request.headers.get('content-type')?.includes('text/csv')) {

      const results = [];
      for await (const record of parseRequest(request)) {
        results.push(record);
      }

      return Response.json({
        success: true,
        count: results.length,
        data: results
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};
```

**Why `parseRequest()`?**
- Automatic header processing (Content-Type, Content-Encoding)
- Streaming for large uploads
- Built for server-side environments
- Resource limits prevent DoS

**With validation:**
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
    for await (const record of parseRequest(request, {
      maxFieldCount: 1000,  // Security limit
      maxBufferSize: 10 * 1024 * 1024  // 10MB limit
    })) {
      records.push(record);
    }

    return Response.json({ success: true, records });
  }
};
```

---

## Performance Considerations

### Memory Usage

| API | Memory Usage | Best For |
|-----|--------------|----------|
| `parse()` | Depends on input type | Learning, prototyping |
| `parseString()` | O(n) - proportional to string size | Small to medium strings |
| `parseStringStream()` | O(1) - constant per record | Large streams |
| `parseBinary()` | O(n) - proportional to buffer size | Small to medium binary data |
| `parseUint8ArrayStream()` | O(1) - constant per record | Large binary streams |
| `parseResponse()` | O(1) - streaming by default | HTTP responses |

---

### Execution Speed

**Main Thread:**
```typescript
// No worker overhead - best for small files (<1MB)
for await (const record of parseString(csv)) {
  console.log(record);
}
```

**Worker Thread:**
```typescript
// Non-blocking UI - best for large files (>1MB)
for await (const record of parseString(csv, {
  engine: { worker: true }
})) {
  console.log(record);
}
```

**WASM:**
```typescript
// Improved performance - best for UTF-8 large files (>10MB)
await loadWASM();
for await (const record of parseString(csv, {
  engine: { wasm: true }
})) {
  console.log(record);
}
```

**Worker + WASM:**
```typescript
// Maximum performance - best for very large UTF-8 files
await loadWASM();
for await (const record of parseString(csv, {
  engine: EnginePresets.fastest
})) {
  console.log(record);
}
```

---

## API Selection Matrix

| Input Type | Small (<1MB) | Medium (1-10MB) | Large (>10MB) | Encoding | API |
|------------|--------------|-----------------|---------------|----------|-----|
| `string` | Main thread | Worker | Worker + WASM | UTF-8 | `parseString()` |
| `string` | Main thread | Worker | Worker | Any | `parseString()` |
| `ReadableStream<string>` | Main thread | Worker + stream | Worker + stream | UTF-8 | `parseStringStream()` |
| `Uint8Array` | Main thread | Worker | Worker + WASM | UTF-8 | `parseBinary()` |
| `Uint8Array` | Main thread | Worker | Worker | Any | `parseBinary()` |
| `ReadableStream<Uint8Array>` | Main thread | Main thread | Main thread | Any | `parseUint8ArrayStream()` |
| `Response` | Auto | Auto | Auto | Auto | `parseResponse()` |
| `Request` | Auto | Auto | Auto | Auto | `parseRequest()` |
| `Blob` / `File` | Main thread | Main thread | Main thread | Auto | `parseBlob()` / `parseFile()` |

---

## Best Practices

### ✅ Do

- **Use middle-level APIs in production** for optimal performance
- **Use `parseResponse()` for fetch()** to get automatic header processing
- **Use streaming APIs for large files** (>10MB)
- **Use `EnginePresets` for execution strategies** instead of manual configuration
- **Reuse `WorkerPool`** across multiple parse operations
- **Call `loadWASM()` once at startup** if using WASM

### ❌ Don't

- **Don't use `parse()` in production** when input type is known
- **Don't load entire large files into memory** - use streams
- **Don't create new workers for each parse** - use `WorkerPool`
- **Don't use WASM for non-UTF-8 files** - it will fall back to JavaScript
- **Don't forget error handling** - wrap in try-catch

---

## Migration Guide

### From parse() to Specialized APIs

**Before (High-level):**
```typescript
import { parse } from 'web-csv-toolbox';

const response = await fetch('data.csv');
for await (const record of parse(response)) {
  console.log(record);
}
```

**After (Middle-level):**
```typescript
import { parseResponse } from 'web-csv-toolbox';

const response = await fetch('data.csv');
for await (const record of parseResponse(response)) {
  console.log(record);
}
```

**Benefits:**
- Eliminates type detection overhead
- Clearer intent
- Better TypeScript inference

---

## Related Documentation

- **[parse() API Reference](../reference/api/parse.md)** - High-level universal API
- **[parseString() API Reference](../reference/api/parseString.md)** - String parser
- **[parseResponse() API Reference](../reference/api/parseResponse.md)** - Response parser
- **[parseRequest() API Reference](../reference/api/parseRequest.md)** - Request parser (server-side)
- **[parseBlob() API Reference](../reference/api/parseBlob.md)** - Blob/File parser
- **[parseFile() API Reference](../reference/api/parseFile.md)** - File parser (alias)
- **[Execution Strategies](../explanation/execution-strategies.md)** - Understanding execution modes
- **[Working with Workers](../tutorials/working-with-workers.md)** - Worker threads guide

---

## Summary

**Quick recommendations:**

1. **Learning/Prototyping:** Use `parse()` for simplicity
2. **Production (known input type):** Use specialized middle-level APIs
3. **HTTP responses (client):** Use `parseResponse()` for automatic header handling
4. **HTTP requests (server):** Use `parseRequest()` for server-side request handling
5. **File uploads:** Use `parseFile()` or `parseBlob()` for file inputs and drag-and-drop
6. **Large files:** Use streaming APIs (`parseStringStream()`, `parseUint8ArrayStream()`)
7. **Performance-critical:** Use `EnginePresets.fastest()` with WASM + Worker
8. **Non-UTF-8:** Use `parseBinary()` or `parseUint8ArrayStream()` with `charset` option

**Remember:** The best API depends on your specific use case. Consider input type, file size, encoding, and performance requirements when choosing.
