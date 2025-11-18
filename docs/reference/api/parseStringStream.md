# parseStringStream() API Reference

Parse streaming CSV text with constant memory usage for arbitrarily large files.

## Overview

`parseStringStream()` is a middle-level API optimized for parsing CSV data from text streams (`ReadableStream<string>`). It provides true streaming processing with O(1) memory usage per record, making it ideal for very large files and real-time data sources.

**Category:** Middle-level API (Production)

**Input:** `ReadableStream<string>`

**Output:** `AsyncIterableIterator<CSVRecord<Header>>`

---

## Function Signature

```typescript
function parseStringStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>
): AsyncIterableIterator<CSVRecord<Header>>
```

---

## Parameters

### `stream`

**Type:** `ReadableStream<string>`

**Required:** Yes

A readable stream of CSV text chunks.

**Example:**
```typescript
// From fetch
const response = await fetch('data.csv');
const textStream = response.body
  .pipeThrough(new TextDecoderStream());

// From Node.js stream
import { Readable } from 'stream';
const nodeStream = createReadStream('data.csv', 'utf-8');
const webStream = Readable.toWeb(nodeStream) as ReadableStream<string>;

// Manual stream
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue('name,age\n');
    controller.enqueue('Alice,30\n');
    controller.close();
  }
});
```

---

### `options`

**Type:** `ParseOptions<Header>`

**Required:** No

Parsing options. See [parseString() API Reference](./parseString.md#common-options) for details.

**Stream-specific considerations:**

##### `engine` - Worker Strategy

For streams, the engine supports special worker strategies:

- **`stream-transfer`** (recommended): Zero-copy stream transfer to worker
  - Supported on Chrome, Firefox, Edge
  - Automatically falls back on Safari
- **`message-streaming`**: Records sent via postMessage
  - Works on all browsers including Safari
  - Slightly higher overhead but more compatible

**Example:**
```typescript
import { parseStringStream, EnginePresets } from 'web-csv-toolbox';

// Use worker with stream-transfer (auto-fallback)
for await (const record of parseStringStream(stream, {
  engine: EnginePresets.memoryEfficient()
})) {
  console.log(record);
}
```

**Note:** WASM execution is not supported for streams. If specified, it falls back to main thread.

---

## Returns

`AsyncIterableIterator<CSVRecord<Header>>`

An async iterable iterator that yields CSV records as they are parsed from the stream.

---

## Usage Examples

### Example 1: Basic Usage

```typescript
import { parseStringStream } from 'web-csv-toolbox';

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue('name,age\n');
    controller.enqueue('Alice,30\n');
    controller.enqueue('Bob,25\n');
    controller.close();
  }
});

for await (const record of parseStringStream(stream)) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
// { name: 'Bob', age: '25' }
```

---

### Example 2: From Fetch Response

```typescript
import { parseStringStream } from 'web-csv-toolbox';

const response = await fetch('https://example.com/large-data.csv');
const textStream = response.body
  .pipeThrough(new TextDecoderStream());

for await (const record of parseStringStream(textStream)) {
  console.log(record);
}
```

---

### Example 3: From Node.js File Stream

```typescript
import { parseStringStream } from 'web-csv-toolbox';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

const nodeStream = createReadStream('large-file.csv', 'utf-8');
const webStream = Readable.toWeb(nodeStream) as ReadableStream<string>;

for await (const record of parseStringStream(webStream)) {
  console.log(record);
}
```

---

### Example 4: With Worker (Non-blocking)

```typescript
import { parseStringStream, EnginePresets } from 'web-csv-toolbox';

const response = await fetch('large-data.csv');
const textStream = response.body
  .pipeThrough(new TextDecoderStream());

// Non-blocking parsing in worker
for await (const record of parseStringStream(textStream, {
  engine: EnginePresets.memoryEfficient()
})) {
  console.log(record);
  // UI stays responsive!
}
```

---

### Example 5: Custom Delimiter (TSV)

```typescript
import { parseStringStream } from 'web-csv-toolbox';

const response = await fetch('data.tsv');
const textStream = response.body
  .pipeThrough(new TextDecoderStream());

for await (const record of parseStringStream(textStream, {
  delimiter: '\t'
})) {
  console.log(record);
}
```

---

### Example 6: Real-Time Data Processing

```typescript
import { parseStringStream } from 'web-csv-toolbox';

// WebSocket or Server-Sent Events stream
const stream = getRealTimeCSVStream();

for await (const record of parseStringStream(stream)) {
  // Process records as they arrive
  await sendToAnalytics(record);
  updateUI(record);
}
```

---

### Example 7: With AbortSignal

```typescript
import { parseStringStream } from 'web-csv-toolbox';

const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetch('data.csv', {
    signal: controller.signal
  });

  const textStream = response.body
    .pipeThrough(new TextDecoderStream());

  for await (const record of parseStringStream(textStream, {
    signal: controller.signal
  })) {
    console.log(record);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Parsing cancelled');
  }
}
```

---

### Example 8: Batch Processing

```typescript
import { parseStringStream } from 'web-csv-toolbox';

const response = await fetch('large-data.csv');
const textStream = response.body
  .pipeThrough(new TextDecoderStream());

const BATCH_SIZE = 1000;
let batch: any[] = [];

for await (const record of parseStringStream(textStream)) {
  batch.push(record);

  if (batch.length >= BATCH_SIZE) {
    await db.insertMany(batch);
    console.log(`Inserted ${batch.length} records`);
    batch = [];
  }
}

// Insert remaining records
if (batch.length > 0) {
  await db.insertMany(batch);
}
```

---

### Example 9: Progress Tracking

```typescript
import { parseStringStream } from 'web-csv-toolbox';

const response = await fetch('data.csv');
const contentLength = Number(response.headers.get('Content-Length'));

const textStream = response.body
  .pipeThrough(new TextDecoderStream());

let bytesRead = 0;
let recordCount = 0;

for await (const record of parseStringStream(textStream)) {
  recordCount++;
  bytesRead += JSON.stringify(record).length;

  if (recordCount % 100 === 0) {
    const progress = (bytesRead / contentLength) * 100;
    console.log(`Progress: ${progress.toFixed(1)}% (${recordCount} records)`);
  }
}
```

---

### Example 10: Error Handling

```typescript
import { parseStringStream } from 'web-csv-toolbox';

try {
  const response = await fetch('data.csv');
  const textStream = response.body
    .pipeThrough(new TextDecoderStream());

  for await (const record of parseStringStream(textStream)) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof ParseError) {
    console.error('Parse error:', error.message);
  } else if (error.name === 'AbortError') {
    console.log('Parsing cancelled');
  } else {
    console.error('Unknown error:', error);
  }
}
```

---

## Namespace Methods

### parseStringStream.toArray()

Convert the entire stream to an array of records.

```typescript
function toArray<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>
): Promise<CSVRecord<Header>[]>
```

**Example:**
```typescript
import { parseStringStream } from 'web-csv-toolbox';

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue('name,age\n');
    controller.enqueue('Alice,30\n');
    controller.close();
  }
});

const records = await parseStringStream.toArray(stream);
console.log(records);
// [{ name: 'Alice', age: '30' }]
```

⚠️ **Warning:** Defeats the purpose of streaming. Only use for small streams.

---

### parseStringStream.toStream()

Convert to a ReadableStream of records.

```typescript
function toStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<string>,
  options?: ParseOptions<Header>
): ReadableStream<CSVRecord<Header>>
```

**Example:**
```typescript
import { parseStringStream } from 'web-csv-toolbox';

const textStream = response.body
  .pipeThrough(new TextDecoderStream());

const recordStream = parseStringStream.toStream(textStream);

await recordStream.pipeTo(
  new WritableStream({
    write(record) {
      console.log(record);
    }
  })
);
```

---

## Performance Characteristics

### Memory Usage

**Always O(1) - constant per record**

This is the key advantage of `parseStringStream()`:

```typescript
// ✅ Constant memory usage
for await (const record of parseStringStream(stream)) {
  console.log(record);
  // Record can be garbage collected after processing
}

// ❌ Loads everything into memory
const records = await parseStringStream.toArray(stream);
```

**Memory profile:**
- Input stream chunks: Released after processing
- CSVLexer buffer: Small, constant size
- Record: Released after iteration
- **Total:** ~few KB regardless of file size

---

### Processing Speed

| File Size | Main Thread | Worker + Stream Transfer |
|-----------|-------------|--------------------------|
| 10MB | Baseline | Non-blocking |
| 100MB | Baseline | Non-blocking |
| 1GB | Baseline | Non-blocking |

**Notes:**
- Worker execution prevents UI blocking
- Processing speed is similar between main thread and worker
- Main benefit of worker is responsiveness, not raw speed

---

### Stream Strategies

#### stream-transfer (Recommended)

Zero-copy stream transfer to worker using Transferable Streams:

**Supported:** Chrome, Firefox, Edge
**Fallback:** Automatic on Safari (uses message-streaming)

**Example:**
```typescript
for await (const record of parseStringStream(stream, {
  engine: { worker: true, workerStrategy: 'stream-transfer' }
})) {
  console.log(record);
}
```

---

#### message-streaming

Records sent from worker via postMessage:

**Supported:** All browsers including Safari

**Example:**
```typescript
for await (const record of parseStringStream(stream, {
  engine: { worker: true, workerStrategy: 'message-streaming' }
})) {
  console.log(record);
}
```

---

## Comparison with Other APIs

### parseStringStream() vs parseString()

| Feature | `parseStringStream()` | `parseString()` |
|---------|----------------------|-----------------|
| **Input** | `ReadableStream<string>` | `string` |
| **Memory (small)** | O(1) | O(n) |
| **Memory (large)** | O(1) | O(n) |
| **Start latency** | Immediate | After loading |
| **Best for** | Large files, streams | Small to medium strings |

**Recommendation:** Use `parseStringStream()` for files >10MB or streaming sources.

---

### parseStringStream() vs parseUint8ArrayStream()

| Feature | `parseStringStream()` | `parseUint8ArrayStream()` |
|---------|----------------------|---------------------------|
| **Input** | `ReadableStream<string>` | `ReadableStream<Uint8Array>` |
| **Encoding** | Pre-decoded | Supports all charsets |
| **Compression** | Pre-decompressed | Supports gzip, deflate |
| **Use case** | Text streams | Binary streams |

**Recommendation:** Use `parseStringStream()` when you already have decoded text.

---

## Browser and Runtime Support

### Core Functionality

| Runtime | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ | Full support |
| Firefox | ✅ | Full support |
| Edge | ✅ | Full support |
| Safari | ✅ | Full support |
| Node.js 18+ | ✅ | Full support |
| Deno | ✅ | Full support |

### Worker Strategies

| Runtime | stream-transfer | message-streaming |
|---------|----------------|-------------------|
| Chrome | ✅ | ✅ |
| Firefox | ✅ | ✅ |
| Edge | ✅ | ✅ |
| Safari | ❌ (auto-fallback) | ✅ |
| Node.js 18+ | ✅ | ✅ |
| Deno | ✅ | ✅ |

**Note:** stream-transfer automatically falls back to message-streaming on Safari.

See: [Supported Environments](../supported-environments.md)

---

## Real-World Examples

### Example: CSV ETL Pipeline

```typescript
import { parseStringStream } from 'web-csv-toolbox';

async function csvETL(sourceURL: string, destDB: Database) {
  const response = await fetch(sourceURL);
  const textStream = response.body
    .pipeThrough(new TextDecoderStream());

  let processed = 0;
  const errors: any[] = [];

  for await (const record of parseStringStream(textStream)) {
    try {
      // Transform
      const transformed = {
        name: record.name?.trim(),
        age: Number(record.age),
        email: record.email?.toLowerCase()
      };

      // Validate
      if (!transformed.email?.includes('@')) {
        throw new Error('Invalid email');
      }

      // Load
      await destDB.insert(transformed);
      processed++;

      if (processed % 1000 === 0) {
        console.log(`Processed ${processed} records`);
      }
    } catch (error) {
      errors.push({ record, error: error.message });
    }
  }

  console.log(`Complete: ${processed} records, ${errors.length} errors`);
  return { processed, errors };
}
```

---

### Example: CSV API Endpoint (Hono)

```typescript
import { Hono } from 'hono';
import { parseStringStream, EnginePresets, ReusableWorkerPool } from 'web-csv-toolbox';

const app = new Hono();
const pool = new ReusableWorkerPool({ maxWorkers: 4 });

app.post('/validate-csv', async (c) => {
  // Early rejection if pool is saturated
  if (pool.isFull()) {
    return c.json({ error: 'Service busy' }, 503);
  }

  const textStream = c.req.raw.body
    ?.pipeThrough(new TextDecoderStream());

  if (!textStream) {
    return c.json({ error: 'No body' }, 400);
  }

  const results: any[] = [];
  const errors: any[] = [];

  try {
    for await (const record of parseStringStream(textStream, {
      engine: EnginePresets.balanced({
        workerPool: pool
      })
    })) {
      // Validate
      if (validateRecord(record)) {
        results.push(record);
      } else {
        errors.push(record);
      }
    }

    return c.json({
      success: true,
      valid: results.length,
      invalid: errors.length,
      errors: errors.slice(0, 10) // First 10 errors
    });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;
```

---

## Error Handling

### ParseError

```typescript
import { parseStringStream, ParseError } from 'web-csv-toolbox';

try {
  for await (const record of parseStringStream(stream)) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof ParseError) {
    console.error('Invalid CSV format:', error.message);
  }
}
```

---

### Stream Errors

```typescript
import { parseStringStream } from 'web-csv-toolbox';

const stream = new ReadableStream({
  start(controller) {
    controller.error(new Error('Stream error'));
  }
});

try {
  for await (const record of parseStringStream(stream)) {
    console.log(record);
  }
} catch (error) {
  console.error('Stream error:', error.message);
}
```

---

### AbortError

```typescript
import { parseStringStream } from 'web-csv-toolbox';

const controller = new AbortController();
setTimeout(() => controller.abort(), 1000);

try {
  for await (const record of parseStringStream(stream, {
    signal: controller.signal
  })) {
    console.log(record);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Parsing cancelled');
  }
}
```

---

## Related Documentation

- **[Choosing the Right API](../../how-to-guides/choosing-the-right-api.md)** - API selection guide
- **[parseString() API Reference](./parseString.md)** - String parser
- **[parseUint8ArrayStream() API Reference](./parseUint8ArrayStream.md)** - Binary stream parser
- **[Working with Workers](../../tutorials/working-with-workers.md)** - Worker threads guide

---

## Best Practices

### ✅ Do

- Use `parseStringStream()` for large files (>10MB)
- Use streaming iteration (`for await`) to maintain low memory
- Use Worker execution for non-blocking UI
- Process records immediately (don't accumulate)
- Use batch processing for database operations
- Handle stream errors with try-catch
- Use `AbortSignal` for cancellable operations

### ❌ Don't

- Don't use `toArray()` for large streams (defeats purpose)
- Don't accumulate all records in memory
- Don't ignore error handling
- Don't use for small strings (use `parseString()` instead)
- Don't expect WASM support (streams use JS only)

---

## Summary

`parseStringStream()` is the optimal choice for parsing large CSV text streams:

**Key Features:**
- ✅ O(1) memory usage per record
- ✅ Handles arbitrarily large files
- ✅ Worker execution with stream-transfer
- ✅ Processes data as it arrives
- ✅ Full TypeScript support
- ✅ Cancellable with AbortSignal

**When to use:**
- Large CSV files (>10MB)
- Streaming data sources (fetch, WebSocket, SSE)
- Memory-constrained environments
- Real-time data processing
- Node.js file streams

**When to avoid:**
- Small strings (<10MB) - use `parseString()` instead
- Binary data - use `parseUint8ArrayStream()` instead
- When you need all records at once - use `parseString()` with `toArray()`

**Memory advantage:**
```typescript
// 1GB file = 1GB memory with parseString()
// 1GB file = ~few KB memory with parseStringStream() ✅
```
