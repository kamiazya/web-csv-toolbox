# File System Streams

Convert Node.js `fs.ReadStream` to Web Streams API.

```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';

// Create Node.js read stream
const nodeStream = createReadStream('data.csv');

// Convert to Web ReadableStream (Node.js 18+)
const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

// Parse from web stream
let count = 0;
for await (const record of parseUint8ArrayStream(webStream)) {
  // Process record (e.g., save to database, validate, etc.)
  console.log(record);
  count++;
}

console.log(`Parsed ${count} records`);
```

**With charset and options:**

```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';

const nodeStream = createReadStream('large-file.csv', {
  highWaterMark: 64 * 1024 // 64KB chunks
});

const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

// Parse with options
for await (const record of parseUint8ArrayStream(webStream, {
  charset: 'utf-8',
  delimiter: ',',
  // Process one record at a time (memory efficient)
})) {
  // Process each record immediately
  await processRecord(record);
}

async function processRecord(record: any) {
  // Database insert, API call, etc.
  console.log(record);
}
```

**Compressed file streams:**

```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';

const nodeStream = createReadStream('data.csv.gz');
const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

// Parse compressed stream
for await (const record of parseUint8ArrayStream(webStream, {
  decompression: 'gzip'
})) {
  console.log(record);
}
```
