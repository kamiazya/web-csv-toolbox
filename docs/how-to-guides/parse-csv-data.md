---
title: Parse CSV Data
group: How-to Guides
---

# How to Parse CSV Data

This guide shows you how to parse CSV data in different scenarios using web-csv-toolbox.

> **API Reference:** For detailed type definitions and parameters, see:
> - [parseString()](https://kamiazya.github.io/web-csv-toolbox/functions/parseString.html)
> - [parseStringStream()](https://kamiazya.github.io/web-csv-toolbox/functions/parseStringStream.html)
> - [parseBinary()](https://kamiazya.github.io/web-csv-toolbox/functions/parseBinary.html)
> - [parseBlob()](https://kamiazya.github.io/web-csv-toolbox/functions/parseBlob.html)
> - [parseFile()](https://kamiazya.github.io/web-csv-toolbox/functions/parseFile.html)
> - [Complete API Reference](https://kamiazya.github.io/web-csv-toolbox/)

## Quick Reference

Choose your parsing approach based on your input type and requirements:

| Input Type | API | Best For |
|------------|-----|----------|
| **String** | `parseString()` | In-memory CSV text |
| **ReadableStream\<string\>** | `parseStringStream()` | Large text streams |
| **Uint8Array/ArrayBuffer** | `parseBinary()` | Binary data in memory |
| **ReadableStream\<Uint8Array\>** | `parseBinaryStream()` | Binary streams |
| **Response** | `parseResponse()` | Fetch API results |
| **Request** | `parseRequest()` | Server-side HTTP requests |
| **Blob/File** | `parseBlob()` / `parseFile()` | File uploads, drag-and-drop |
| **Any** | `parse()` | Prototyping, learning |

## Basic Parsing

### Parse a String

**When:** You have CSV data as a string in memory.

```typescript
import { parseString } from 'web-csv-toolbox';

const csv = `name,age,city
Alice,30,New York
Bob,25,San Francisco`;

// Stream records one by one
for await (const record of parseString(csv)) {
  console.log(record);
  // { name: 'Alice', age: '30', city: 'New York' }
  // { name: 'Bob', age: '25', city: 'San Francisco' }
}
```

**Load all records into array:**

```typescript
// ⚠️ Only for small files - loads everything into memory
const records = await parseString.toArray(csv);
console.log(records);
// [
//   { name: 'Alice', age: '30', city: 'New York' },
//   { name: 'Bob', age: '25', city: 'San Francisco' }
// ]
```

### Parse a Stream

**When:** Processing large files or streaming data.

```typescript
import { parseStringStream } from 'web-csv-toolbox';

// From fetch response
const response = await fetch('data.csv');
const textStream = response.body
  ?.pipeThrough(new TextDecoderStream());

if (textStream) {
  for await (const record of parseStringStream(textStream)) {
    console.log(record);
    // Process records one at a time
    // Memory: O(1) per record
  }
}
```

### Parse Binary Data

**When:** Working with ArrayBuffer or Uint8Array.

```typescript
import { parseBinary } from 'web-csv-toolbox';

// From ArrayBuffer
const buffer = new ArrayBuffer(1024);
// ... populate buffer ...

for await (const record of parseBinary(buffer, {
  charset: 'utf-8'  // or 'shift-jis', 'euc-jp', etc.
})) {
  console.log(record);
}
```

### Parse a File Upload

**When:** Processing user-uploaded files.

```typescript
import { parseFile } from 'web-csv-toolbox';

// From file input
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];

for await (const record of parseFile(file)) {
  console.log(record);
}
```

**With error tracking:**

```typescript
import { parseFile, ParseError } from 'web-csv-toolbox';

try {
  for await (const record of parseFile(file)) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof ParseError) {
    console.error(`Error in ${error.source}: ${error.message}`);
    // Error in example.csv: Invalid CSV format
  }
}
```

## Common Scenarios

### Scenario 1: Parse with Custom Delimiter

**Use tab-separated values (TSV):**

```typescript
import { parseString } from 'web-csv-toolbox';

const tsv = `name\tage\tcity
Alice\t30\tNew York
Bob\t25\tSan Francisco`;

for await (const record of parseString(tsv, {
  delimiter: '\t'
})) {
  console.log(record);
}
```

### Scenario 2: Parse with Custom Quotation

**Use single quotes:**

```typescript
import { parseString } from 'web-csv-toolbox';

const csv = `name,description
Alice,'Software Engineer'
Bob,'Product Manager, Senior'`;

for await (const record of parseString(csv, {
  quotation: "'"
})) {
  console.log(record);
}
```

### Scenario 3: Parse without Header Row

**Provide explicit headers:**

```typescript
import { parseString } from 'web-csv-toolbox';

const csv = `Alice,30,New York
Bob,25,San Francisco`;

for await (const record of parseString(csv, {
  headerList: ['name', 'age', 'city']
})) {
  console.log(record);
  // { name: 'Alice', age: '30', city: 'New York' }
}
```

### Scenario 4: Parse with TypeScript Type Safety

**Define header types:**

```typescript
import { parseString } from 'web-csv-toolbox';

const csv = `name,age,email
Alice,30,alice@example.com`;

// Define header tuple type
type Header = ['name', 'age', 'email'];

for await (const record of parseString<Header>(csv)) {
  // TypeScript knows: record.name, record.age, record.email
  console.log(`${record.name} (${record.age}): ${record.email}`);
}
```

### Scenario 5: Parse with Encoding Detection

**Automatic charset detection from Blob:**

```typescript
import { parseBlob } from 'web-csv-toolbox';

// Blob with charset in type parameter
const blob = new Blob([csvData], {
  type: 'text/csv; charset=shift-jis'
});

// Charset is automatically detected from type
for await (const record of parseBlob(blob)) {
  console.log(record);
}
```

**Override charset explicitly:**

```typescript
for await (const record of parseBlob(blob, {
  charset: 'euc-jp'  // Override detected charset
})) {
  console.log(record);
}
```

### Scenario 6: Parse Large Files Efficiently

**Use streaming with Worker for non-blocking UI:**

```typescript
import { parseStringStream, EnginePresets } from 'web-csv-toolbox';

const response = await fetch('large-data.csv');
const textStream = response.body
  ?.pipeThrough(new TextDecoderStream());

if (textStream) {
  // Non-blocking parsing in worker thread
  for await (const record of parseStringStream(textStream, {
    engine: EnginePresets.balanced()
  })) {
    console.log(record);
    // UI stays responsive!
  }
}
```

### Scenario 7: Parse with Timeout

**Prevent long-running operations:**

```typescript
import { parseString } from 'web-csv-toolbox';

const controller = new AbortController();

// Timeout after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  for await (const record of parseString(csv, {
    signal: controller.signal
  })) {
    console.log(record);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Parsing timed out');
  }
}
```

### Scenario 8: Parse with Resource Limits

**Prevent memory exhaustion:**

```typescript
import { parseString } from 'web-csv-toolbox';

try {
  for await (const record of parseString(csv, {
    maxBufferSize: 5 * 1024 * 1024,  // 5MB
    maxFieldCount: 1000               // Max 1000 fields per record
  })) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof RangeError) {
    console.error('Resource limit exceeded:', error.message);
  }
}
```

### Scenario 9: Parse with WASM Acceleration

**For UTF-8 files with double-quotes:**

```typescript
import { parseString, EnginePresets, loadWasm } from 'web-csv-toolbox';

// Optional: Pre-load WASM for better first-parse performance
await loadWasm();

// Fast parsing with WASM
for await (const record of parseString(csv, {
  engine: EnginePresets.fast()
})) {
  console.log(record);
}
```

**Limitations:**
- ❌ UTF-8 encoding only
- ❌ Double-quote (`"`) only

### Scenario 10: Parse Server-Side Requests

**Process CSV uploads in server routes:**

```typescript
import { parseRequest, EnginePresets, ReusableWorkerPool } from 'web-csv-toolbox';
import { Hono } from 'hono';

const app = new Hono();
const pool = new ReusableWorkerPool({ maxWorkers: 4 });

app.post('/upload', async (c) => {
  try {
    for await (const record of parseRequest(c.req.raw, {
      engine: EnginePresets.balanced({ workerPool: pool })
    })) {
      // Process record
      console.log(record);
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: error.message }, 400);
  }
});
```

> **Production Example:** For a complete implementation with security measures, validation, and SSE streaming, see the [Hono Secure API Example](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/hono-secure-api).

## Performance Guidelines

### Memory Usage

| API | Input Size | Memory Usage | Best For |
|-----|-----------|--------------|----------|
| `parseString()` | Small-Medium | O(n) - loads string | < 100MB strings |
| `parseStringStream()` | Any | O(1) per record | Large files, streams |
| `parseBinary()` | Small-Medium | O(n) - loads buffer | < 100MB binary |
| `parseBinaryStream()` | Any | O(1) per record | Large binary streams |
| `parseString.toArray()` | Small only | O(n) - loads all | < 10MB, need array |

**Rule of thumb:**
- ✅ Use streaming (`*Stream()`) for files > 10MB
- ✅ Use `toArray()` only for files < 10MB
- ✅ Use workers for UI-critical applications

### Execution Strategy Selection

Choose based on your requirements:

**Stability (Most Compatible):**
```typescript
engine: EnginePresets.stable()
// ✅ Standard JavaScript APIs only
// ✅ Supports all encodings and quotation characters
// ❌ Blocks main thread
```

**UI Responsiveness (Non-Blocking):**
```typescript
engine: EnginePresets.responsive()
// ✅ Non-blocking worker execution
// ✅ Supports all encodings and quotation characters
// ✅ Works on Safari
// ⚠️ Worker communication overhead
```

**Memory Efficiency:**
```typescript
engine: EnginePresets.memoryEfficient()
// ✅ Zero-copy stream transfer (when supported)
// ✅ Constant memory usage for streaming
// ⚠️ Experimental (auto-fallback on Safari)
```

**Parse Speed (UTF-8 only):**
```typescript
engine: EnginePresets.fast()
// ✅ WASM-accelerated parsing
// ❌ Blocks main thread
// ❌ UTF-8 and double-quote only
```

**Balanced (General-Purpose):**
```typescript
engine: EnginePresets.balanced()
// ✅ Non-blocking + memory efficient
// ✅ Supports all encodings and quotation characters
// ✅ Auto-fallback on Safari
// ⚠️ Experimental (with stable fallback)
```

**Non-Blocking + Fast (UTF-8 only):**
```typescript
engine: EnginePresets.responsiveFast()
// ✅ Worker + WASM
// ✅ Non-blocking UI
// ❌ UTF-8 and double-quote only
```

For detailed configuration options, see [Engine Presets Reference](../reference/engine-presets.md).

## Error Handling

### Common Errors

**ParseError - Invalid CSV Format:**

```typescript
import { parseString, ParseError } from 'web-csv-toolbox';

try {
  for await (const record of parseString(invalidCSV)) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof ParseError) {
    console.error('Invalid CSV:', error.message);
    console.error('Source:', error.source); // File name if available
  }
}
```

**RangeError - Resource Limits Exceeded:**

```typescript
try {
  for await (const record of parseString(csv, {
    maxBufferSize: 1024  // 1KB limit
  })) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof RangeError) {
    console.error('Buffer size exceeded:', error.message);
  }
}
```

**AbortError - Timeout or Cancellation:**

```typescript
const controller = new AbortController();

try {
  for await (const record of parseString(csv, {
    signal: controller.signal
  })) {
    console.log(record);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Parsing cancelled');
  }
}
```

## Best Practices

### ✅ Do

- **Use streaming for large files** (> 10MB) to avoid memory issues
- **Use middle-level APIs in production** for best performance
- **Set appropriate resource limits** (`maxBufferSize`, `maxFieldCount`)
- **Handle errors with try-catch** and check error types
- **Use AbortSignal for timeouts** on long-running operations
- **Pre-load WASM once at startup** with `loadWasm()` for best performance
- **Use WorkerPool for multiple files** to reuse workers efficiently
- **Choose engine presets** based on your requirements

### ❌ Don't

- **Don't use `toArray()` for large files** (> 100MB) - causes OOM
- **Don't ignore error handling** - always use try-catch
- **Don't create workers per request** - use WorkerPool instead
- **Don't forget `loadWasm()` when using WASM presets** - reduces first-parse latency
- **Don't use WASM for non-UTF-8** - it only supports UTF-8
- **Don't block main thread in UI apps** - use worker-based presets

## Troubleshooting

### Issue: Out of Memory

**Symptoms:** Browser/Node.js crashes, "JavaScript heap out of memory"

**Solutions:**
1. Switch from `parseString()` to `parseStringStream()`
2. Process records one at a time instead of loading all with `toArray()`
3. Reduce `maxBufferSize` if needed

### Issue: Slow Performance

**Symptoms:** Parsing takes too long

**Solutions:**
1. Use WASM for UTF-8 files: `EnginePresets.fast()`
2. Use workers for non-blocking: `EnginePresets.balanced()`
3. Pre-load WASM at startup: `await loadWasm()`
4. Use WorkerPool for multiple files

### Issue: UI Freezing

**Symptoms:** Browser becomes unresponsive during parsing

**Solutions:**
1. Use worker-based presets: `EnginePresets.responsive()` or `EnginePresets.balanced()`
2. Process in smaller chunks with AbortSignal timeouts

### Issue: Encoding Errors

**Symptoms:** Garbled characters in output

**Solutions:**
1. Specify correct charset: `parseBlob(blob, { charset: 'shift-jis' })`
2. Check file encoding with file inspection tools
3. Use `parseBlob()` for automatic charset detection from Blob type

### Issue: WASM Not Loading

**Symptoms:** WASM presets fall back to JavaScript

**Solutions:**
1. Call `await loadWasm()` at application startup
2. For bundlers, see [Using with Bundlers](./using-with-bundlers.md)
3. Check browser console for errors

## Related Documentation

- **[Choosing the Right API](./choosing-the-right-api.md)** - API selection guide
- **[Engine Presets Reference](../reference/engine-presets.md)** - Pre-configured execution strategies
- **[Secure CSV Processing](./secure-csv-processing.md)** - Security best practices
- **[Using with Bundlers](./using-with-bundlers.md)** - Bundler configuration
- **[Execution Strategies](../explanation/execution-strategies.md)** - Understanding performance options
- **[API Reference](https://kamiazya.github.io/web-csv-toolbox/)** - Complete type definitions and parameters
