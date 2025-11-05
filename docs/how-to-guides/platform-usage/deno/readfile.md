# Deno.readFile

Read and parse CSV files using Deno's file API.

```typescript
import { parseBinary } from 'web-csv-toolbox';

// Read file as Uint8Array
const data = await Deno.readFile('data.csv');

// Parse
let count = 0;
for await (const record of parseBinary(data)) {
  // Process record (e.g., save to database, validate, etc.)
  console.log(record);
  count++;
}

console.log(`Parsed ${count} records`);
```

**With encoding:**

```typescript
import { parseBinary } from 'web-csv-toolbox';

const data = await Deno.readFile('shift-jis.csv');

let count = 0;
for await (const record of parseBinary(data, { charset: 'shift-jis' })) {
  // Process record (e.g., save to database, validate, etc.)
  console.log(record);
  count++;
}

console.log(`Parsed ${count} records`);
```
