---
title: Browser - Fetch API
group: Platform Usage
---

# Fetch API

Parse CSV files from remote URLs.

```typescript
import { parseResponse } from 'web-csv-toolbox';

async function loadRemoteCSV(url: string) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let count = 0;

    // Parse directly from Response
    for await (const record of parseResponse(response)) {
      // Process record (e.g., display, save, validate, etc.)
      console.log(record);
      count++;
    }

    console.log(`Loaded ${count} records from ${url}`);
  } catch (error) {
    console.error('Failed to load CSV:', error);
    throw error;
  }
}

// Usage
await loadRemoteCSV('https://example.com/data.csv');
```

**With progress tracking:**

```typescript
import { parseResponse } from 'web-csv-toolbox';

async function loadWithProgress(
  url: string,
  onProgress: (recordCount: number, bytesLoaded?: number, bytesTotal?: number) => void
) {
  const response = await fetch(url);

  // Get total bytes from Content-Length header (if available)
  const contentLength = response.headers.get('content-length');
  const totalBytes = contentLength ? parseInt(contentLength) : undefined;

  // Track bytes using a custom stream
  let bytesLoaded = 0;
  const trackingStream = new TransformStream({
    transform(chunk, controller) {
      bytesLoaded += chunk.length;
      controller.enqueue(chunk);
    }
  });

  // Clone response for tracking
  const trackedResponse = new Response(
    response.body!.pipeThrough(trackingStream),
    response
  );

  // Parse and count records
  let recordCount = 0;

  for await (const record of parseResponse(trackedResponse)) {
    // Process record (e.g., display, save, validate, etc.)
    recordCount++;

    // Report progress (bytes and record count)
    onProgress(recordCount, bytesLoaded, totalBytes);
  }
}

// Usage
await loadWithProgress(
  'https://example.com/data.csv',
  (recordCount, bytesLoaded, bytesTotal) => {
    if (bytesTotal) {
      const percent = ((bytesLoaded! / bytesTotal) * 100).toFixed(1);
      console.log(`Progress: ${percent}% (${recordCount} records, ${bytesLoaded}/${bytesTotal} bytes)`);
    } else {
      console.log(`Progress: ${recordCount} records (${bytesLoaded} bytes loaded)`);
    }
  }
);
```

**Simpler version (record count only):**

```typescript
import { parseResponse } from 'web-csv-toolbox';

async function loadWithRecordCount(url: string, onProgress: (count: number) => void) {
  const response = await fetch(url);

  let count = 0;

  for await (const record of parseResponse(response)) {
    // Process record (e.g., display, save, validate, etc.)
    count++;

    // Report every 100 records to avoid too many updates
    if (count % 100 === 0) {
      onProgress(count);
    }
  }

  // Final update
  onProgress(count);
}

// Usage
await loadWithRecordCount('https://example.com/data.csv', (count) => {
  console.log(`Loaded ${count} records...`);
});
```

## Automatic Header Processing

`parseResponse()` automatically processes HTTP response headers to handle character encoding and compression without manual configuration.

### Content-Type Header (Charset Detection)

The `Content-Type` header is automatically parsed to detect the character encoding:

```typescript
import { parseResponse } from 'web-csv-toolbox';

// Server responds with: Content-Type: text/csv; charset=utf-8
const response = await fetch('https://example.com/data.csv');

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
const response = await fetch('https://example.com/data.csv.gz');

// Automatic decompression based on header
for await (const record of parseResponse(response)) {
  console.log(record);
}
```

> **Note:** Browsers automatically handle `Accept-Encoding` request headers - you cannot set this header from JavaScript in browser contexts as it's a [forbidden header name](https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_header_name). The browser automatically sends appropriate compression preferences to the server. The `Accept-Encoding` header is mainly relevant in server-side or non-browser environments (Node.js, Deno, Bun) where you have full control over request headers.

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
        'Accept': 'text/csv'
        // Note: Accept-Encoding is automatically handled by the browser
      }
    });

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

    console.log(`Successfully loaded ${count} records`);
  } catch (error) {
    console.error('Failed to fetch CSV:', error);
    throw error;
  }
}

// Usage
await fetchCompressedCSV('https://example.com/data.csv.gz');
```
