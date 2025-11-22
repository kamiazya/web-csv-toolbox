---
title: Node.js - HTTP Requests
group: Platform Usage
---

# HTTP Requests

Parse CSV from HTTP requests using Node.js built-in fetch.

```typescript
import { parseResponse } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv');

let count = 0;
for await (const record of parseResponse(response)) {
  // Process record (e.g., save to database, validate, etc.)
  console.log(record);
  count++;
}

console.log(`Fetched ${count} records`);
```

**With error handling and custom headers:**

```typescript
import { parseResponse } from 'web-csv-toolbox';

async function fetchCSV(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MyApp/1.0',
        'Authorization': 'Bearer token'
      }
    });

    // Check HTTP status
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (response.body === null) {
      throw new Error('Response has no body');
    }

    let count = 0;
    for await (const record of parseResponse(response)) {
      // Process record (e.g., save to database, validate, etc.)
      console.log(record);
      count++;
    }

    console.log(`Fetched ${count} records`);
  } catch (error) {
    console.error('Failed to fetch CSV:', error);
    throw error;
  }
}

await fetchCSV('https://example.com/data.csv');
```

## Automatic Header Processing

`parseResponse()` automatically processes HTTP response headers to handle character encoding and compression without manual configuration.

### Content-Type Header (Charset Detection)

The `Content-Type` header is automatically parsed to detect the character encoding:

```typescript
import { parseResponse } from 'web-csv-toolbox';

// Server responds with: Content-Type: text/csv; charset=utf-8
const response = await fetch('https://example.com/data.csv');

if (!response.ok) {
  throw new Error(`HTTP error: ${response.status}`);
}

// Charset automatically detected from header
for await (const record of parseResponse(response)) {
  console.log(record);
}
```

**Supported header formats:**
- `Content-Type: text/csv`
- `Content-Type: text/csv; charset=utf-8`
- `Content-Type: text/csv; charset=shift-jis`
- `Content-Type: text/csv;charset=utf-8` (no space)

**Override charset if needed:**

```typescript
// Force specific charset regardless of header
for await (const record of parseResponse(response, {
  charset: 'shift-jis'
})) {
  console.log(record);
}
```

### Content-Encoding Header (Decompression)

The `Content-Encoding` header is automatically processed to decompress the response:

```typescript
import { parseResponse } from 'web-csv-toolbox';

// Server responds with: Content-Encoding: gzip
const response = await fetch('https://example.com/data.csv.gz', {
  headers: {
    'Accept-Encoding': 'gzip, deflate'
  }
});

if (!response.ok) {
  throw new Error(`HTTP error: ${response.status}`);
}

// Automatic decompression based on header
for await (const record of parseResponse(response)) {
  console.log(record);
}
```

**Supported encodings:**
- `gzip`
- `deflate`

**Override decompression if needed:**

```typescript
// Force specific decompression regardless of header
for await (const record of parseResponse(response, {
  decompression: 'gzip'
})) {
  console.log(record);
}
```

**Note:** Only single compression format is supported. For multiple encodings (e.g., `Content-Encoding: gzip, deflate`), manually apply multi-stage `DecompressionStream`.

### Complete Example with Header Processing

```typescript
import { parseResponse } from 'web-csv-toolbox';

async function fetchCompressedCSV(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/csv',
        'Accept-Encoding': 'gzip, deflate',
        'User-Agent': 'MyApp/1.0'
      }
    });

    // Check HTTP status
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (response.body === null) {
      throw new Error('Response has no body');
    }

    // Log detected headers (for debugging)
    console.log('Content-Type:', response.headers.get('content-type'));
    console.log('Content-Encoding:', response.headers.get('content-encoding'));

    // parseResponse() automatically:
    // 1. Detects charset from Content-Type header
    // 2. Decompresses based on Content-Encoding header
    let count = 0;
    for await (const record of parseResponse(response)) {
      console.log(record);
      count++;
    }

    console.log(`Successfully fetched ${count} records`);
  } catch (error) {
    console.error('Failed to fetch CSV:', error);
    throw error;
  }
}

// Usage
await fetchCompressedCSV('https://example.com/data.csv.gz');
```
