# parseFile() API Reference

Parse CSV data from File objects (alias for parseBlob).

## Overview

`parseFile()` is an alias for `parseBlob()` that provides a more semantically clear name when working specifically with `File` objects from file inputs or drag-and-drop.

Since `File` extends `Blob`, all functionality is identical to `parseBlob()`.

**Category:** Middle-level API (Production)

**Input:** `File`

**Output:** `AsyncIterableIterator<CSVRecord<Header>>`

---

## Function Signature

```typescript
function parseFile<Header extends ReadonlyArray<string>>(
  file: File,
  options?: ParseBinaryOptions<Header>
): AsyncIterableIterator<CSVRecord<Header>>
```

---

## Quick Example

```typescript
import { parseFile } from 'web-csv-toolbox';

// From file input
const input = document.querySelector('input[type="file"]');
input.addEventListener('change', async (event) => {
  const file = event.target.files[0];

  for await (const record of parseFile(file)) {
    console.log(record);
  }
});

// From drag-and-drop
dropZone.addEventListener('drop', async (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files[0];

  for await (const record of parseFile(file)) {
    console.log(record);
  }
});
```

---

## Namespace Methods

### parseFile.toArray()

```typescript
function toArray<Header extends ReadonlyArray<string>>(
  file: File,
  options?: ParseBinaryOptions<Header>
): Promise<CSVRecord<Header>[]>
```

**Example:**
```typescript
const file = input.files[0];
const records = await parseFile.toArray(file);
console.log(records);
```

---

### parseFile.toStream()

```typescript
function toStream<Header extends ReadonlyArray<string>>(
  file: File,
  options?: ParseBinaryOptions<Header>
): ReadableStream<CSVRecord<Header>>
```

**Example:**
```typescript
const file = input.files[0];
const stream = parseFile.toStream(file);

await stream.pipeTo(
  new WritableStream({
    write(record) {
      console.log(record);
    }
  })
);
```

---

## Relationship with parseBlob()

`parseFile()` is simply a re-export of `parseBlob()`:

```typescript
// These are identical:
parseFile(file, options)
parseBlob(file, options)
```

**Why use parseFile():**
- More semantic when working specifically with File objects
- Clearer intent in code that handles file uploads
- Better documentation and IntelliSense hints

**When to use parseBlob() instead:**
- When working with generic Blob objects
- When you need to handle both Blob and File
- When using Blob constructor

---

## Complete Documentation

For complete documentation including all options, examples, and best practices, see:

**[parseBlob() API Reference](./parseBlob.md)**

All features, options, and behaviors are identical.

---

## Common Use Cases

### File Input Element

**HTML:**
```html
<input type="file" id="csv-file" accept=".csv">
```

**JavaScript:**
```typescript
import { parseFile } from 'web-csv-toolbox';

const input = document.querySelector('input[type="file"]');
input.addEventListener('change', async (event) => {
  const file = event.target.files[0];

  if (!file) return;

  try {
    for await (const record of parseFile(file)) {
      console.log(record);
    }
  } catch (error) {
    console.error('Failed to parse CSV:', error);
  }
});
```

---

### Drag-and-Drop

**HTML:**
```html
<div id="drop-zone" style="border: 2px dashed #ccc; padding: 20px; text-align: center;">
  Drop CSV file here
</div>
```

**JavaScript:**
```typescript
import { parseFile } from 'web-csv-toolbox';

const dropZone = document.getElementById('drop-zone');

dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
});

dropZone.addEventListener('drop', async (event) => {
  event.preventDefault();

  const file = event.dataTransfer.files[0];

  if (!file) return;
  if (!file.type.includes('csv')) {
    alert('Please drop a CSV file');
    return;
  }

  for await (const record of parseFile(file)) {
    console.log(record);
  }
});
```

---

### With File Validation

```typescript
import { parseFile } from 'web-csv-toolbox';

async function handleFileUpload(file: File) {
  // Validate file type
  if (!file.name.endsWith('.csv')) {
    throw new Error('File must be a CSV');
  }

  // Validate file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File too large (max 10MB)');
  }

  const records = [];
  for await (const record of parseFile(file)) {
    records.push(record);
  }

  return records;
}
```

---

### Compressed Files (gzip/deflate)

**HTML:**
```html
<input type="file" id="csv-file" accept=".csv,.csv.gz">
```

**JavaScript:**
```typescript
import { parseFile } from 'web-csv-toolbox';

const input = document.getElementById('csv-file');
input.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    // Detect compression from file extension
    const options: { decompression?: CompressionFormat } = {};

    if (file.name.endsWith('.gz')) {
      options.decompression = 'gzip';
    }
    // Note: deflate compression is rarely used in file formats
    // It's mainly used in HTTP Content-Encoding

    const records = [];
    for await (const record of parseFile(file, options)) {
      records.push(record);
    }

    console.log(`Loaded ${records.length} records from compressed file`);
  } catch (error) {
    console.error('Failed to parse compressed CSV:', error);
  }
});
```

**Supported compression formats:**
- `gzip` - Most common (.csv.gz files)
- `deflate` - Rarely used in file formats, mainly for HTTP Content-Encoding
- `deflate-raw` - Available in some environments

**Note:** For File inputs, you typically only need to handle `.gz` files. The `deflate` format is mainly used in HTTP responses (see `parseRequest` / `parseResponse`).

---

## Related Documentation

- **[parseBlob() API Reference](./parseBlob.md)** - Complete documentation (identical functionality)
- **[parse() API Reference](./parse.md)** - High-level universal API
- **[Choosing the Right API](../../how-to-guides/choosing-the-right-api.md)** - API selection guide

---

## Summary

`parseFile()` is a semantic alias for `parseBlob()` designed for File objects:

**Use parseFile() when:**
- ✅ Working with file input elements
- ✅ Handling drag-and-drop files
- ✅ You want clearer code intent

**Use parseBlob() when:**
- Working with generic Blob objects
- Need to handle both Blob and File
- Using Blob constructor

For all options, examples, and detailed documentation, refer to **[parseBlob() API Reference](./parseBlob.md)**.
