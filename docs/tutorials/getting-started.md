# Getting Started with web-csv-toolbox

This tutorial will guide you through the basics of using web-csv-toolbox to parse CSV data.

## What you'll learn

By the end of this tutorial, you'll be able to:
- Parse a simple CSV string
- Parse CSV from a network response
- Parse CSV with custom options
- Work with different input formats

## Prerequisites

- Node.js LTS or a modern browser
- Basic JavaScript/TypeScript knowledge

## Step 1: Installation

Install the package using your preferred package manager:

```bash
# npm
npm install web-csv-toolbox

# yarn
yarn add web-csv-toolbox

# pnpm
pnpm add web-csv-toolbox
```

## Step 2: Parse your first CSV

Let's start with a simple example - parsing a CSV string:

```typescript
import { parse } from 'web-csv-toolbox';

const csv = `name,age,city
Alice,30,New York
Bob,25,San Francisco
Charlie,35,Los Angeles`;

for await (const record of parse(csv)) {
  console.log(record);
}
```

**Output:**
```
{ name: 'Alice', age: '30', city: 'New York' }
{ name: 'Bob', age: '25', city: 'San Francisco' }
{ name: 'Charlie', age: '35', city: 'Los Angeles' }
```

Notice that:
- The first row becomes the header (property names)
- Each subsequent row becomes a record object
- All values are strings by default

## Step 3: Parse CSV from a file or URL

In real applications, you often fetch CSV data from a network:

```typescript
import { parse } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv');

for await (const record of parse(response)) {
  console.log(record);
}
```

web-csv-toolbox automatically handles:
- Reading the response body as a stream
- Decoding the text encoding
- Parsing CSV records one by one

## Step 4: Customize parsing options

You can customize how the CSV is parsed:

### Using different delimiters

```typescript
import { parse } from 'web-csv-toolbox';

// Tab-separated values
const tsv = `name\tage\tcity
Alice\t30\tNew York`;

for await (const record of parse(tsv, { delimiter: '\t' })) {
  console.log(record);
}
```

### Providing custom headers

```typescript
import { parse } from 'web-csv-toolbox';

// CSV without header row
const csv = `Alice,30,New York
Bob,25,San Francisco`;

for await (const record of parse(csv, { headers: ['name', 'age', 'city'] })) {
  console.log(record);
}
```

## Step 5: Working with streams

For large files, you can use streaming to keep memory usage constant:

```typescript
import { parse } from 'web-csv-toolbox';

const response = await fetch('https://example.com/large-data.csv');

// Process one record at a time
for await (const record of parse(response)) {
  // Each record is processed immediately
  // Memory footprint: O(1) - only one record in memory at a time
  console.log(record);
}
```

## What's next?

Now that you know the basics, explore more advanced topics:

- **[Working with Workers](./working-with-workers.md)** - Offload parsing to background threads
- **[How-To: Handle Large Files](../how-to-guides/handle-large-files.md)** - Memory-efficient techniques
- **[How-To: Validate CSV Data](../how-to-guides/validate-csv-data.md)** - Schema validation with Zod

## Summary

In this tutorial, you learned:
- ✅ How to install web-csv-toolbox
- ✅ Parse CSV from strings and network responses
- ✅ Customize parsing with options
- ✅ Work with streams for efficient memory usage

**Next:** Try [Working with Workers](./working-with-workers.md) to learn about performance optimization.
