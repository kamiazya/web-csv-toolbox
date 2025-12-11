---
title: Node.js - stdin/stdout
group: Platform Usage
---

# stdin/stdout

> Note: For WASM-enabled features in Node, Node.js 20.6+ is recommended (the WASM loader uses `import.meta.resolve`). On older Node versions, pass an explicit URL/Buffer to `loadWasm()`.

Process CSV from stdin and output to stdout.

```typescript
import { parseBinaryStream } from 'web-csv-toolbox';
import { Readable, Writable } from 'node:stream';

// Convert stdin to Web ReadableStream
const stdinStream = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;

// Parse CSV from stdin
for await (const record of parseBinaryStream(stdinStream)) {
  // Output as JSON to stdout
  console.log(JSON.stringify(record));
}
```

**Usage:**
```bash
# Pipe CSV file to script
cat data.csv | node script.js

# Or from curl
curl https://example.com/data.csv | node script.js
```

**Transform and output:**

```typescript
import { parseBinaryStream } from 'web-csv-toolbox';
import { Readable } from 'node:stream';

const stdinStream = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;

console.error('Processing CSV from stdin...');

let count = 0;
for await (const record of parseBinaryStream(stdinStream)) {
  // Transform: convert to uppercase
  const transformed = Object.fromEntries(
    Object.entries(record).map(([k, v]) => [k, String(v).toUpperCase()])
  );

  // Output as CSV
  if (count === 0) {
    // Output header
    console.log(Object.keys(transformed).join(','));
  }
  console.log(Object.values(transformed).join(','));

  count++;
}

console.error(`Processed ${count} records`);
```
