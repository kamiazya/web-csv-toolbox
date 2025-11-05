# HTTP Requests

Parse CSV from HTTP requests using Node.js built-in fetch (Node.js 18+).

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

**With custom headers:**

```typescript
import { parseResponse } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv', {
  headers: {
    'User-Agent': 'MyApp/1.0',
    'Authorization': 'Bearer token'
  }
});

let count = 0;
for await (const record of parseResponse(response)) {
  // Process record (e.g., save to database, validate, etc.)
  console.log(record);
  count++;
}

console.log(`Fetched ${count} records`);
```
