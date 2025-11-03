# parse() API Reference

The **parse()** function is a high-level, beginner-friendly API for parsing CSV data in web-csv-toolbox. It automatically handles different input types (strings, streams, binaries, responses) and provides a unified interface.

**Note:** For production applications, consider using specialized middle-level APIs ([parseString](./parse-string.md), [parseResponse](./parse-response.md), etc.) which offer better performance by avoiding input type detection overhead.

## Overview

```typescript
import { parse } from 'web-csv-toolbox';

const csv = `name,age
Alice,30
Bob,25`;

for await (const record of parse(csv)) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
// { name: 'Bob', age: '25' }
```

---

## Function Signatures

### Parse CSV String

```typescript
function parse<Header>(
  csv: string,
  options?: ParseOptions<Header>
): AsyncIterableIterator<CSVRecord<Header>>
```

### Parse Binary Data

```typescript
function parse<Header>(
  csv: Uint8Array | ArrayBuffer,
  options?: ParseBinaryOptions<Header>
): AsyncIterableIterator<CSVRecord<Header>>
```

### Parse Streams

```typescript
function parse<Header>(
  csv: ReadableStream<string | Uint8Array>,
  options?: ParseOptions<Header> | ParseBinaryOptions<Header>
): AsyncIterableIterator<CSVRecord<Header>>
```

### Parse HTTP Response

```typescript
function parse<Header>(
  csv: Response,
  options?: ParseBinaryOptions<Header>
): AsyncIterableIterator<CSVRecord<Header>>
```

---

## Parameters

### `csv`

**Type:** `string | Uint8Array | ArrayBuffer | ReadableStream | Response`

The CSV data to parse.

**Supported types:**
- `string` - CSV text
- `Uint8Array` - Binary CSV data
- `ArrayBuffer` - Binary CSV data
- `ReadableStream<string>` - Stream of CSV text
- `ReadableStream<Uint8Array>` - Stream of binary CSV data
- `Response` - HTTP response containing CSV

### `options`

**Type:** `ParseOptions<Header>` or `ParseBinaryOptions<Header>`

Parsing configuration options.

#### Common Options (ParseOptions)

```typescript
interface ParseOptions<Header> {
  delimiter?: string;
  quotation?: string;
  header?: Header;
  maxFieldCount?: number;
  maxBufferSize?: number;
  signal?: AbortSignal;
  engine?: EngineConfig;
}
```

##### `delimiter`

**Type:** `string`
**Default:** `','`

Field delimiter character.

**Example:**
```typescript
// Tab-separated values (TSV)
for await (const record of parse(csv, { delimiter: '\t' })) {
  console.log(record);
}
```

---

##### `quotation`

**Type:** `string`
**Default:** `'"'`

Quotation character for escaping fields.

**Example:**
```typescript
// Single-quote CSV
for await (const record of parse(csv, { quotation: "'" })) {
  console.log(record);
}
```

**Note:** WebAssembly execution only supports double-quote (`"`).

---

##### `header`

**Type:** `ReadonlyArray<string>`
**Default:** `undefined` (extract from first row)

Pre-defined header fields.

**Example:**
```typescript
// CSV without header row
const csv = `Alice,30\nBob,25`;

for await (const record of parse(csv, {
  header: ['name', 'age']
})) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
// { name: 'Bob', age: '25' }
```

---

##### `maxFieldCount`

**Type:** `number`
**Default:** `100000` (100k fields)

Maximum number of fields allowed per record.

**Why:** Protects against CSV bombs (DoS attacks).

**Example:**
```typescript
for await (const record of parse(csv, {
  maxFieldCount: 1000 // Limit to 1000 fields
})) {
  console.log(record);
}
```

---

##### `maxBufferSize`

**Type:** `number`
**Default:** `10485760` (10MB)

Maximum buffer size in characters.

**Why:** Prevents memory exhaustion from extremely long fields.

**Example:**
```typescript
for await (const record of parse(csv, {
  maxBufferSize: 50 * 1024 * 1024 // 50MB
})) {
  console.log(record);
}
```

---

##### `signal`

**Type:** `AbortSignal`
**Default:** `undefined`

AbortSignal for canceling parsing operations.

**Example:**
```typescript
const controller = new AbortController();
const signal = controller.signal;

// Abort after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  for await (const record of parse(csv, { signal })) {
    console.log(record);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Parsing was aborted');
  }
}
```

---

##### `engine`

**Type:** `EngineConfig`
**Default:** `{ worker: false, wasm: false }`

Execution strategy configuration.

**Example:**
```typescript
import { parse, EnginePresets } from 'web-csv-toolbox';

// Use fastest available execution method
for await (const record of parse(csv, {
  engine: EnginePresets.fastest
})) {
  console.log(record);
}
```

See: [Engine Configuration](../engine-config.md), [Engine Presets](../engine-presets.md)

---

#### Binary Options (ParseBinaryOptions)

Extends `ParseOptions` with additional binary-specific options:

```typescript
interface ParseBinaryOptions<Header> extends ParseOptions<Header> {
  charset?: string;
  decompression?: 'gzip' | 'deflate' | 'deflate-raw';
  ignoreBOM?: boolean;
}
```

##### `charset`

**Type:** `string`
**Default:** `'utf-8'`

Character encoding of the binary data.

**Supported encodings:**
- `'utf-8'` (recommended)
- `'shift-jis'` (Japanese)
- `'euc-jp'` (Japanese)
- `'windows-1252'` (Western European)
- And many more (via TextDecoder)

**Example:**
```typescript
// Japanese CSV encoded in Shift-JIS
for await (const record of parse(binary, {
  charset: 'shift-jis'
})) {
  console.log(record);
}
```

**Note:** WebAssembly execution only supports UTF-8.

---

##### `decompression`

**Type:** `'gzip' | 'deflate' | 'deflate-raw'`
**Default:** `undefined` (no decompression)

Decompression method for compressed CSV data.

**Example:**
```typescript
// Gzipped CSV
const response = await fetch('https://example.com/data.csv.gz');

for await (const record of parse(response, {
  decompression: 'gzip'
})) {
  console.log(record);
}
```

---

##### `ignoreBOM`

**Type:** `boolean`
**Default:** `true`

Whether to ignore Byte Order Mark (BOM) at the beginning of the file.

**Example:**
```typescript
// CSV with BOM
for await (const record of parse(binary, {
  ignoreBOM: true // Skip BOM
})) {
  console.log(record);
}
```

---

## Returns

`AsyncIterableIterator<CSVRecord<Header>>`

An async iterable iterator that yields CSV records one at a time.

**Record structure:**
```typescript
type CSVRecord<Header> = {
  [K in Header[number]]: string | undefined
};
```

**Example:**
```typescript
// CSV: name,age\nAlice,30
// Record type: { name: string | undefined, age: string | undefined }
// Record value: { name: 'Alice', age: '30' }
```

---

## Usage Examples

### Example 1: Parse CSV String

```typescript
import { parse } from 'web-csv-toolbox';

const csv = `name,age,city
Alice,30,New York
Bob,25,San Francisco`;

for await (const record of parse(csv)) {
  console.log(record);
}
// { name: 'Alice', age: '30', city: 'New York' }
// { name: 'Bob', age: '25', city: 'San Francisco' }
```

---

### Example 2: Parse with Custom Delimiter

```typescript
import { parse } from 'web-csv-toolbox';

// Tab-separated values (TSV)
const tsv = `name\tage\tcity
Alice\t30\tNew York
Bob\t25\tSan Francisco`;

for await (const record of parse(tsv, { delimiter: '\t' })) {
  console.log(record);
}
```

---

### Example 3: Parse CSV without Header

```typescript
import { parse } from 'web-csv-toolbox';

const csv = `Alice,30,New York
Bob,25,San Francisco`;

for await (const record of parse(csv, {
  header: ['name', 'age', 'city']
})) {
  console.log(record);
}
// { name: 'Alice', age: '30', city: 'New York' }
// { name: 'Bob', age: '25', city: 'San Francisco' }
```

---

### Example 4: Parse from Network

```typescript
import { parse } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv');

for await (const record of parse(response)) {
  console.log(record);
}
```

---

### Example 5: Parse with Worker Threads

```typescript
import { parse, EnginePresets } from 'web-csv-toolbox';

// Non-blocking parsing with worker thread
for await (const record of parse(csv, {
  engine: EnginePresets.balanced
})) {
  console.log(record);
  // UI stays responsive!
}
```

---

### Example 6: Parse Gzipped CSV

```typescript
import { parse } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv.gz');

for await (const record of parse(response, {
  decompression: 'gzip'
})) {
  console.log(record);
}
```

---

### Example 7: Parse with Timeout

```typescript
import { parse } from 'web-csv-toolbox';

const controller = new AbortController();
const signal = controller.signal;

// Abort after 30 seconds
setTimeout(() => controller.abort(), 30000);

try {
  for await (const record of parse(csv, { signal })) {
    console.log(record);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Parsing timed out');
  }
}
```

---

### Example 8: Parse with Type Safety

```typescript
import { parse } from 'web-csv-toolbox';

const csv = `name,age
Alice,30
Bob,25`;

type Header = ['name', 'age'];

for await (const record of parse<Header>(csv)) {
  // TypeScript knows: record.name and record.age
  console.log(record.name); // ✅ Type-safe
  console.log(record.age);  // ✅ Type-safe
}
```

---

### Example 9: Parse Binary Data

```typescript
import { parse } from 'web-csv-toolbox';

// Uint8Array or ArrayBuffer
const binary = new Uint8Array([/* CSV binary data */]);

for await (const record of parse(binary, {
  charset: 'utf-8'
})) {
  console.log(record);
}
```

---

### Example 10: Parse Stream

```typescript
import { parse } from 'web-csv-toolbox';

// ReadableStream<string> or ReadableStream<Uint8Array>
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue('name,age\r\n');
    controller.enqueue('Alice,30\r\n');
    controller.close();
  }
});

for await (const record of parse(stream)) {
  console.log(record);
}
```

---

## parse.toArray()

Collects all records into an array.

```typescript
function parse.toArray<Header>(
  csv: string | Uint8Array | ArrayBuffer | ReadableStream | Response,
  options?: ParseOptions<Header> | ParseBinaryOptions<Header>
): Promise<CSVRecord<Header>[]>
```

### Example

```typescript
import { parse } from 'web-csv-toolbox';

const csv = `name,age
Alice,30
Bob,25`;

const records = await parse.toArray(csv);

console.log(records);
// [
//   { name: 'Alice', age: '30' },
//   { name: 'Bob', age: '25' }
// ]
```

**⚠️ Warning:** Loads entire result into memory. Not suitable for very large files (>100MB).

**Use case:** Small datasets, quick prototyping, testing.

---

## Error Handling

### ParseError

Thrown when CSV syntax is invalid.

```typescript
try {
  for await (const record of parse('"Unclosed quote')) {
    console.log(record);
  }
} catch (error) {
  if (error.name === 'ParseError') {
    console.error('CSV syntax error:', error.message);
    console.error('Position:', error.position);
  }
}
```

---

### RangeError

Thrown when resource limits are exceeded.

```typescript
try {
  for await (const record of parse(csv, {
    maxBufferSize: 1000
  })) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof RangeError) {
    console.error('Resource limit exceeded:', error.message);
  }
}
```

---

### AbortError

Thrown when parsing is canceled via AbortSignal.

```typescript
const controller = new AbortController();

setTimeout(() => controller.abort(), 1000);

try {
  for await (const record of parse(csv, {
    signal: controller.signal
  })) {
    console.log(record);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Parsing was aborted');
  }
}
```

---

### TypeError

Thrown when input is invalid.

```typescript
try {
  const response = new Response(null); // Empty body
  for await (const record of parse(response)) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof TypeError) {
    console.error('Invalid input:', error.message);
    // "Response body is null"
  }
}
```

---

## Performance Characteristics

### Memory Usage

**O(1)** - Constant memory per record

- Only stores current record being processed
- Memory usage independent of file size
- Suitable for arbitrarily large CSV files

### Processing Speed

**Depends on execution strategy:**

| Strategy | Performance | Blocking |
|----------|-------------|----------|
| Main thread (JS) | Baseline | Yes |
| Main thread (WASM) | Improved | Yes |
| Worker (JS) | Baseline | No |
| Worker (WASM) | Improved | No |

For actual benchmarks, see [CodSpeed](https://codspeed.io/kamiazya/web-csv-toolbox).

---

## Automatic Input Type Detection

The `parse()` function automatically detects the input type:

```typescript
┌─────────────────────────────────────────────────────────┐
│ parse(input)                                             │
└─────────────────────────────────────────────────────────┘
                        ↓
        ┌───────────────┴───────────────┐
        │ Detect input type              │
        └───────────────┬───────────────┘
                        ↓
    ┌───────────────────┴───────────────────┐
    │                                       │
    ↓                                       ↓
  string                              Uint8Array/ArrayBuffer
    │                                       │
    ↓                                       ↓
parseString()                          parseBinary()

    ↓                                       ↓
ReadableStream                         Response
    │                                       │
    ├─ ReadableStream<string>               ↓
    │  → parseStringStream()            parseResponse()
    │
    └─ ReadableStream<Uint8Array>
       → parseUint8ArrayStream()
```

**Benefit:** Single API for all input types.

---

## Comparison with Specialized APIs

| Feature | `parse()` | `parseString()` | `parseResponse()` |
|---------|-----------|-----------------|-------------------|
| **Input types** | Multiple | String only | Response only |
| **Type detection** | Automatic | N/A | N/A |
| **Performance** | Baseline (detection overhead) | Faster (no detection) | Faster (no detection) |
| **Use case** | Prototyping, learning | Production (string input) | Production (network fetching) |

**Recommendation:**
- **For beginners/prototyping:** Use `parse()` for simplicity and flexibility
- **For production:** Use specialized middle-level APIs (`parseString`, `parseResponse`, etc.) for better performance

---

## Related APIs

- **[parseString()](./parse-string.md)** - Parse CSV string
- **[parseResponse()](./parse-response.md)** - Parse HTTP response
- **[parseBinary()](./parse-binary.md)** - Parse binary data
- **[parseStringStream()](./parse-string-stream.md)** - Parse string stream
- **[parseUint8ArrayStream()](./parse-uint8array-stream.md)** - Parse binary stream

---

## Browser and Runtime Support

`parse()` works across all supported runtimes:

- ✅ Node.js LTS
- ✅ Deno LTS
- ✅ Modern browsers (Chrome, Firefox, Edge, Safari)

See: [Supported Environments](../supported-environments.md)

---

## Best Practices

### ✅ Do

- Use `parse()` for **learning, prototyping, and quick scripts**
- Use specialized APIs (`parseString`, `parseResponse`) for **production**
- Use `for await...of` for streaming processing
- Set appropriate resource limits (`maxBufferSize`, `maxFieldCount`)
- Use `AbortSignal` for cancelable operations
- Handle errors gracefully
- Use engine presets for optimal performance

### ❌ Don't

- Don't use `parse()` in production when input type is known (use specialized APIs instead)
- Don't accumulate all records in memory (defeats streaming purpose)
- Don't ignore errors
- Don't remove resource limits (security risk)
- Don't use `parse.toArray()` for very large files (>100MB)

---

## TypeScript Types

```typescript
import type { CSVRecord, ParseOptions, ParseBinaryOptions } from 'web-csv-toolbox';

// parse() return type
type ParseResult<Header extends ReadonlyArray<string>> =
  AsyncIterableIterator<CSVRecord<Header>>;

// CSVRecord type
type CSVRecord<Header extends ReadonlyArray<string>> = {
  [K in Header[number]]: string | undefined;
};

// Example with explicit types
const csv = `name,age\nAlice,30`;
type MyHeader = ['name', 'age'];

for await (const record of parse<MyHeader>(csv)) {
  // record: { name: string | undefined, age: string | undefined }
  console.log(record.name);
  console.log(record.age);
}
```

---

## Summary

The `parse()` function is a beginner-friendly high-level API for CSV parsing:

1. **Automatic input detection** - Handles strings, binaries, streams, responses
2. **Streaming** - Memory-efficient O(1) processing
3. **Flexible** - Supports all parsing options
4. **Type-safe** - Full TypeScript support
5. **Simple** - Single API for all input types

**Use cases:**
- ✅ Learning and prototyping
- ✅ Quick scripts and demos
- ✅ When input type varies at runtime
- ❌ Production applications (use specialized APIs instead)

**Quick start (learning/prototyping):**
```typescript
import { parse } from 'web-csv-toolbox';

for await (const record of parse(csv)) {
  console.log(record);
}
```

**Production (use specialized APIs):**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

// Better performance - no input type detection overhead
for await (const record of parseString(csv, {
  engine: EnginePresets.balanced
})) {
  console.log(record);
}
```

**See:** [parseString()](./parse-string.md), [parseResponse()](./parse-response.md) for production-ready APIs.
