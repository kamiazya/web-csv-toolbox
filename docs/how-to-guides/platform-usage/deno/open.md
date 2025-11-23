---
title: Deno - Deno.open
group: Platform Usage
---

# Deno.open

Stream large files efficiently using Deno.open.

```typescript
import { parseBinaryStream } from 'web-csv-toolbox';

// Open file as ReadableStream (using ensures automatic cleanup)
using file = await Deno.open('large-file.csv', { read: true });

// Parse from stream
let count = 0;
for await (const record of parseBinaryStream(file.readable)) {
  // Process record (e.g., save to database, validate, etc.)
  console.log(record);
  count++;
}

console.log(`Parsed ${count} records`);
```

**With processing:**

```typescript
import { parseBinaryStream } from 'web-csv-toolbox';

using file = await Deno.open('large-file.csv', { read: true });

let count = 0;
for await (const record of parseBinaryStream(file.readable)) {
  // Process each record immediately
  await processRecord(record);
  count++;

  if (count % 1000 === 0) {
    console.log(`Processed ${count} records...`);
  }
}

console.log(`Total: ${count} records`);

async function processRecord(record: any) {
  // Database insert, API call, etc.
}
```
