---
title: Choosing the Right API
group: How-to Guides
---

# Choosing the Right API

This guide helps you select the appropriate API for your CSV parsing needs in web-csv-toolbox.

> **Note for Bundler Users**: When using Worker-based engines (e.g., `EnginePresets.responsive()`), you must specify the `workerURL` option with bundlers. See [How to Use with Bundlers](./using-with-bundlers.md).

## Quick Decision Tree

```
What type of input do you have?
│
├─ Learning/Prototyping?
│  └─ Use parse() (high-level API)
│
├─ String (CSV text)
│  └─ Use parseString() ✅
│
├─ ReadableStream<string> (text stream)
│  └─ Use parseStringStream() ✅
│
├─ Uint8Array or ArrayBuffer (binary data)
│  └─ Use parseBinary() ✅
│
├─ ReadableStream<Uint8Array> (binary stream)
│  └─ Use parseBinaryStream() ✅
│
├─ Response (fetch result)
│  └─ Use parseResponse() ✅
│
├─ Request (server-side)
│  └─ Use parseRequest() ✅
│
└─ Blob or File (file upload, drag-and-drop)
   ├─ Generic Blob: Use parseBlob() ✅
   └─ File with error tracking: Use parseFile() ✅
```

> **Platform Note:** `Blob` is supported in all environments. `File` support varies:
> - ✅ Browsers, Node.js 20+, Deno: Full support
> - ⚠️ Cloudflare Workers: `File` constructor unavailable (use `parseBlob()` with `source` option)
> - ✅ FormData-sourced Files: Supported everywhere

---

## API Categories

### High-Level API

**When to use:**
- Learning the library
- Quick prototyping
- Scripts where input type varies at runtime

**API:**
- `parse()` - Universal CSV parser with automatic input detection

**Trade-off:**
- Convenience vs. slight performance overhead from type detection

---

### Middle-Level APIs (Production)

**When to use:**
- Production applications
- Performance-critical code
- When input type is known at compile time

#### Input-Based Parsing Functions

For most production use cases, choose the appropriate function based on your input type:

- `parseString()` - Parse CSV string
- `parseStringStream()` - Parse text stream
- `parseBinary()` - Parse binary data (Uint8Array/ArrayBuffer)
- `parseBinaryStream()` - Parse binary stream
- `parseResponse()` - Parse HTTP Response
- `parseRequest()` - Parse HTTP Request (server-side)
- `parseBlob()` - Parse Blob or File
- `parseFile()` - Parse File with automatic error source tracking

**Trade-off:**
- Optimal performance vs. need to know input type

#### Parser Factory Functions

For creating stateful parsers with streaming support:

**String Parsing:**
- **`createStringCSVParser(options?)`** - Factory for format-specific string parsers
  - Returns `FlexibleStringObjectCSVParser` (default) or `FlexibleStringArrayCSVParser`
  - Accepts `CSVProcessingOptions` only (no `engine` option)

**Binary Parsing:**
- **`createBinaryCSVParser(options?)`** - Factory for format-specific binary parsers
  - Returns `FlexibleBinaryObjectCSVParser` (default) or `FlexibleBinaryArrayCSVParser`
  - Accepts `BinaryCSVProcessingOptions` only (no `engine` option)

**When to use:**
- Need stateful parsing with `{ stream: true }` option
- Working with binary data (charset encoding, BOM handling)
- Want to call `.parse()` method multiple times on chunks

---

#### Stream Pipeline Factory Functions

For fine control over stream pipelines or custom processing between stages:

**Parser Streams** - Complete string/binary → records pipeline:
- **`createStringCSVParserStream(options?)`** - Factory for string parsing TransformStream
- **`createBinaryCSVParserStream(options?)`** - Factory for binary parsing TransformStream

**Transformer Factory Functions** - For inserting custom processing between stages:
- **`createStringCSVLexerTransformer(options?)`** - Factory for string → tokens TransformStream
- **`createCSVRecordAssemblerTransformer(options?)`** - Factory for tokens → records TransformStream

**Lexer/Assembler Factory Functions** - For creating lexer and assembler model instances:
- **`createStringCSVLexer(options?)`** - Factory for string CSV lexer
- **`createCSVRecordAssembler(options?)`** - Factory for record assembler

**When to use factory functions:**
- Need fine control over stream pipelines
- Want to insert custom processing between lexing and assembly stages
- Building custom CSV processing pipelines with TransformStream

**Example:**
```typescript
import {
  createStringCSVLexerTransformer,
  createCSVRecordAssemblerTransformer
} from 'web-csv-toolbox';

// Custom token filtering between stages
csvStream
  .pipeThrough(createStringCSVLexerTransformer({ delimiter: '\t' }))
  .pipeThrough(customTokenFilter)
  .pipeThrough(createCSVRecordAssemblerTransformer({ header: ['name', 'age'] }))
  .pipeTo(yourProcessor);
```

---

### Low-Level APIs

**Note**: Low-level APIs are intended for niche requirements such as custom CSV dialects, syntax highlighting, or specialized validation. These APIs may have more frequent changes compared to Mid-level APIs. For most production use cases, prefer Mid-level APIs.

#### Parser Classes (Direct Instantiation)

**When to use:**
- Need custom parser implementation
- Want direct control over parser instance lifecycle
- Building custom TransformStream pipelines with custom parsers

**APIs:**

**String Parsing:**
- `FlexibleStringObjectCSVParser` - Always outputs object records
- `FlexibleStringArrayCSVParser` - Always outputs array records
- `StringCSVParserStream` - TransformStream for string parsing (use with custom parser)

**Binary Parsing:**
- `FlexibleBinaryObjectCSVParser` - Always outputs object records
- `FlexibleBinaryArrayCSVParser` - Always outputs array records
- `BinaryCSVParserStream` - TransformStream for binary parsing (use with custom parser)

---

#### Lexer + Assembler Classes (Maximum Control)

**When to use:**
- Need access to raw tokens for custom processing
- Implementing non-standard CSV dialects
- Building syntax highlighters or editors
- Debugging parsing issues at token level
- Performance profiling individual stages

**APIs:**
- **Lexer Classes**: `FlexibleStringCSVLexer`, `StringCSVLexerTransformer` - Tokenization
- **Assembler Classes**: `FlexibleCSVObjectRecordAssembler`, `FlexibleCSVArrayRecordAssembler`, `CSVRecordAssemblerTransformer` - Record assembly
- **Types**: `StringCSVLexer`, `CSVObjectRecordAssembler`, `CSVArrayRecordAssembler`, `Token` - For custom implementations

**Example:**
```typescript
import {
  StringCSVLexerTransformer,
  CSVRecordAssemblerTransformer,
  type StringCSVLexer,
  type CSVObjectRecordAssembler,
  type Token
} from 'web-csv-toolbox';

// Custom lexer for non-standard CSV dialect
class MyCustomLexer implements StringCSVLexer {
  *lex(chunk?: string, options?: { stream?: boolean }): IterableIterator<Token> {
    // Custom lexing logic
  }
}

// Custom assembler for specialized record formats
class MyCustomAssembler implements CSVObjectRecordAssembler<readonly string[]> {
  *assemble(
    input?: Token | Iterable<Token>,
    options?: { stream?: boolean }
  ): IterableIterator<Record<string, string>> {
    // Custom assembly logic
  }
}

const customLexer = new MyCustomLexer();
const customAssembler = new MyCustomAssembler();
csvStream
  .pipeThrough(new StringCSVLexerTransformer(customLexer))
  .pipeThrough(new CSVRecordAssemblerTransformer(customAssembler))
  .pipeTo(yourProcessor);
```

**Trade-off:**
- Maximum flexibility vs. complexity and potential API instability

---

## Detailed API Comparison

### Quick Reference Comparison Tables

#### parse() vs Specialized APIs

| Feature | `parse()` | Specialized APIs (`parseString()`, `parseBlob()`, etc.) |
|---------|----------|----------------------------------------------------------|
| **Input types** | All (auto-detect) | Single type |
| **Performance** | Good | Better (no type detection) |
| **Type safety** | Lower | Higher |
| **Use case** | Learning, prototyping | Production |
| **Type detection overhead** | Yes (small) | No |

**Recommendation:** Use specialized APIs (`parseString`, `parseBlob`, etc.) in production for better performance and type safety.

---

#### parseBlob() vs parse()

| Feature | `parseBlob()` | `parse()` |
|---------|--------------|-----------|
| **Input type** | `Blob` only | Any (auto-detect) |
| **Charset detection** | Automatic from `type` | Automatic (when Blob) |
| **Type detection** | None | Yes (slight overhead) |
| **Performance** | Optimal | Slightly slower |
| **Use case** | Production (file inputs) | Learning, prototyping |

**Recommendation:** Use `parseBlob()` in production when working with file inputs or drag-and-drop.

---

#### parseBlob() vs parseBinary()

| Feature | `parseBlob()` | `parseBinary()` |
|---------|--------------|-----------------|
| **Input type** | `Blob` | `Uint8Array` / `ArrayBuffer` |
| **Charset detection** | Automatic from `type` | Manual specification required |
| **Use case** | File inputs, drag-and-drop | In-memory binary data |
| **Typical scenario** | User file uploads | Downloaded/generated binary data |

**Recommendation:** Use `parseBlob()` for file inputs. Use `parseBinary()` when working with binary data that's already in memory.

---

#### Streaming vs toArray()

| Feature | Streaming (default) | `toArray()` |
|---------|---------------------|-------------|
| **Memory usage** | O(1) - constant per record | O(n) - proportional to file size |
| **Processing** | Record-by-record | All records at once |
| **Best for** | Large files (>10MB) | Small files (<10MB) |
| **Use case** | Memory-efficient processing | Need all data upfront |

**Recommendation:** Always use streaming for large files to minimize memory usage. Use `toArray()` only when you need all records in memory at once.

```typescript
// Streaming (memory-efficient)
for await (const record of parseString(csv)) {
  await processRecord(record);
}

// toArray() (loads all into memory)
const records = await toArray(parseString(csv));
console.log(`Total: ${records.length} records`);
```

---

#### Main Thread vs Worker Execution

| Approach | UI Blocking | Communication Overhead | Stability | Best For |
|----------|-------------|------------------------|-----------|----------|
| **Main thread** | ✅ Yes | ❌ None | ⭐ Most Stable | Server-side, blocking acceptable |
| **Worker** | ❌ No | ⚠️ Yes (data transfer) | ✅ Stable | Browser, non-blocking required |
| **WASM (main)** | ✅ Yes | ❌ None | ✅ Stable | Server-side, UTF-8 only |
| **Worker + WASM** | ❌ No | ⚠️ Yes (data transfer) | ✅ Stable | Browser, non-blocking, UTF-8 only |

**Recommendation:**
- **Browser applications:** Use Worker-based execution (`EnginePresets.responsive()`) for non-blocking UI
- **Server-side:** Use main thread or WASM for optimal performance
- **Performance-critical:** Benchmark your specific use case to determine the best approach

---

### parse() - High-Level Universal API

**Input:** `string | Uint8Array | ArrayBuffer | ReadableStream | Response`

**Use Cases:**
```typescript
import { parse } from 'web-csv-toolbox';

// ✅ Good for: Learning and prototyping
const csv = 'name,age\nAlice,30';
for await (const record of parse(csv)) {
  console.log(record);
}

// ✅ Good for: Input type varies at runtime
async function processCSV(input: string | Response) {
  for await (const record of parse(input)) {
    console.log(record);
  }
}
```

**Avoid for:**
- Production applications where input type is known
- Performance-critical code

**Performance:**
- Small overhead from input type detection
- Otherwise same as corresponding middle-level API

---

### parseString() - String Parser

**Input:** `string`

**Use Cases:**
```typescript
import { parseString } from 'web-csv-toolbox';

// ✅ Perfect for: Known string input
const csv = await file.text();
for await (const record of parseString(csv)) {
  console.log(record);
}

// ✅ Good for: Small to medium CSV strings
const data = `name,age\nAlice,30\nBob,25`;
for await (const record of parseString(data)) {
  console.log(record);
}
```

**Best for:**
- CSV text already in memory
- Small to medium files (<100MB)
- When entire CSV is available upfront

**Performance:**
- No type detection overhead
- Supports Worker + WASM for large strings

---

### parseStringStream() - Text Stream Parser

**Input:** `ReadableStream<string>`

**Use Cases:**
```typescript
import { parseStringStream } from 'web-csv-toolbox';

// ✅ Perfect for: Large text streams
const response = await fetch('large-data.csv');
const textStream = response.body
  .pipeThrough(new TextDecoderStream());

for await (const record of parseStringStream(textStream)) {
  console.log(record);
}

// ✅ Good for: Real-time data processing
const stream = getRealtimeCSVStream();
for await (const record of parseStringStream(stream)) {
  await processInRealtime(record);
}
```

**Best for:**
- Large files (>100MB)
- Streaming data sources
- Memory-constrained environments

**Performance:**
- O(1) memory usage per record
- Supports Worker with stream-transfer strategy

---

### parseBinary() - Binary Data Parser

**Input:** `Uint8Array | ArrayBuffer`

**Use Cases:**
```typescript
import { parseBinary } from 'web-csv-toolbox';

// ✅ Perfect for: Binary CSV data
const fileBuffer = await file.arrayBuffer();
for await (const record of parseBinary(fileBuffer, {
  charset: 'utf-8'
})) {
  console.log(record);
}

// ✅ Good for: Non-UTF-8 encodings
const shiftJISData = new Uint8Array([...]);
for await (const record of parseBinary(shiftJISData, {
  charset: 'shift-jis'
})) {
  console.log(record);
}

// ✅ Good for: Compressed data
for await (const record of parseBinary(data, {
  decompression: 'gzip'
})) {
  console.log(record);
}
```

**Best for:**
- Binary CSV data (Uint8Array, ArrayBuffer)
- Non-UTF-8 encodings (Shift-JIS, EUC-JP, etc.)
- Compressed CSV files (gzip, deflate)
- BOM handling required

**Performance:**
- Handles charset conversion
- Supports decompression
- Worker + WASM for large files

---

### parseBinaryStream() - Binary Stream Parser

**Input:** `ReadableStream<Uint8Array>`

**Use Cases:**
```typescript
import { parseBinaryStream } from 'web-csv-toolbox';

// ✅ Perfect for: Large binary streams
const response = await fetch('large-data.csv.gz');
const binaryStream = response.body;

for await (const record of parseBinaryStream(binaryStream, {
  charset: 'utf-8',
  decompression: 'gzip'
})) {
  console.log(record);
}

// ✅ Good for: Compressed streaming data
const stream = getCompressedCSVStream();
for await (const record of parseBinaryStream(stream, {
  decompression: 'gzip'
})) {
  console.log(record);
}
```

**Best for:**
- Large binary streams (>100MB)
- Compressed streaming data
- Non-UTF-8 streaming data
- Memory-constrained environments

**Performance:**
- O(1) memory usage per record
- Handles decompression in streaming fashion

---

### parseResponse() - HTTP Response Parser

**Input:** `Response`

**Use Cases:**
```typescript
import { parseResponse } from 'web-csv-toolbox';

// ✅ Perfect for: Fetch API responses
const response = await fetch('https://example.com/data.csv');
for await (const record of parseResponse(response)) {
  console.log(record);
}

// ✅ Automatic header processing
// - Content-Type charset detection
// - Content-Encoding decompression
// - BOM handling
const response = await fetch('https://example.com/data.csv.gz');
for await (const record of parseResponse(response)) {
  // Automatically decompressed and decoded
  console.log(record);
}
```

**Best for:**
- HTTP/HTTPS responses from `fetch()`
- Automatic Content-Type handling
- Automatic Content-Encoding decompression
- Remote CSV files

**Performance:**
- Automatically uses streaming for large responses
- Handles compression transparently

---

### parseRequest() - HTTP Request Parser (Server-Side)

**Input:** `Request`

**Use Cases:**
```typescript
import { parseRequest } from 'web-csv-toolbox';

// ✅ Perfect for: Server-side request handling
// Cloudflare Workers
export default {
  async fetch(request: Request) {
    if (request.method === 'POST') {
      for await (const record of parseRequest(request)) {
        await database.insert(record);
      }
      return Response.json({ success: true });
    }
  }
};

// ✅ Service Workers
self.addEventListener('fetch', async (event) => {
  const request = event.request;
  if (request.url.endsWith('/upload-csv')) {
    let count = 0;
    for await (const record of parseRequest(request)) {
      // Process record
      count++;
    }
    event.respondWith(Response.json({ count }));
  }
});
```

**Best for:**
- Cloudflare Workers
- Service Workers
- Deno Deploy
- Edge computing platforms
- Any server-side Request handling

**Performance:**
- Streaming request processing
- Automatic Content-Type and Content-Encoding handling

---

### parseBlob() / parseFile() - Blob/File Parser

**Input:** `Blob` (including `File`)

**Use Cases:**
```typescript
import { parseBlob, parseFile } from 'web-csv-toolbox';

// ✅ Perfect for: File input elements
const input = document.querySelector('input[type="file"]');
input.addEventListener('change', async (event) => {
  const file = event.target.files[0];

  // parseFile automatically includes filename in error messages
  try {
    for await (const record of parseFile(file)) {
      console.log(record);
    }
  } catch (error) {
    // Error message includes: 'in "data.csv"'
    console.error(error.message);
    console.error('Source:', error.source); // "data.csv"
  }
});

// ✅ Perfect for: Drag-and-drop
dropZone.addEventListener('drop', async (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files[0];

  for await (const record of parseFile(file)) {
    console.log(record);
  }
});

// ✅ Good for: Blob objects (use parseBlob)
const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
for await (const record of parseBlob(blob)) {
  console.log(record);
}

// ✅ Edge environments: Use parseBlob with manual source
const blob = new Blob([csvData], { type: 'text/csv' });
for await (const record of parseBlob(blob, { source: 'import.csv' })) {
  console.log(record);
}
```

**Best for:**
- File input elements (`<input type="file">`)
- Drag-and-drop file uploads
- Blob objects with charset in type parameter
- Browser file handling

**`parseFile()` vs `parseBlob()`:**
- `parseFile()`: Automatically sets `file.name` as error source
- `parseBlob()`: Generic Blob support, manual source specification
- Both support automatic charset detection from `type` parameter

**Performance:**
- Streaming for large files
- Automatic charset detection from Blob type

**Platform Compatibility:**
- `parseBlob()`: ✅ All environments (browsers, Workers, Node.js, Deno)
- `parseFile()`: ⚠️ May require FormData in Cloudflare Workers

---

## Common Scenarios

### Scenario 1: User File Upload (Browser)

```typescript
import { parseFile } from 'web-csv-toolbox';

async function handleFileUpload(file: File) {
  for await (const record of parseFile(file)) {
    console.log(record);
  }
}
```

**Why `parseFile()`?**
- Direct File object support
- **Automatic error source tracking** - filename included in all error messages
- Automatic charset detection from file.type
- Streaming for large files
- Clean and simple API

**With validation and error handling:**
```typescript
import { parseFile, ParseError } from 'web-csv-toolbox';

async function handleFileUpload(file: File) {
  // Validate file type
  if (!file.type.includes('csv') && !file.name.endsWith('.csv')) {
    throw new Error('Please upload a CSV file');
  }

  // Validate file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File too large (max 10MB)');
  }

  try {
    let count = 0;
    for await (const record of parseFile(file)) {
      // Process record (e.g., validate, save to database)
      count++;
    }
    return count;
  } catch (error) {
    if (error instanceof ParseError) {
      // Error includes filename automatically
      console.error(`Parse error in "${error.source}":`, error.message);
      // Example: 'Parse error in "data.csv": Field count exceeded at row 5'
      throw new Error(`Invalid CSV file: ${error.message}`);
    }
    throw error;
  }
}
```

---

### Scenario 2: Fetch Remote CSV

```typescript
import { parseResponse } from 'web-csv-toolbox';

async function fetchCSV(url: string) {
  const response = await fetch(url);

  for await (const record of parseResponse(response)) {
    console.log(record);
  }
}
```

**Why `parseResponse()`?**
- Automatic header processing (Content-Type, Content-Encoding)
- Streaming for large files
- Handles compression automatically

---

### Scenario 3: Parse CSV String from Database

```typescript
import { parseString } from 'web-csv-toolbox';

async function parseStoredCSV(csvText: string) {
  for await (const record of parseString(csvText)) {
    console.log(record);
  }
}
```

**Why `parseString()`?**
- Input is already a string
- No type detection overhead
- Clean and simple

---

### Scenario 4: Large File Processing (Node.js)

```typescript
import { parseStringStream, EnginePresets } from 'web-csv-toolbox';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

async function processLargeFile(filePath: string) {
  const nodeStream = createReadStream(filePath, 'utf-8');
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<string>;

  for await (const record of parseStringStream(webStream, {
    engine: EnginePresets.balanced(),
  })) {
    await processRecord(record);
  }
}
```

**Why `parseStringStream()`?**
- Streaming minimizes memory usage
- Worker execution for non-blocking processing
- Suitable for files of any size

---

### Scenario 5: Real-Time Data Processing

```typescript
import { parseStringStream } from 'web-csv-toolbox';

async function processRealtimeCSV(stream: ReadableStream<string>) {
  for await (const record of parseStringStream(stream)) {
    await sendToAnalytics(record);
  }
}
```

**Why `parseStringStream()`?**
- Streaming handles unbounded data
- Process records as they arrive
- Low latency

---

### Scenario 6: API Endpoint (Server)

```typescript
import { parseRequest } from 'web-csv-toolbox';

// Cloudflare Workers
export default {
  async fetch(request: Request) {
    if (request.method === 'POST' &&
        request.headers.get('content-type')?.includes('text/csv')) {

      const results = [];
      for await (const record of parseRequest(request)) {
        results.push(record);
      }

      return Response.json({
        success: true,
        count: results.length,
        data: results
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};
```

**Why `parseRequest()`?**
- Automatic header processing (Content-Type, Content-Encoding)
- Streaming for large uploads
- Built for server-side environments
- Resource limits prevent DoS

**With validation:**
```typescript
import { parseRequest } from 'web-csv-toolbox';

export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('text/csv')) {
      return new Response('Content-Type must be text/csv', {
        status: 400
      });
    }

    let count = 0;
    for await (const record of parseRequest(request, {
      maxFieldCount: 1000,  // Security limit
      maxBufferSize: 10 * 1024 * 1024  // 10MB limit
    })) {
      // Process record (e.g., validate, save to database)
      count++;
    }

    return Response.json({ success: true, count });
  }
};
```

---

## Performance Considerations

### Memory Usage

| API | Memory Usage | Best For |
|-----|--------------|----------|
| `parse()` | Depends on input type | Learning, prototyping |
| `parseString()` | O(n) - proportional to string size | Small to medium strings |
| `parseStringStream()` | O(1) - constant per record | Large streams |
| `parseBinary()` | O(n) - proportional to buffer size | Small to medium binary data |
| `parseBinaryStream()` | O(1) - constant per record | Large binary streams |
| `parseResponse()` | O(1) - streaming by default | HTTP responses |

---

### Execution Speed

**Main Thread:**
```typescript
// Blocks main thread during parsing
for await (const record of parseString(csv)) {
  console.log(record);
}
```

**Characteristics:**
- ✅ No worker communication overhead
- ❌ Blocks main thread during parsing
- **Use case:** Server-side parsing, scenarios where blocking is acceptable

---

**Worker Thread:**
```typescript
// Non-blocking UI
for await (const record of parseString(csv, {
  engine: { worker: true }
})) {
  console.log(record);
}
```

**Characteristics:**
- ✅ Non-blocking UI
- ⚠️ Worker communication adds overhead (data transfer between threads)
- **Performance trade-off:** Execution time may increase due to communication cost, but UI remains responsive
- **Use case:** Browser applications, scenarios requiring UI responsiveness

---

**WASM:**
```typescript
// Compiled WASM code
await loadWASM();
for await (const record of parseString(csv, {
  engine: { wasm: true }
})) {
  console.log(record);
}
```

**Characteristics:**
- ✅ Uses compiled WASM code
- ✅ No worker communication overhead
- ❌ Blocks main thread during parsing
- **Limitations:** UTF-8 only, double-quote only
- **Use case:** Server-side parsing with UTF-8 CSV files

---

**Worker + WASM:**
```typescript
// Non-blocking execution with compiled WASM code
await loadWASM();
for await (const record of parseString(csv, {
  engine: EnginePresets.responsiveFast()
})) {
  console.log(record);
}
```

**Characteristics:**
- ✅ Non-blocking UI
- ✅ Uses compiled WASM code
- ⚠️ Worker communication adds overhead (data transfer between threads)
- **Performance trade-off:** Execution time may increase due to communication cost, but UI remains responsive
- **Limitations:** UTF-8 only, double-quote only
- **Use case:** Browser applications requiring non-blocking parsing of UTF-8 CSV files

**Note:** This preset prioritizes UI responsiveness over raw execution speed. For fastest execution time, use `EnginePresets.fast()` on the main thread (blocks UI).

**Performance Note:**
Actual performance depends on many factors including CSV structure, file size, runtime environment, and system capabilities. Benchmark your specific use case to determine the best approach. See [CodSpeed benchmarks](https://codspeed.io/kamiazya/web-csv-toolbox) for measured performance across different scenarios.

---

## API Selection Matrix

| Input Type | Server-side | Browser (blocking OK) | Browser (non-blocking) | Encoding | API |
|------------|-------------|----------------------|------------------------|----------|-----|
| `string` | Main thread | Main thread | Worker | UTF-8 | `parseString()` |
| `string` | Main thread + WASM | Main thread | Worker | UTF-8 | `parseString()` |
| `string` | Main thread | Main thread | Worker | Any | `parseString()` |
| `ReadableStream<string>` | Main thread | Main thread | Worker + stream | UTF-8 | `parseStringStream()` |
| `Uint8Array` | Main thread | Main thread | Worker | UTF-8 | `parseBinary()` |
| `Uint8Array` | Main thread + WASM | Main thread | Worker | UTF-8 | `parseBinary()` |
| `Uint8Array` | Main thread | Main thread | Worker | Any | `parseBinary()` |
| `ReadableStream<Uint8Array>` | Main thread | Main thread | Main thread | Any | `parseBinaryStream()` |
| `Response` | Auto | Auto | Auto | Auto | `parseResponse()` |
| `Request` | Auto | Auto | Auto | Auto | `parseRequest()` |
| `Blob` / `File` | Main thread | Main thread | Main thread | Auto | `parseBlob()` / `parseFile()` |

**Note:** Choose execution strategy based on your requirements (blocking vs non-blocking) rather than file size alone. Benchmark your specific use case to determine the best approach.

---

## Error Handling

### Enhanced Error Reporting with Source Tracking

All parsing APIs support the `source` option to identify the origin of CSV data in error messages:

```typescript
import { parseString, parseFile, ParseError } from 'web-csv-toolbox';

// Automatic source tracking (parseFile only)
try {
  for await (const record of parseFile(file)) {
    // ...
  }
} catch (error) {
  if (error instanceof ParseError) {
    console.error(error.message);
    // "Field count (100001) exceeded maximum allowed count at row 5 in "data.csv""
    console.error('Source:', error.source); // "data.csv"
    console.error('Row:', error.rowNumber); // 5
    console.error('Position:', error.position); // { line, column, offset }
  }
}

// Manual source specification
try {
  for await (const record of parseString(csv, { source: 'user-import.csv' })) {
    // ...
  }
} catch (error) {
  if (error instanceof ParseError) {
    console.error(error.source); // "user-import.csv"
  }
}
```

### Common Error Types

**ParseError** - CSV syntax errors:
```typescript
import { ParseError } from 'web-csv-toolbox';

try {
  for await (const record of parseString(csv)) {
    // ...
  }
} catch (error) {
  if (error instanceof ParseError) {
    console.error('CSV syntax error:', error.message);
    console.error('  Source:', error.source);
    console.error('  Row:', error.rowNumber);
    console.error('  Position:', error.position);
  }
}
```

**RangeError** - Security limits exceeded:
```typescript
try {
  for await (const record of parseString(csv, {
    maxFieldCount: 1000,
    maxBufferSize: 10 * 1024 * 1024
  })) {
    // ...
  }
} catch (error) {
  if (error instanceof RangeError) {
    if (error.message.includes('Field count')) {
      console.error('Too many columns in CSV');
    } else if (error.message.includes('Buffer size')) {
      console.error('CSV field too large');
    }
  }
}
```

**DOMException (AbortError)** - Operation cancelled:
```typescript
const controller = new AbortController();

try {
  for await (const record of parseString(csv, {
    signal: controller.signal
  })) {
    // ...
  }
} catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    console.log('Parsing cancelled by user');
  }
}
```

### Best Practices for Error Handling

✅ **Always use try-catch** with async iteration:
```typescript
try {
  for await (const record of parseFile(file)) {
    await processRecord(record);
  }
} catch (error) {
  // Handle errors
}
```

✅ **Check error types** for specific handling:
```typescript
if (error instanceof ParseError) {
  // CSV format error
} else if (error instanceof RangeError) {
  // Security limit exceeded
} else if (error instanceof DOMException) {
  // Abort or timeout
}
```

✅ **Include context** in error messages:
```typescript
catch (error) {
  throw new Error(`Failed to process ${file.name}: ${error.message}`);
}
```

❌ **Don't ignore errors**:
```typescript
// BAD
for await (const record of parseFile(file)) {
  // No error handling
}
```

---

## Best Practices

### ✅ Do

- **Use middle-level APIs in production** for optimal performance
- **Use `parseResponse()` for fetch()** to get automatic header processing
- **Use streaming APIs for large files** (>10MB)
- **Use `EnginePresets` for execution strategies** instead of manual configuration
- **Reuse `WorkerPool`** across multiple parse operations
- **Call `loadWASM()` once at startup** if using WASM

### ❌ Don't

- **Don't use `parse()` in production** when input type is known
- **Don't load entire large files into memory** - use streams
- **Don't create new workers for each parse** - use `WorkerPool`
- **Don't use WASM for non-UTF-8 files** - it will fall back to JavaScript
- **Don't forget error handling** - wrap in try-catch

---

## Migration Guide

### From parse() to Specialized APIs

**Before (High-level):**
```typescript
import { parse } from 'web-csv-toolbox';

const response = await fetch('data.csv');
for await (const record of parse(response)) {
  console.log(record);
}
```

**After (Middle-level):**
```typescript
import { parseResponse } from 'web-csv-toolbox';

const response = await fetch('data.csv');
for await (const record of parseResponse(response)) {
  console.log(record);
}
```

**Benefits:**
- Eliminates type detection overhead
- Clearer intent
- Better TypeScript inference

---

## Related Documentation

- **[parse() API Reference](https://kamiazya.github.io/web-csv-toolbox/functions/parse.html)** - High-level universal API
- **[parseString() API Reference](https://kamiazya.github.io/web-csv-toolbox/functions/parseString.html)** - String parser
- **[parseResponse() API Reference](https://kamiazya.github.io/web-csv-toolbox/functions/parseResponse.html)** - Response parser
- **[parseRequest() API Reference](https://kamiazya.github.io/web-csv-toolbox/functions/parseRequest.html)** - Request parser (server-side)
- **[parseBlob() API Reference](https://kamiazya.github.io/web-csv-toolbox/functions/parseBlob.html)** - Blob/File parser
- **[parseFile() API Reference](https://kamiazya.github.io/web-csv-toolbox/functions/parseFile.html)** - File parser with automatic error source
- **[Execution Strategies](../explanation/execution-strategies.md)** - Understanding execution modes
- **[Working with Workers](../tutorials/working-with-workers.md)** - Worker threads guide

---

## Summary

**Quick recommendations:**

1. **Learning/Prototyping:** Use `parse()` for simplicity
2. **Production (known input type):** Use specialized middle-level APIs
3. **HTTP responses (client):** Use `parseResponse()` for automatic header handling
4. **HTTP requests (server):** Use `parseRequest()` for server-side request handling
5. **File uploads:** Use `parseFile()` for automatic error tracking, or `parseBlob()` for generic Blob support
6. **Edge environments:** Use `parseBlob()` with manual `source` option (Cloudflare Workers compatibility)
7. **Large files:** Use streaming APIs (`parseStringStream()`, `parseBinaryStream()`)
8. **Non-blocking parsing:** Use Worker-based execution (e.g., `{ engine: { worker: true } }` or `EnginePresets.responsive()`) for UI responsiveness in browser applications
9. **Non-UTF-8:** Use `parseBinary()` or `parseBinaryStream()` with `charset` option
10. **Error tracking:** Always specify `source` option or use `parseFile()` for automatic tracking

**Remember:** The best API depends on your specific use case. Consider input type, encoding, execution environment (server vs browser), and blocking vs non-blocking requirements when choosing. Benchmark your actual data to make informed decisions.
