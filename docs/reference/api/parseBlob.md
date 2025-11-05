# parseBlob() API Reference

Parse CSV data from Blob or File objects with automatic charset detection.

## Overview

`parseBlob()` is a middle-level API specifically designed for parsing CSV data from `Blob` or `File` objects (from file inputs, drag-and-drop, etc.). It automatically handles charset detection from the Blob's `type` property.

**Category:** Middle-level API (Production)

**Input:** `Blob` (including `File`)

**Output:** `AsyncIterableIterator<CSVRecord<Header>>`

---

## Function Signature

```typescript
function parseBlob<Header extends ReadonlyArray<string>>(
  blob: Blob,
  options?: ParseBinaryOptions<Header>
): AsyncIterableIterator<CSVRecord<Header>>
```

---

## Parameters

### `blob`

**Type:** `Blob` (including `File`)

**Required:** Yes

The Blob or File object to parse.

**Example:**
```typescript
// From file input
const file = input.files[0];

// From Blob constructor
const blob = new Blob(['name,age\nAlice,42'], { type: 'text/csv' });
```

---

### `options`

**Type:** `ParseBinaryOptions<Header>`

**Required:** No

Parsing options to customize behavior.

```typescript
interface ParseBinaryOptions<Header> {
  // Parsing options
  delimiter?: string;           // Default: ','
  quotation?: string;           // Default: '"'
  header?: Header;              // Explicit header list

  // Binary options
  charset?: string;             // Default: from Blob type or 'utf-8'
  decompression?: CompressionFormat;
  ignoreBOM?: boolean;          // Default: false

  // Resource limits
  maxBufferSize?: number;       // Default: 10485760 (10MB)
  maxFieldCount?: number;       // Default: 100000

  // Execution strategy
  engine?: EngineConfig;        // Execution configuration

  // Abort control
  signal?: AbortSignal;         // Cancellation signal
}
```

#### Common Options

See [parseString() API Reference](./parseString.md#common-options) for common parsing options.

#### Binary-Specific Options

##### `charset`

**Type:** `string`

**Default:** Auto-detected from Blob `type` parameter, falls back to `'utf-8'`

Character encoding of the blob data.

**Example:**
```typescript
// Override charset
for await (const record of parseBlob(blob, {
  charset: 'shift-jis'
})) {
  console.log(record);
}
```

---

## Automatic Charset Detection

`parseBlob()` automatically extracts charset information from the Blob's `type` property:

**Example Blob types:**
```typescript
// Charset is automatically detected
new Blob([data], { type: 'text/csv;charset=utf-8' });
new Blob([data], { type: 'text/csv;charset=shift-jis' });
```

If no charset is specified in the type, defaults to `'utf-8'`.

---

## Returns

`AsyncIterableIterator<CSVRecord<Header>>`

An async iterable iterator that yields CSV records one by one.

---

## Usage Examples

### Example 1: Parse File from Input

**HTML:**
```html
<input type="file" id="csv-file" accept=".csv">
```

**JavaScript:**
```typescript
import { parseBlob } from 'web-csv-toolbox';

const input = document.querySelector('input[type="file"]');
input.addEventListener('change', async (event) => {
  const file = event.target.files[0];

  for await (const record of parseBlob(file)) {
    console.log(record);
  }
});
```

---

### Example 2: Parse from Drag-and-Drop

**HTML:**
```html
<div id="drop-zone" style="border: 2px dashed #ccc; padding: 20px; text-align: center;">
  Drop CSV file here
</div>
```

**JavaScript:**
```typescript
import { parseBlob } from 'web-csv-toolbox';

const dropZone = document.getElementById('drop-zone');

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
});

dropZone.addEventListener('drop', async (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files[0];

  for await (const record of parseBlob(file)) {
    console.log(record);
  }
});
```

---

### Example 3: Parse Blob with Charset

```typescript
import { parseBlob } from 'web-csv-toolbox';

const blob = new Blob([csvData], {
  type: 'text/csv;charset=shift-jis'
});

// Charset automatically detected from type
for await (const record of parseBlob(blob)) {
  console.log(record);
}
```

---

### Example 4: With TypeScript Headers

```typescript
import { parseBlob } from 'web-csv-toolbox';

type Header = ['name', 'age', 'email'];

const file = input.files[0];

for await (const record of parseBlob<Header>(file)) {
  // TypeScript knows: record.name, record.age, record.email
  console.log(`${record.name}: ${record.email}`);
}
```

---

### Example 5: Collecting to Array

```typescript
import { parseBlob } from 'web-csv-toolbox';

const file = input.files[0];
const records = await parseBlob.toArray(file);

console.log(`Loaded ${records.length} records`);
console.log(records);
```

---

### Example 6: Progress Tracking

```typescript
import { parseBlob } from 'web-csv-toolbox';

const file = input.files[0];
const totalSize = file.size;
let processed = 0;

for await (const record of parseBlob(file)) {
  processed++;
  const progress = (processed * 100 / totalSize).toFixed(1);
  console.log(`Progress: ${progress}% (${processed} records)`);
}
```

---

### Example 7: Compressed Files (gzip/deflate)

**HTML:**
```html
<input type="file" id="csv-file" accept=".csv,.csv.gz">
<div id="status"></div>
```

**JavaScript:**
```typescript
import { parseBlob } from 'web-csv-toolbox';

const input = document.getElementById('csv-file');
input.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const status = document.getElementById('status');
  status.textContent = 'Processing...';

  try {
    // Detect compression from file extension
    const options: { decompression?: CompressionFormat } = {};

    if (file.name.endsWith('.gz')) {
      options.decompression = 'gzip';
    }
    // Note: deflate compression is rarely used in file formats
    // It's mainly used in HTTP Content-Encoding

    const records = [];
    for await (const record of parseBlob(file, options)) {
      records.push(record);
    }

    status.textContent = `Loaded ${records.length} records`;
    console.log(records);
  } catch (error) {
    status.textContent = `Error: ${error.message}`;
  }
});
```

**Supported compression formats:**
- `gzip` - Most common (.csv.gz files)
- `deflate` - Rarely used in file formats, mainly for HTTP Content-Encoding
- `deflate-raw` - Available in some environments

**Note:** For Blob/File inputs, you typically only need to handle `.gz` files. The `deflate` format is mainly used in HTTP responses (see `parseRequest` / `parseResponse`).

---

## Namespace Methods

### parseBlob.toArray()

Convert the entire blob to an array of records.

```typescript
function toArray<Header extends ReadonlyArray<string>>(
  blob: Blob,
  options?: ParseBinaryOptions<Header>
): Promise<CSVRecord<Header>[]>
```

**Example:**
```typescript
import { parseBlob } from 'web-csv-toolbox';

const file = input.files[0];
const records = await parseBlob.toArray(file);

console.log(records);
```

⚠️ **Warning:** Loads entire result into memory. Not suitable for very large files.

---

### parseBlob.toStream()

Convert blob to a ReadableStream of records.

```typescript
function toStream<Header extends ReadonlyArray<string>>(
  blob: Blob,
  options?: ParseBinaryOptions<Header>
): ReadableStream<CSVRecord<Header>>
```

**Example:**
```typescript
import { parseBlob } from 'web-csv-toolbox';

const file = input.files[0];
const stream = parseBlob.toStream(file);

await stream.pipeTo(
  new WritableStream({
    write(record) {
      console.log(record);
    }
  })
);
```

---

## Performance Characteristics

### Memory Usage

- **Streaming (default):** O(1) - constant per record
- **toArray():** O(n) - proportional to file size

**Recommendation:** Always use streaming for large files to minimize memory usage.

---

## Error Handling

### Common Errors

```typescript
import { parseBlob } from 'web-csv-toolbox';

try {
  const file = input.files[0];

  for await (const record of parseBlob(file)) {
    console.log(record);
  }
} catch (error) {
  if (error.name === 'ParseError') {
    console.error('CSV syntax error:', error.message);
  } else {
    console.error('Error:', error);
  }
}
```

---

## Comparison with Other APIs

### parseBlob() vs parse()

| Feature | `parseBlob()` | `parse()` |
|---------|--------------|-----------|
| **Input type** | `Blob` only | Any (auto-detect) |
| **Charset detection** | Automatic | Automatic (when Blob) |
| **Type detection** | None | Yes (slight overhead) |
| **Performance** | Optimal | Slightly slower |
| **Use case** | Production (file inputs) | Learning, prototyping |

**Recommendation:** Use `parseBlob()` in production when working with file inputs or drag-and-drop.

---

### parseBlob() vs parseBinary()

| Feature | `parseBlob()` | `parseBinary()` |
|---------|--------------|-----------------|
| **Input type** | `Blob` | `Uint8Array` / `ArrayBuffer` |
| **Charset detection** | Automatic | Manual |
| **Use case** | File inputs, drag-and-drop | In-memory binary data |

---

## Real-World Examples

### Example: File Upload with Validation

**HTML:**
```html
<input type="file" id="csv-upload" accept=".csv">
<div id="results"></div>
```

**JavaScript:**
```typescript
import { parseBlob } from 'web-csv-toolbox';

async function validateCSVFile(file: File) {
  if (!file.type.includes('csv')) {
    throw new Error('Please upload a CSV file');
  }

  const records = [];
  const errors = [];

  for await (const record of parseBlob(file)) {
    // Validate record
    if (!record.email?.includes('@')) {
      errors.push(`Invalid email: ${record.email}`);
    } else {
      records.push(record);
    }
  }

  return { records, errors };
}

// Usage
document.getElementById('csv-upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    const { records, errors } = await validateCSVFile(file);
    document.getElementById('results').textContent =
      `Valid: ${records.length}, Errors: ${errors.length}`;
  }
});
```

---

### Example: Batch Processing

```typescript
import { parseBlob } from 'web-csv-toolbox';

async function processBatch(file: File) {
  const BATCH_SIZE = 1000;
  const batch: any[] = [];
  let totalProcessed = 0;

  for await (const record of parseBlob(file)) {
    batch.push(record);

    if (batch.length >= BATCH_SIZE) {
      await sendToAPI(batch);
      totalProcessed += batch.length;
      batch.length = 0;
      console.log(`Processed ${totalProcessed} records...`);
    }
  }

  // Process remaining records
  if (batch.length > 0) {
    await sendToAPI(batch);
    totalProcessed += batch.length;
  }

  console.log(`Complete: ${totalProcessed} records`);
}
```

---

## Browser Support

`parseBlob()` is supported across all modern browsers:

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ | Full support |
| Firefox | ✅ | Full support |
| Edge | ✅ | Full support |
| Safari | ✅ | Full support |
| Node.js | ✅ | Via Blob polyfill |
| Deno | ✅ | Built-in Blob support |

**Required APIs:**
- `Blob` / `File`
- `ReadableStream`

---

## Related Documentation

- **[parseFile() API Reference](./parseFile.md)** - Alias for parseBlob
- **[parse() API Reference](./parse.md)** - High-level universal API
- **[parseBinary() API Reference](./parseBinary.md)** - Binary data parser
- **[Choosing the Right API](../../how-to-guides/choosing-the-right-api.md)** - API selection guide

---

## Best Practices

### ✅ Do

- Use `parseBlob()` for file inputs and drag-and-drop
- Let automatic charset detection handle encoding
- Use streaming iteration for large files
- Validate file type before parsing
- Handle errors gracefully
- Use TypeScript for type safety

### ❌ Don't

- Don't use `toArray()` for very large files
- Don't ignore error handling
- Don't forget to validate file types
- Don't manually handle charset (automatic)

---

## Summary

`parseBlob()` is the optimal choice for parsing CSV data from Blob or File objects:

**Key Features:**
- ✅ Automatic charset detection from Blob type
- ✅ Streaming for memory efficiency
- ✅ Full TypeScript support
- ✅ Works with File API
- ✅ Supports drag-and-drop

**When to use:**
- File input elements (`<input type="file">`)
- Drag-and-drop file uploads
- Any Blob or File containing CSV data

**When to avoid:**
- HTTP responses - use `parseResponse()` instead
- In-memory binary data - use `parseBinary()` instead
- Strings - use `parseString()` instead
