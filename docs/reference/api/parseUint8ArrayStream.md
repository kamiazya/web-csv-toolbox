# parseUint8ArrayStream() API Reference

Parse binary CSV streams with support for multiple encodings, compression, and constant memory usage.

## Overview

`parseUint8ArrayStream()` is a middle-level API optimized for parsing CSV data from binary streams (`ReadableStream<Uint8Array>`). It provides true streaming processing with O(1) memory usage, supports all character encodings, compression, and BOM handling.

**Category:** Middle-level API (Production)

**Input:** `ReadableStream<Uint8Array>`

**Output:** `AsyncIterableIterator<CSVRecord<Header>>`

---

## Function Signature

```typescript
function parseUint8ArrayStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header>
): AsyncIterableIterator<CSVRecord<Header>>
```

---

## Parameters

### `stream`

**Type:** `ReadableStream<Uint8Array>`

**Required:** Yes

A readable stream of binary CSV data chunks.

**Example:**
```typescript
// From fetch (binary)
const response = await fetch('data.csv');
const binaryStream = response.body; // ReadableStream<Uint8Array>

// From Node.js file stream
import { createReadStream } from 'fs';
import { Readable } from 'stream';

const nodeStream = createReadStream('data.csv');
const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

// From File API
const file = document.querySelector('input[type="file"]').files[0];
const binaryStream = file.stream();
```

---

### `options`

**Type:** `ParseBinaryOptions<Header>`

**Required:** No

Parsing options including binary-specific settings.

```typescript
interface ParseBinaryOptions<Header> extends ParseOptions<Header> {
  // Binary-specific options
  charset?: string;              // Default: 'utf-8'
  decompression?: 'gzip' | 'deflate' | 'gzip, deflate';
  ignoreBOM?: boolean;           // Default: false

  // Common parsing options
  delimiter?: string;            // Default: ','
  quotation?: string;            // Default: '"'
  headerList?: Header;
  maxBufferSize?: number;        // Default: 10485760 (10MB)
  engine?: EngineConfig;
  signal?: AbortSignal;
}
```

See [parseBinary() API Reference](./parseBinary.md#binary-specific-options) for detailed descriptions of binary-specific options.

---

## Returns

`AsyncIterableIterator<CSVRecord<Header>>`

An async iterable iterator that yields CSV records as they are parsed from the stream.

---

## Usage Examples

### Example 1: Basic Usage (UTF-8)

```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv');
const binaryStream = response.body;

for await (const record of parseUint8ArrayStream(binaryStream)) {
  console.log(record);
}
```

---

### Example 2: From File Upload (Large File)

```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';

async function handleLargeFileUpload(file: File) {
  const binaryStream = file.stream();

  for await (const record of parseUint8ArrayStream(binaryStream, {
    charset: 'utf-8',
    ignoreBOM: true
  })) {
    console.log(record);
  }
}

document.querySelector('#file-input')
  .addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) handleLargeFileUpload(file);
  });
```

---

### Example 3: Compressed CSV (gzip)

```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';

const response = await fetch('https://example.com/large-data.csv.gz');
const binaryStream = response.body;

// Automatically decompresses while streaming
for await (const record of parseUint8ArrayStream(binaryStream, {
  decompression: 'gzip'
})) {
  console.log(record);
}
```

---

### Example 4: Non-UTF-8 Encoding (Shift-JIS)

```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data-jp.csv');
const binaryStream = response.body;

for await (const record of parseUint8ArrayStream(binaryStream, {
  charset: 'shift-jis',
  ignoreBOM: true
})) {
  console.log(record);
}
```

---

### Example 5: From Node.js File Stream

```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

const nodeStream = createReadStream('large-file.csv');
const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

for await (const record of parseUint8ArrayStream(webStream, {
  charset: 'utf-8'
})) {
  console.log(record);
}
```

---

### Example 6: With Worker (Non-blocking)

```typescript
import { parseUint8ArrayStream, EnginePresets } from 'web-csv-toolbox';

const response = await fetch('large-data.csv');
const binaryStream = response.body;

// Non-blocking parsing in worker
for await (const record of parseUint8ArrayStream(binaryStream, {
  charset: 'utf-8',
  engine: EnginePresets.memoryEfficient()
})) {
  console.log(record);
  // UI stays responsive!
}
```

---

### Example 7: Progress Tracking

```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';

const response = await fetch('large-data.csv');
const contentLength = Number(response.headers.get('Content-Length'));
const binaryStream = response.body;

let bytesRead = 0;
let recordCount = 0;

for await (const record of parseUint8ArrayStream(binaryStream)) {
  recordCount++;
  bytesRead += JSON.stringify(record).length;

  if (recordCount % 100 === 0) {
    const progress = (bytesRead / contentLength) * 100;
    console.log(`Progress: ${progress.toFixed(1)}% (${recordCount} records)`);
  }
}
```

---

### Example 8: Batch Database Insert

```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';

const response = await fetch('large-data.csv');
const binaryStream = response.body;

const BATCH_SIZE = 1000;
let batch: any[] = [];
let totalInserted = 0;

for await (const record of parseUint8ArrayStream(binaryStream, {
  charset: 'utf-8'
})) {
  batch.push(record);

  if (batch.length >= BATCH_SIZE) {
    await db.insertMany(batch);
    totalInserted += batch.length;
    console.log(`Inserted ${totalInserted} records...`);
    batch = [];
  }
}

// Insert remaining records
if (batch.length > 0) {
  await db.insertMany(batch);
  totalInserted += batch.length;
}

console.log(`Total: ${totalInserted} records inserted`);
```

---

### Example 9: With AbortSignal

```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';

const controller = new AbortController();
setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

try {
  const response = await fetch('data.csv', {
    signal: controller.signal
  });

  for await (const record of parseUint8ArrayStream(response.body, {
    charset: 'utf-8',
    signal: controller.signal
  })) {
    console.log(record);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Parsing cancelled due to timeout');
  }
}
```

---

### Example 10: Error Recovery

```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';

async function parseWithErrorRecovery(url: string) {
  const response = await fetch(url);
  const binaryStream = response.body;

  const validRecords: any[] = [];
  const errors: any[] = [];

  try {
    for await (const record of parseUint8ArrayStream(binaryStream, {
      charset: 'utf-8'
    })) {
      try {
        // Validate record
        if (validateRecord(record)) {
          validRecords.push(record);
        } else {
          errors.push({ record, reason: 'Validation failed' });
        }
      } catch (error) {
        errors.push({ record, error: error.message });
      }
    }
  } catch (error) {
    console.error('Stream parsing failed:', error);
  }

  return { validRecords, errors };
}
```

---

## Namespace Methods

### parseUint8ArrayStream.toArray()

Convert the entire stream to an array of records.

```typescript
function toArray<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header>
): Promise<CSVRecord<Header>[]>
```

**Example:**
```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';

const response = await fetch('data.csv');
const records = await parseUint8ArrayStream.toArray(response.body, {
  charset: 'utf-8'
});

console.log(records);
```

⚠️ **Warning:** Defeats the purpose of streaming. Only use for small streams.

---

### parseUint8ArrayStream.toStream()

Convert to a ReadableStream of records.

```typescript
function toStream<Header extends ReadonlyArray<string>>(
  stream: ReadableStream<Uint8Array>,
  options?: ParseBinaryOptions<Header>
): ReadableStream<CSVRecord<Header>>
```

**Example:**
```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';

const response = await fetch('data.csv');
const recordStream = parseUint8ArrayStream.toStream(response.body, {
  charset: 'utf-8'
});

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

This is the key advantage of streaming:

```typescript
// ✅ Constant memory usage (a few KB)
for await (const record of parseUint8ArrayStream(stream)) {
  console.log(record);
  // Record released after processing
}

// ❌ Loads everything into memory (N MB)
const records = await parseUint8ArrayStream.toArray(stream);
```

**Memory profile:**
- Input stream chunks: Released after processing
- Decompression buffer (if used): Small, constant size
- Decoder buffer: Small, constant size
- CSVLexer buffer: Small, constant size (~10MB max)
- Record: Released after iteration
- **Total:** Few MB maximum, regardless of file size

---

### Processing Pipeline

All stages operate in streaming fashion:

```
Binary Stream → Decompress → Decode → Parse → Yield records
      ↓            ↓           ↓        ↓           ↓
  Streaming    Streaming   Streaming Streaming  Streaming
```

**Benefits:**
- Start processing immediately (no waiting for full download)
- Constant memory usage
- Can handle arbitrarily large files
- Early error detection

---

### Decompression Performance

| Compression | Decompression Speed | Memory Overhead |
|-------------|---------------------|-----------------|
| None | N/A | None |
| gzip | Platform-optimized | ~few KB |
| deflate | Platform-optimized | ~few KB |

**Note:** Decompression is handled by platform's `DecompressionStream` API.

---

## Comparison with Other APIs

### parseUint8ArrayStream() vs parseBinary()

| Feature | `parseUint8ArrayStream()` | `parseBinary()` |
|---------|---------------------------|-----------------|
| **Input** | `ReadableStream<Uint8Array>` | `Uint8Array`, `ArrayBuffer` |
| **Memory (small)** | O(1) | O(n) |
| **Memory (large)** | O(1) | O(n) |
| **Start latency** | Immediate | After loading |
| **Best for** | Large files, streams | Small to medium files |

**Recommendation:** Use `parseUint8ArrayStream()` for files >10MB.

---

### parseUint8ArrayStream() vs parseStringStream()

| Feature | `parseUint8ArrayStream()` | `parseStringStream()` |
|---------|---------------------------|----------------------|
| **Input** | `ReadableStream<Uint8Array>` | `ReadableStream<string>` |
| **Encoding support** | All (via charset) | Pre-decoded only |
| **Compression** | Yes (gzip, deflate) | Pre-decompressed |
| **BOM handling** | Yes | No |
| **Use case** | Binary streams | Text streams |

**Recommendation:** Use `parseUint8ArrayStream()` when you have binary data or need encoding/compression support.

---

### parseUint8ArrayStream() vs parseResponse()

| Feature | `parseUint8ArrayStream()` | `parseResponse()` |
|---------|---------------------------|------------------|
| **Input** | `ReadableStream<Uint8Array>` | `Response` |
| **Header processing** | Manual | Automatic |
| **Charset detection** | Manual | Automatic |
| **Use case** | Generic streams | HTTP responses |

**Recommendation:** Use `parseResponse()` for fetch results, `parseUint8ArrayStream()` for other binary streams.

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

### Required APIs

- `ReadableStream` - Universal support
- `TextDecoder` - Charset conversion
- `DecompressionStream` - For compressed streams (widely supported)

See: [Supported Environments](../supported-environments.md)

---

## Real-World Examples

### Example: CSV Import Service

```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';

async function importCSVToDatabase(
  file: File,
  tableName: string,
  db: Database
) {
  const stream = file.stream();
  let imported = 0;
  let failed = 0;
  const errors: any[] = [];

  try {
    for await (const record of parseUint8ArrayStream(stream, {
      charset: 'utf-8',
      ignoreBOM: true
    })) {
      try {
        await db.insert(tableName, record);
        imported++;

        if (imported % 1000 === 0) {
          console.log(`Imported ${imported} records...`);
        }
      } catch (error) {
        failed++;
        errors.push({ record, error: error.message });

        if (errors.length > 100) {
          throw new Error('Too many errors, aborting import');
        }
      }
    }

    return {
      success: true,
      imported,
      failed,
      errors: errors.slice(0, 10) // First 10 errors
    };
  } catch (error) {
    return {
      success: false,
      imported,
      failed,
      error: error.message,
      errors
    };
  }
}
```

---

### Example: Multi-Encoding Detection

```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';

async function detectEncoding(stream: ReadableStream<Uint8Array>) {
  const encodings = ['utf-8', 'shift-jis', 'euc-jp', 'iso-2022-jp'];

  for (const charset of encodings) {
    try {
      // Clone stream for each attempt
      const [stream1, stream2] = stream.tee();
      stream = stream2;

      const records = [];
      for await (const record of parseUint8ArrayStream(stream1, { charset })) {
        records.push(record);
        if (records.length >= 10) break; // Test with first 10 records
      }

      // Heuristic: Check if records look valid
      const hasValidData = records.every(r =>
        Object.values(r).every(v => typeof v === 'string' && v.length > 0)
      );

      if (hasValidData) {
        console.log(`Detected encoding: ${charset}`);
        return charset;
      }
    } catch (error) {
      console.log(`Failed with ${charset}`);
    }
  }

  throw new Error('Could not detect encoding');
}
```

---

## Error Handling

### ParseError

```typescript
import { parseUint8ArrayStream, ParseError } from 'web-csv-toolbox';

try {
  for await (const record of parseUint8ArrayStream(stream)) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof ParseError) {
    console.error('Invalid CSV format:', error.message);
  }
}
```

---

### Encoding Errors

```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';

try {
  for await (const record of parseUint8ArrayStream(stream, {
    charset: 'utf-8' // Assuming UTF-8
  })) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof TypeError) {
    console.error('Encoding error (might be wrong charset):', error.message);
  }
}
```

---

### Stream Errors

```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';

const stream = new ReadableStream({
  start(controller) {
    controller.error(new Error('Network failure'));
  }
});

try {
  for await (const record of parseUint8ArrayStream(stream)) {
    console.log(record);
  }
} catch (error) {
  console.error('Stream error:', error.message);
}
```

---

## Related Documentation

- **[Choosing the Right API](../../how-to-guides/choosing-the-right-api.md)** - API selection guide
- **[parseBinary() API Reference](./parseBinary.md)** - Binary data parser
- **[parseStringStream() API Reference](./parseStringStream.md)** - Text stream parser
- **[parseResponse() API Reference](./parseResponse.md)** - Response parser
- **[Secure CSV Processing](../../how-to-guides/secure-csv-processing.md)** - Security best practices

---

## Best Practices

### ✅ Do

- Use `parseUint8ArrayStream()` for large binary files (>10MB)
- Specify correct `charset` for non-UTF-8 files
- Use streaming iteration to maintain low memory
- Process records immediately (don't accumulate)
- Use batch processing for database operations
- Set `ignoreBOM: true` when BOM is expected
- Handle encoding errors gracefully
- Use Worker execution for non-blocking UI

### ❌ Don't

- Don't use `toArray()` for large streams (defeats purpose)
- Don't accumulate all records in memory
- Don't guess encodings - detect or ask user
- Don't ignore error handling
- Don't use for small files (<10MB) - use `parseBinary()` instead
- Don't use for pre-decoded text - use `parseStringStream()` instead

---

## Summary

`parseUint8ArrayStream()` is the optimal choice for parsing large binary CSV streams:

**Key Features:**
- ✅ O(1) memory usage per record
- ✅ Handles arbitrarily large files
- ✅ Multiple character encoding support
- ✅ Built-in decompression (gzip, deflate)
- ✅ Automatic BOM handling
- ✅ Worker execution support
- ✅ Full TypeScript support

**When to use:**
- Large binary CSV files (>10MB)
- File uploads via File API (file.stream())
- Node.js file streams
- Compressed CSV files (.csv.gz)
- Non-UTF-8 encoded streams
- Memory-constrained environments

**When to avoid:**
- Small files (<10MB) - use `parseBinary()` instead
- Pre-decoded text streams - use `parseStringStream()` instead
- HTTP responses - use `parseResponse()` instead

**Memory advantage:**
```typescript
// 1GB file = 1GB memory with parseBinary()
// 1GB file = ~few MB memory with parseUint8ArrayStream() ✅
```

**Streaming pipeline:**
```
Binary Stream → Decompress → Decode (charset) → Parse → Yield
     All stages operate in streaming fashion with constant memory
```
