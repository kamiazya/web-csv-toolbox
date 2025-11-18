# parseBinary() API Reference

Parse binary CSV data (Uint8Array or ArrayBuffer) with support for multiple encodings, compression, and BOM handling.

## Overview

`parseBinary()` is a middle-level API optimized for parsing CSV data from binary sources like `Uint8Array` or `ArrayBuffer`. It supports non-UTF-8 encodings, compression, and automatic BOM handling.

**Category:** Middle-level API (Production)

**Input:** `Uint8Array | ArrayBuffer`

**Output:** `AsyncIterableIterator<CSVRecord<Header>>`

---

## Function Signature

```typescript
function parseBinary<Header extends ReadonlyArray<string>>(
  bytes: Uint8Array | ArrayBuffer,
  options?: ParseBinaryOptions<Header>
): AsyncIterableIterator<CSVRecord<Header>>
```

---

## Parameters

### `bytes`

**Type:** `Uint8Array | ArrayBuffer`

**Required:** Yes

The binary CSV data to parse.

**Example:**
```typescript
// From File API
const buffer = await file.arrayBuffer();
const bytes = new Uint8Array(buffer);

// From fetch
const response = await fetch('data.csv');
const buffer = await response.arrayBuffer();
```

---

### `options`

**Type:** `ParseBinaryOptions<Header>`

**Required:** No

Parsing options including binary-specific settings.

```typescript
interface ParseBinaryOptions<Header> extends ParseOptions<Header> {
  // Binary-specific options
  charset?: string;              // Default: 'utf-8'
  decompression?: 'gzip' | 'deflate' | 'deflate-raw';  // deflate-raw is experimental
  ignoreBOM?: boolean;           // Default: false

  // Common parsing options
  delimiter?: string;            // Default: ','
  quotation?: string;            // Default: '"'
  headerList?: Header;
  maxBufferSize?: number;        // Default: 10485760 (10MB)
  engine?: EngineConfig;
  signal?: AbortSignal;
}
```

#### Binary-Specific Options

##### `charset`

**Type:** `string`

**Default:** `'utf-8'`

Character encoding of the binary data.

**Supported encodings:** All encodings supported by the platform's TextDecoder API.

**Common values:**
- `'utf-8'` (default) - Universal encoding
- `'shift-jis'` - Japanese (Shift JIS)
- `'euc-jp'` - Japanese (EUC)
- `'iso-2022-jp'` - Japanese (JIS)
- `'gb2312'` - Simplified Chinese
- `'big5'` - Traditional Chinese
- `'euc-kr'` - Korean
- `'iso-8859-1'` - Latin-1 (Western European)
- `'windows-1252'` - Windows Western European

**Example:**
```typescript
import { parseBinary } from 'web-csv-toolbox';

// Parse Shift-JIS encoded CSV
const shiftJISData = new Uint8Array([...]);
for await (const record of parseBinary(shiftJISData, {
  charset: 'shift-jis'
})) {
  console.log(record);
}
```

---

##### `decompression`

**Type:** `'gzip' | 'deflate' | 'deflate-raw'` (and `'br'` if supported by browser)

**Default:** `undefined` (no decompression)

Single decompression algorithm to apply before parsing. Accepts one compression format supported by the platform's `DecompressionStream` API.

**Note:** For data compressed with multiple algorithms (e.g., Content-Encoding: `gzip, deflate`), you must chain `DecompressionStream` instances manually. This option only accepts a single algorithm.

**Example (single compression):**
```typescript
import { parseBinary } from 'web-csv-toolbox';

// Parse gzip-compressed CSV
const gzippedData = new Uint8Array([...]);
for await (const record of parseBinary(gzippedData, {
  decompression: 'gzip'
})) {
  console.log(record);
}
```

**Example (multiple compressions - manual chaining):**
```typescript
import { parseUint8ArrayStream } from 'web-csv-toolbox';

// Data compressed with both gzip and deflate (applied in that order)
const doubleCompressedData = new Uint8Array([...]);
const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(doubleCompressedData);
    controller.close();
  }
});

// Decompress in reverse order: first deflate, then gzip
const decompressed = stream
  .pipeThrough(new DecompressionStream('deflate'))
  .pipeThrough(new DecompressionStream('gzip'));

for await (const record of parseUint8ArrayStream(decompressed)) {
  console.log(record);
}
```

**Platform support:** Requires `DecompressionStream` API. See [MDN Compatibility](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream#browser_compatibility).

---

##### `ignoreBOM`

**Type:** `boolean`

**Default:** `false`

Whether to ignore Byte Order Mark (BOM) at the beginning of the file.

**Common BOMs:**
- UTF-8: `EF BB BF`
- UTF-16 BE: `FE FF`
- UTF-16 LE: `FF FE`

**Example:**
```typescript
import { parseBinary } from 'web-csv-toolbox';

// Ignore BOM if present
for await (const record of parseBinary(bytes, {
  ignoreBOM: true
})) {
  console.log(record);
}
```

---

#### Common Parsing Options

See [parseString() API Reference](./parseString.md#common-options) for detailed descriptions of:
- `delimiter`
- `quotation`
- `headerList`
- `maxBufferSize`
- `engine`
- `signal`

---

## Returns

`AsyncIterableIterator<CSVRecord<Header>>`

An async iterable iterator that yields CSV records one by one.

---

## Usage Examples

### Example 1: Basic Usage (UTF-8)

```typescript
import { parseBinary } from 'web-csv-toolbox';

const file = document.querySelector('input[type="file"]').files[0];
const buffer = await file.arrayBuffer();

for await (const record of parseBinary(buffer)) {
  console.log(record);
}
```

---

### Example 2: Shift-JIS Encoded CSV (Japanese)

```typescript
import { parseBinary } from 'web-csv-toolbox';

const shiftJISData = new Uint8Array([
  // Shift-JIS encoded CSV data
  0x96, 0xBC, 0x91, 0x4F, 0x2C, 0x94, 0xBD, 0x97, 0xEE, 0x0A, // 名前,年齢
  // ...
]);

for await (const record of parseBinary(shiftJISData, {
  charset: 'shift-jis'
})) {
  console.log(record);
}
```

---

### Example 3: Compressed CSV (gzip)

```typescript
import { parseBinary } from 'web-csv-toolbox';

const response = await fetch('data.csv.gz');
const compressedData = new Uint8Array(await response.arrayBuffer());

for await (const record of parseBinary(compressedData, {
  decompression: 'gzip'
})) {
  console.log(record);
}
```

---

### Example 4: With BOM Handling

```typescript
import { parseBinary } from 'web-csv-toolbox';

// CSV with UTF-8 BOM (EF BB BF)
const dataWithBOM = new Uint8Array([
  0xEF, 0xBB, 0xBF, // UTF-8 BOM
  0x6E, 0x61, 0x6D, 0x65, 0x2C, 0x61, 0x67, 0x65, // name,age
  // ...
]);

for await (const record of parseBinary(dataWithBOM, {
  ignoreBOM: true
})) {
  console.log(record);
}
```

---

### Example 5: From File Upload

```typescript
import { parseBinary } from 'web-csv-toolbox';

async function handleFileUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const buffer = await file.arrayBuffer();

  for await (const record of parseBinary(buffer, {
    charset: 'utf-8',
    ignoreBOM: true
  })) {
    console.log(record);
  }
}

document.querySelector('#file-input')
  .addEventListener('change', handleFileUpload);
```

---

### Example 6: With Worker Execution

```typescript
import { parseBinary, EnginePresets } from 'web-csv-toolbox';

const file = document.querySelector('input[type="file"]').files[0];
const buffer = await file.arrayBuffer();

// Non-blocking parsing
for await (const record of parseBinary(buffer, {
  charset: 'utf-8',
  engine: EnginePresets.balanced()
})) {
  console.log(record);
  // UI stays responsive!
}
```

---

### Example 7: With WASM (UTF-8 Only)

```typescript
import { parseBinary, loadWASM, EnginePresets } from 'web-csv-toolbox';

await loadWASM();

const buffer = await file.arrayBuffer();

// Fast parsing for large UTF-8 files
for await (const record of parseBinary(buffer, {
  charset: 'utf-8',
  engine: EnginePresets.responsiveFast()
})) {
  console.log(record);
}
```

⚠️ **Note:** WASM only supports UTF-8. For other encodings, use JavaScript engine.

---

### Example 8: Error Handling

```typescript
import { parseBinary } from 'web-csv-toolbox';

try {
  const buffer = await file.arrayBuffer();

  for await (const record of parseBinary(buffer, {
    charset: 'shift-jis'
  })) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof TypeError) {
    console.error('Encoding error:', error.message);
  } else if (error instanceof RangeError) {
    console.error('Buffer size exceeded:', error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

---

### Example 9: Multiple Encodings Detection

```typescript
import { parseBinary } from 'web-csv-toolbox';

async function parseWithEncodingDetection(buffer: ArrayBuffer) {
  const encodings = ['utf-8', 'shift-jis', 'euc-jp', 'iso-2022-jp'];

  for (const charset of encodings) {
    try {
      let count = 0;
      for await (const record of parseBinary(buffer, { charset })) {
        // Process record
        count++;
      }

      console.log(`Successfully parsed with ${charset}`);
      return { charset, count };
    } catch (error) {
      console.log(`Failed with ${charset}:`, error.message);
    }
  }

  throw new Error('Could not detect encoding');
}
```

---

### Example 10: Batch Processing

```typescript
import { parseBinary } from 'web-csv-toolbox';

const buffer = await file.arrayBuffer();
const BATCH_SIZE = 1000;
let batch: any[] = [];

for await (const record of parseBinary(buffer, {
  charset: 'utf-8'
})) {
  batch.push(record);

  if (batch.length >= BATCH_SIZE) {
    await processBatch(batch);
    batch = [];
  }
}

// Process remaining records
if (batch.length > 0) {
  await processBatch(batch);
}
```

---

## Namespace Methods

### parseBinary.toArray()

Convert binary CSV to an array of records.

```typescript
function toArray<Header extends ReadonlyArray<string>>(
  bytes: Uint8Array | ArrayBuffer,
  options?: ParseBinaryOptions<Header>
): Promise<CSVRecord<Header>[]>
```

**Example:**
```typescript
import { parseBinary } from 'web-csv-toolbox';

const buffer = await file.arrayBuffer();
const records = await parseBinary.toArray(buffer, {
  charset: 'shift-jis'
});

console.log(records);
```

---

### parseBinary.toArraySync()

Synchronously convert binary CSV to an array.

```typescript
function toArraySync<Header extends ReadonlyArray<string>>(
  bytes: Uint8Array | ArrayBuffer,
  options?: ParseBinaryOptions<Header>
): CSVRecord<Header>[]
```

**Example:**
```typescript
import { parseBinary } from 'web-csv-toolbox';

const bytes = new Uint8Array([...]);
const records = parseBinary.toArraySync(bytes);

console.log(records);
```

---

### parseBinary.toIterableIterator()

Get a synchronous iterable iterator.

```typescript
function toIterableIterator<Header extends ReadonlyArray<string>>(
  bytes: Uint8Array,
  options?: ParseBinaryOptions<Header>
): IterableIterator<CSVRecord<Header>>
```

**Example:**
```typescript
import { parseBinary } from 'web-csv-toolbox';

const bytes = new Uint8Array([...]);

for (const record of parseBinary.toIterableIterator(bytes)) {
  console.log(record);
}
```

---

### parseBinary.toStream()

Convert to a ReadableStream of records.

```typescript
function toStream<Header extends ReadonlyArray<string>>(
  bytes: Uint8Array,
  options?: ParseBinaryOptions<Header>
): ReadableStream<CSVRecord<Header>>
```

**Example:**
```typescript
import { parseBinary } from 'web-csv-toolbox';

const bytes = new Uint8Array([...]);
const stream = parseBinary.toStream(bytes);

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

**Recommendation:** Use streaming for files >10MB.

---

### Encoding Conversion Overhead

| Encoding | Overhead | Notes |
|----------|----------|-------|
| UTF-8 | Minimal | Native platform support |
| Shift-JIS | Low | Fast conversion |
| EUC-JP | Low | Fast conversion |
| Other | Varies | Depends on platform |

**Note:** All encoding conversion is handled by the platform's `TextDecoder` API.

---

### Decompression

Decompression is handled in streaming fashion by the platform's `DecompressionStream` API:

```
Binary → Decompress → Decode (charset) → Parse → Yield records
  ↓         ↓             ↓                ↓          ↓
Chunk    Streaming    Streaming        Streaming  Streaming
```

**Memory:** O(1) - constant regardless of file size

---

## Supported Character Encodings

### Japanese

- `shift-jis` / `shift_jis` / `sjis` - Shift JIS
- `euc-jp` - EUC-JP
- `iso-2022-jp` - ISO-2022-JP (JIS)

### Chinese

- `gb2312` / `gbk` / `gb18030` - Simplified Chinese
- `big5` - Traditional Chinese

### Korean

- `euc-kr` - EUC-KR
- `iso-2022-kr` - ISO-2022-KR

### European

- `iso-8859-1` through `iso-8859-15` - Latin encodings
- `windows-1252` - Windows Western European
- `utf-16le` - UTF-16 Little Endian
- `utf-16be` - UTF-16 Big Endian

See [MDN: TextDecoder](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/encoding) for complete list.

---

## Error Handling

### TypeError - Invalid Encoding

```typescript
import { parseBinary } from 'web-csv-toolbox';

try {
  for await (const record of parseBinary(bytes, {
    charset: 'invalid-encoding'
  })) {
    console.log(record);
  }
} catch (error) {
  console.error('Invalid encoding:', error.message);
}
```

---

### RangeError - Buffer Size Exceeded

```typescript
import { parseBinary } from 'web-csv-toolbox';

try {
  const largeBytes = new Uint8Array(20_000_000); // 20MB

  for await (const record of parseBinary(largeBytes, {
    maxBufferSize: 10_000_000 // 10MB
  })) {
    console.log(record);
  }
} catch (error) {
  console.error('Buffer exceeded:', error.message);
}
```

---

## Comparison with Other APIs

### parseBinary() vs parseString()

| Feature | `parseBinary()` | `parseString()` |
|---------|----------------|-----------------|
| **Input type** | `Uint8Array`, `ArrayBuffer` | `string` |
| **Encoding support** | All (via charset) | UTF-16 (JS strings) |
| **Compression** | Yes | No |
| **BOM handling** | Yes | No |
| **Use case** | Binary data, files | Text data |

---

### parseBinary() vs parseUint8ArrayStream()

| Feature | `parseBinary()` | `parseUint8ArrayStream()` |
|---------|----------------|---------------------------|
| **Input type** | `Uint8Array`, `ArrayBuffer` | `ReadableStream<Uint8Array>` |
| **Memory (small)** | O(n) | O(1) |
| **Memory (large)** | O(n) | O(1) |
| **Best for** | Small to medium files | Large files, streams |

**Recommendation:** Use `parseUint8ArrayStream()` for files >10MB.

---

## Browser and Runtime Support

| Runtime | Support | TextDecoder | DecompressionStream |
|---------|---------|-------------|---------------------|
| Chrome | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ |
| Edge | ✅ | ✅ | ✅ |
| Safari | ✅ | ✅ | ✅ |
| Node.js 18+ | ✅ | ✅ | ✅ |
| Deno | ✅ | ✅ | ✅ |

See: [Supported Environments](../supported-environments.md)

---

## Related Documentation

- **[Choosing the Right API](../../how-to-guides/choosing-the-right-api.md)** - API selection guide
- **[parseUint8ArrayStream() API Reference](./parseUint8ArrayStream.md)** - Binary stream parser
- **[parseString() API Reference](./parseString.md)** - String parser
- **[Working with Workers](../../tutorials/working-with-workers.md)** - Worker threads guide

---

## Best Practices

### ✅ Do

- Use `parseBinary()` for file uploads
- Specify correct `charset` for non-UTF-8 files
- Use `ignoreBOM: true` when BOM is present
- Use streaming for large files
- Handle encoding errors gracefully
- Use Worker execution for large files

### ❌ Don't

- Don't use for already-decoded strings (use `parseString()`)
- Don't load very large files entirely into memory
- Don't guess encodings - detect or ask user
- Don't ignore error handling
- Don't use WASM engine with non-UTF-8 encodings

---

## Summary

`parseBinary()` is the optimal choice for parsing binary CSV data:

**Key Features:**
- ✅ Multiple character encoding support
- ✅ Automatic BOM handling
- ✅ Built-in decompression (gzip, deflate; deflate-raw is experimental)
- ✅ Worker and WASM execution support
- ✅ Full TypeScript support
- ✅ Platform-standard encoding conversion

**When to use:**
- File uploads (File API → ArrayBuffer)
- Binary CSV data
- Non-UTF-8 encoded files
- Compressed CSV files (.csv.gz)
- When BOM handling is needed

**When to avoid:**
- Very large files (>100MB) - use `parseUint8ArrayStream()` instead
- Already-decoded strings - use `parseString()` instead
- Streaming binary data - use `parseUint8ArrayStream()` instead
