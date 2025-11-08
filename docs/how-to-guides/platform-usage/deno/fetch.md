---
title: Deno - fetch API
group: Platform Usage
---

# fetch API

Deno has built-in fetch support.

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
