---
title: Node.js - Buffer
group: Platform Usage
---

# Buffer

Node.js `Buffer` objects are automatically supported (Buffer extends Uint8Array).

```typescript
import { parseBinary } from 'web-csv-toolbox';
import { readFile } from 'node:fs/promises';

// Read file as Buffer
const buffer = await readFile('data.csv');

// Parse directly - Buffer is a Uint8Array subclass
let count = 0;
for await (const record of parseBinary(buffer)) {
  // Process record (e.g., save to database, validate, etc.)
  console.log(record);
  count++;
}

console.log(`Parsed ${count} records`);
```

**With encoding specification:**

```typescript
import { parseBinary } from 'web-csv-toolbox';
import { readFile } from 'node:fs/promises';

// Read file as Buffer
const buffer = await readFile('shift-jis.csv');

// Specify charset
let count = 0;
for await (const record of parseBinary(buffer, { charset: 'shift-jis' })) {
  // Process record (e.g., save to database, validate, etc.)
  console.log(record);
  count++;
}

console.log(`Parsed ${count} records`);
```

**With compressed files:**

```typescript
import { parseBinary } from 'web-csv-toolbox';
import { readFile } from 'node:fs/promises';

// Read gzip-compressed CSV
const buffer = await readFile('data.csv.gz');

// Parse with decompression
let count = 0;
for await (const record of parseBinary(buffer, { decompression: 'gzip' })) {
  // Process record (e.g., save to database, validate, etc.)
  console.log(record);
  count++;
}

console.log(`Parsed ${count} records from compressed file`);
```
