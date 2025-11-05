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
