# parseResponse() API Reference

Parse HTTP Response containing CSV data with automatic header processing.

## Overview

`parseResponse()` is a middle-level API specifically designed for parsing CSV data from HTTP responses (e.g., `fetch()` results). It automatically handles response headers like `Content-Type`, `Content-Encoding`, and charset detection.

**Category:** Middle-level API (Production)

**Input:** `Response`

**Output:** `AsyncIterableIterator<CSVRecord<Header>>`

---

## Function Signature

```typescript
function parseResponse<Header extends ReadonlyArray<string>>(
  response: Response,
  options?: ParseOptions<Header>
): AsyncIterableIterator<CSVRecord<Header>>
```

---

## Parameters

### `response`

**Type:** `Response`

**Required:** Yes

The HTTP Response object to parse (typically from `fetch()`).

**Example:**
```typescript
const response = await fetch('https://example.com/data.csv');
```

**Requirements:**
- Must have non-null body (`response.body !== null`)
- Content-Type should be `text/csv` (auto-detected if not specified)

---

### `options`

**Type:** `ParseOptions<Header>`

**Required:** No

Parsing options to customize behavior. Options specified here override values from response headers.

```typescript
interface ParseOptions<Header> {
  // Parsing options
  delimiter?: string;           // Default: ','
  quotation?: string;           // Default: '"'

  // Header options
  headerList?: Header;          // Explicit header list

  // Binary options (relevant for Response)
  charset?: string;             // Default: from Content-Type header or 'utf-8'
  decomposition?: 'gzip' | 'deflate' | 'gzip, deflate';
  ignoreBOM?: boolean;          // Default: false

  // Resource limits
  maxBufferSize?: number;       // Default: 10485760 (10MB)

  // Execution strategy
  engine?: EngineConfig;        // Execution configuration

  // Abort control
  signal?: AbortSignal;         // Cancellation signal
}
```

#### Common Options

See [parseString() API Reference](./parseString.md#common-options) for common parsing options.

#### Binary-Specific Options

##### `charset`

**Type:** `string`

**Default:** Auto-detected from `Content-Type` header, falls back to `'utf-8'`

Character encoding of the response body.

**Supported encodings:** All encodings supported by the platform's TextDecoder API.

**Common values:**
- `'utf-8'` (default)
- `'shift-jis'` (Japanese)
- `'euc-jp'` (Japanese)
- `'iso-8859-1'` (Latin-1)
- `'windows-1252'`

**Example:**
```typescript
// Override charset from header
for await (const record of parseResponse(response, {
  charset: 'shift-jis'
})) {
  console.log(record);
}
```

---

##### `decomposition`

**Type:** `'gzip' | 'deflate' | 'gzip, deflate'`

**Default:** Auto-detected from `Content-Encoding` header

Decompression algorithm to apply.

**Example:**
```typescript
// Force gzip decompression
for await (const record of parseResponse(response, {
  decomposition: 'gzip'
})) {
  console.log(record);
}
```

**Note:** Usually auto-detected from `Content-Encoding` header. Manual override rarely needed.

---

##### `ignoreBOM`

**Type:** `boolean`

**Default:** `false`

Whether to ignore Byte Order Mark (BOM) at the beginning of the file.

**Example:**
```typescript
// Ignore BOM if present
for await (const record of parseResponse(response, {
  ignoreBOM: true
})) {
  console.log(record);
}
```

---

## Returns

`AsyncIterableIterator<CSVRecord<Header>>`

An async iterable iterator that yields CSV records one by one.

**Type:**
```typescript
type CSVRecord<Header extends ReadonlyArray<string>> = {
  [K in Header[number]]: string | undefined;
};
```

---

## Automatic Header Processing

`parseResponse()` automatically processes HTTP response headers:

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
- Automatically decompresses using browser/runtime DecompressionStream

**Supported values:**
- `gzip`
- `deflate`
- `gzip, deflate` (multiple encodings)

**Example headers:**
```
Content-Encoding: gzip
Content-Encoding: deflate
```

---

### Header Precedence

Options specified in `options` parameter take precedence over response headers:

```typescript
const response = await fetch('data.csv');
// Response header: Content-Type: text/csv; charset=utf-8

// Override with shift-jis
for await (const record of parseResponse(response, {
  charset: 'shift-jis' // Takes precedence over header
})) {
  console.log(record);
}
```

---

## Usage Examples

### Example 1: Basic Usage

```typescript
import { parseResponse } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv');

for await (const record of parseResponse(response)) {
  console.log(record);
}
```

---

### Example 2: With Custom Options

```typescript
import { parseResponse } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.tsv');

for await (const record of parseResponse(response, {
  delimiter: '\t',
  headerList: ['name', 'age', 'city']
})) {
  console.log(record);
}
```

---

### Example 3: Compressed CSV (Automatic)

```typescript
import { parseResponse } from 'web-csv-toolbox';

// Response with Content-Encoding: gzip
const response = await fetch('https://example.com/data.csv.gz');

// Automatically decompressed
for await (const record of parseResponse(response)) {
  console.log(record);
}
```

---

### Example 4: Non-UTF-8 Encoding (Automatic)

```typescript
import { parseResponse } from 'web-csv-toolbox';

// Response with Content-Type: text/csv; charset=shift-jis
const response = await fetch('https://example.com/data-jp.csv');

// Automatically decoded as Shift-JIS
for await (const record of parseResponse(response)) {
  console.log(record);
}
```

---

### Example 5: Override Charset

```typescript
import { parseResponse } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv');

// Force Shift-JIS decoding
for await (const record of parseResponse(response, {
  charset: 'shift-jis'
})) {
  console.log(record);
}
```

---

### Example 6: With TypeScript Headers

```typescript
import { parseResponse } from 'web-csv-toolbox';

type Header = ['name', 'age', 'email'];

const response = await fetch('https://example.com/users.csv');

for await (const record of parseResponse<Header>(response)) {
  // TypeScript knows: record.name, record.age, record.email
  console.log(`${record.name}: ${record.email}`);
}
```

---

### Example 7: With AbortSignal

```typescript
import { parseResponse } from 'web-csv-toolbox';

const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetch('https://example.com/large-data.csv', {
    signal: controller.signal
  });

  for await (const record of parseResponse(response, {
    signal: controller.signal
  })) {
    console.log(record);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Download/parsing cancelled');
  }
}
```

---

### Example 8: Error Handling

```typescript
import { parseResponse } from 'web-csv-toolbox';

try {
  const response = await fetch('https://example.com/data.csv');

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  for await (const record of parseResponse(response)) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof TypeError) {
    console.error('Invalid response:', error.message);
  } else {
    console.error('Error:', error);
  }
}
```

---

### Example 9: Collecting to Array

```typescript
import { parseResponse } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv');
const records = await parseResponse.toArray(response);

console.log(`Loaded ${records.length} records`);
console.log(records);
```

---

### Example 10: Streaming to Database

```typescript
import { parseResponse } from 'web-csv-toolbox';

const response = await fetch('https://example.com/large-data.csv');

let count = 0;
const batch: any[] = [];
const BATCH_SIZE = 1000;

for await (const record of parseResponse(response)) {
  batch.push(record);

  if (batch.length >= BATCH_SIZE) {
    await db.insertMany(batch);
    count += batch.length;
    batch.length = 0;
    console.log(`Inserted ${count} records...`);
  }
}

// Insert remaining records
if (batch.length > 0) {
  await db.insertMany(batch);
  count += batch.length;
}

console.log(`Total: ${count} records`);
```

---

## Namespace Methods

### parseResponse.toArray()

Convert the entire response to an array of records.

```typescript
function toArray<Header extends ReadonlyArray<string>>(
  response: Response,
  options?: ParseOptions<Header>
): Promise<CSVRecord<Header>[]>
```

**Example:**
```typescript
import { parseResponse } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv');
const records = await parseResponse.toArray(response);

console.log(records);
// [
//   { name: 'Alice', age: '30' },
//   { name: 'Bob', age: '25' }
// ]
```

⚠️ **Warning:** Loads entire result into memory. Not suitable for very large files.

---

### parseResponse.toStream()

Convert response to a ReadableStream of records.

```typescript
function toStream<Header extends ReadonlyArray<string>>(
  response: Response,
  options?: ParseOptions<Header>
): ReadableStream<CSVRecord<Header>>
```

**Example:**
```typescript
import { parseResponse } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv');
const stream = parseResponse.toStream(response);

await stream.pipeTo(
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

- **Streaming (default):** O(1) - constant per record
- **toArray():** O(n) - proportional to file size

**Recommendation:** Always use streaming for remote files to minimize memory usage.

---

### Network and Processing

`parseResponse()` processes data as it arrives from the network:

```
Network → Decompress (if needed) → Decode (charset) → Parse → Yield records
   ↓           ↓                      ↓                ↓           ↓
Streaming  Streaming              Streaming        Streaming   Streaming
```

**Benefits:**
- Start processing before entire download completes
- Constant memory usage regardless of file size
- Can handle arbitrarily large files

---

## Error Handling

### TypeError - Null Response Body

```typescript
import { parseResponse } from 'web-csv-toolbox';

const response = new Response(null);

try {
  for await (const record of parseResponse(response)) {
    console.log(record);
  }
} catch (error) {
  console.error(error.message);
  // "Response body is null"
}
```

---

### TypeError - Invalid Content-Type

```typescript
import { parseResponse } from 'web-csv-toolbox';

// Response with Content-Type: application/json
const response = await fetch('https://example.com/data.json');

try {
  for await (const record of parseResponse(response)) {
    console.log(record);
  }
} catch (error) {
  console.error('Invalid Content-Type:', error.message);
}
```

---

### Network Errors

```typescript
import { parseResponse } from 'web-csv-toolbox';

try {
  const response = await fetch('https://invalid-domain.example/data.csv');

  for await (const record of parseResponse(response)) {
    console.log(record);
  }
} catch (error) {
  console.error('Network error:', error.message);
}
```

---

### AbortError

```typescript
import { parseResponse } from 'web-csv-toolbox';

const controller = new AbortController();
setTimeout(() => controller.abort(), 1000);

try {
  const response = await fetch('https://example.com/data.csv', {
    signal: controller.signal
  });

  for await (const record of parseResponse(response, {
    signal: controller.signal
  })) {
    console.log(record);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request cancelled');
  }
}
```

---

## Comparison with Other APIs

### parseResponse() vs parse()

| Feature | `parseResponse()` | `parse()` |
|---------|------------------|-----------|
| **Input type** | `Response` only | Any (auto-detect) |
| **Header processing** | Automatic | Automatic (when Response) |
| **Type detection** | None | Yes (slight overhead) |
| **Performance** | Optimal | Slightly slower |
| **Use case** | Production (fetch) | Learning, prototyping |

**Recommendation:** Use `parseResponse()` in production when working with fetch results.

---

### parseResponse() vs parseUint8ArrayStream()

| Feature | `parseResponse()` | `parseUint8ArrayStream()` |
|---------|------------------|---------------------------|
| **Input type** | `Response` | `ReadableStream<Uint8Array>` |
| **Header processing** | Automatic | Manual |
| **Charset detection** | Automatic | Manual |
| **Decompression** | Automatic | Manual |
| **Use case** | HTTP responses | Generic binary streams |

**Recommendation:** Use `parseResponse()` for fetch results, `parseUint8ArrayStream()` for other binary streams.

---

## Real-World Examples

### Example: CSV API Endpoint

```typescript
import { parseResponse } from 'web-csv-toolbox';

async function fetchUserData(apiKey: string) {
  const response = await fetch('https://api.example.com/users.csv', {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const users = [];
  for await (const record of parseResponse(response)) {
    users.push({
      name: record.name,
      email: record.email,
      age: Number(record.age)
    });
  }

  return users;
}
```

---

### Example: Download Progress Tracking

```typescript
import { parseResponse } from 'web-csv-toolbox';

async function downloadWithProgress(url: string) {
  const response = await fetch(url);
  const contentLength = Number(response.headers.get('Content-Length'));

  let downloaded = 0;
  let recordCount = 0;

  for await (const record of parseResponse(response)) {
    recordCount++;
    downloaded += JSON.stringify(record).length;

    const progress = (downloaded / contentLength) * 100;
    console.log(`Progress: ${progress.toFixed(1)}% (${recordCount} records)`);
  }

  console.log(`Complete: ${recordCount} records`);
}
```

---

### Example: Retry Logic

```typescript
import { parseResponse } from 'web-csv-toolbox';

async function fetchWithRetry(url: string, maxRetries = 3) {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const records = [];
      for await (const record of parseResponse(response)) {
        records.push(record);
      }

      return records;
    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${i + 1} failed:`, error.message);

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  throw lastError;
}
```

---

## Browser and Runtime Support

`parseResponse()` is supported across all environments with fetch support:

| Runtime | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ | Full support |
| Firefox | ✅ | Full support |
| Edge | ✅ | Full support |
| Safari | ✅ | Full support |
| Node.js 18+ | ✅ | Built-in fetch |
| Deno | ✅ | Built-in fetch |

**Required APIs:**
- `fetch()` / `Response`
- `DecompressionStream` (for compressed responses)
- `TextDecoder` (for charset conversion)

See: [Supported Environments](../supported-environments.md)

---

## Related Documentation

- **[Choosing the Right API](../../how-to-guides/choosing-the-right-api.md)** - API selection guide
- **[parse() API Reference](./parse.md)** - High-level universal API
- **[parseUint8ArrayStream() API Reference](./parseUint8ArrayStream.md)** - Binary stream parser
- **[Secure CSV Processing](../../how-to-guides/secure-csv-processing.md)** - Security best practices

---

## Best Practices

### ✅ Do

- Use `parseResponse()` for all fetch results
- Let automatic header processing handle charset/encoding
- Use streaming iteration for large files
- Check `response.ok` before parsing
- Handle network errors with try-catch
- Use `AbortSignal` for cancellable requests
- Implement retry logic for critical operations

### ❌ Don't

- Don't manually extract charset from headers (automatic)
- Don't manually decompress (automatic)
- Don't use `toArray()` for very large responses
- Don't ignore error handling
- Don't forget to check response status
- Don't parse non-CSV responses

---

## Summary

`parseResponse()` is the optimal choice for parsing CSV data from HTTP responses:

**Key Features:**
- ✅ Automatic Content-Type handling
- ✅ Automatic Content-Encoding decompression
- ✅ Automatic charset detection and conversion
- ✅ Streaming for memory efficiency
- ✅ Full TypeScript support
- ✅ Works with standard fetch API

**When to use:**
- Fetching CSV from HTTP/HTTPS endpoints
- Working with remote CSV files
- APIs that return CSV data
- Any `fetch()` result containing CSV

**When to avoid:**
- Local files - use `parseBinary()` or `parseString()` instead
- Non-HTTP data sources - use appropriate parser
- When you need manual control over decompression - use `parseUint8ArrayStream()`

**Automatic features save you from:**
- Manually checking Content-Type
- Manually detecting charset
- Manually decompressing gzip/deflate
- Manually handling BOM
