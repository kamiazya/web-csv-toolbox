# parseString() API Reference

Parse CSV string to records with optimal performance for production applications.

## Overview

`parseString()` is a middle-level API optimized for parsing CSV strings. Unlike the high-level `parse()` API, it avoids input type detection overhead and provides better performance for production use.

**Category:** Middle-level API (Production)

**Input:** `string`

**Output:** `AsyncIterableIterator<CSVRecord<Header>>`

---

## Function Signature

```typescript
function parseString<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>
): AsyncIterableIterator<CSVRecord<Header>>
```

---

## Parameters

### `csv`

**Type:** `string`

**Required:** Yes

The CSV string to parse.

**Example:**
```typescript
const csv = `name,age,city
Alice,30,New York
Bob,25,San Francisco`;
```

---

### `options`

**Type:** `ParseOptions<Header>`

**Required:** No

Parsing options to customize behavior.

```typescript
interface ParseOptions<Header> {
  // Parsing options
  delimiter?: string;           // Default: ','
  quotation?: string;           // Default: '"'

  // Header options
  headerList?: Header;          // Explicit header list

  // Resource limits
  maxBufferSize?: number;       // Default: 10485760 (10MB)

  // Execution strategy
  engine?: EngineConfig;        // Execution configuration

  // Abort control
  signal?: AbortSignal;         // Cancellation signal
}
```

#### Common Options

##### `delimiter`

**Type:** `string`

**Default:** `','`

**Constraints:** Single character

Field delimiter character.

**Example:**
```typescript
// Tab-separated values
for await (const record of parseString(tsv, {
  delimiter: '\t'
})) {
  console.log(record);
}
```

---

##### `quotation`

**Type:** `string`

**Default:** `'"'`

**Constraints:** Single character

Quotation character for escaping fields.

**Example:**
```typescript
// Single-quote CSV
for await (const record of parseString(csv, {
  quotation: "'"
})) {
  console.log(record);
}
```

---

##### `headerList`

**Type:** `ReadonlyArray<string>`

**Default:** `undefined` (auto-detect from first row)

Explicit header list to use instead of auto-detection.

**Example:**
```typescript
// Provide headers explicitly
for await (const record of parseString(csv, {
  headerList: ['name', 'age', 'city']
})) {
  // record.name, record.age, record.city
  console.log(record);
}
```

---

##### `maxBufferSize`

**Type:** `number`

**Default:** `10485760` (10MB)

Maximum buffer size in characters to prevent memory exhaustion.

**Example:**
```typescript
// Allow larger fields
for await (const record of parseString(csv, {
  maxBufferSize: 50 * 1024 * 1024 // 50MB
})) {
  console.log(record);
}
```

---

##### `engine`

**Type:** `EngineConfig`

**Default:** `{ worker: false, wasm: false }`

Execution strategy configuration.

**Example:**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

// Use fastest available strategy
for await (const record of parseString(csv, {
  engine: EnginePresets.responsiveFast()
})) {
  console.log(record);
}
```

See: [Engine Configuration](../engine-config.md), [Engine Presets](../engine-presets.md)

---

##### `signal`

**Type:** `AbortSignal`

**Default:** `undefined`

AbortSignal for cancelling the parsing operation.

**Example:**
```typescript
const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

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

---

## Returns

`AsyncIterableIterator<CSVRecord<Header>>`

An async iterable iterator that yields CSV records one by one.

**Type:**
```typescript
type CSVRecord<Header extends ReadonlyArray<string>> = {
  [K in Header[number]]: string | undefined;
};
```

**Example:**
```typescript
for await (const record of parseString(csv)) {
  console.log(record);
  // { name: 'Alice', age: '30', city: 'New York' }
}
```

---

## Usage Examples

### Example 1: Basic Usage

```typescript
import { parseString } from 'web-csv-toolbox';

const csv = `name,age
Alice,30
Bob,25`;

for await (const record of parseString(csv)) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
// { name: 'Bob', age: '25' }
```

---

### Example 2: Custom Delimiter

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
// { name: 'Alice', age: '30', city: 'New York' }
// { name: 'Bob', age: '25', city: 'San Francisco' }
```

---

### Example 3: With TypeScript Headers

```typescript
import { parseString } from 'web-csv-toolbox';

const csv = `name,age,email
Alice,30,alice@example.com
Bob,25,bob@example.com`;

type Header = ['name', 'age', 'email'];

for await (const record of parseString<Header>(csv)) {
  // TypeScript knows: record.name, record.age, record.email
  console.log(`${record.name} is ${record.age} years old`);
}
```

---

### Example 4: Worker Execution

```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

// Non-blocking parsing (good for large strings)
for await (const record of parseString(largeCSV, {
  engine: EnginePresets.balanced()
})) {
  console.log(record);
  // UI stays responsive!
}
```

---

### Example 5: WASM Acceleration

```typescript
import { parseString, loadWASM, EnginePresets } from 'web-csv-toolbox';

// Initialize WASM once at startup
await loadWASM();

// Fast parsing for large UTF-8 strings
for await (const record of parseString(largeCSV, {
  engine: EnginePresets.responsiveFast()
})) {
  console.log(record);
}
```

---

### Example 6: With AbortSignal

```typescript
import { parseString } from 'web-csv-toolbox';

const controller = new AbortController();

// Cancel parsing after timeout
const timeoutId = setTimeout(() => controller.abort(), 5000);

try {
  for await (const record of parseString(csv, {
    signal: controller.signal
  })) {
    console.log(record);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Parsing cancelled due to timeout');
  }
} finally {
  clearTimeout(timeoutId);
}
```

---

### Example 7: Explicit Headers

```typescript
import { parseString } from 'web-csv-toolbox';

// CSV without header row
const csv = `Alice,30,New York
Bob,25,San Francisco`;

for await (const record of parseString(csv, {
  headerList: ['name', 'age', 'city']
})) {
  console.log(record);
}
// { name: 'Alice', age: '30', city: 'New York' }
// { name: 'Bob', age: '25', city: 'San Francisco' }
```

---

### Example 8: Error Handling

```typescript
import { parseString } from 'web-csv-toolbox';

try {
  for await (const record of parseString(csv)) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof ParseError) {
    console.error('Parse error:', error.message);
  } else if (error instanceof RangeError) {
    console.error('Buffer size exceeded:', error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

---

## Namespace Methods

### parseString.toArray()

Convert the entire CSV string to an array of records.

```typescript
function toArray<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>
): Promise<CSVRecord<Header>[]>
```

**Example:**
```typescript
import { parseString } from 'web-csv-toolbox';

const csv = `name,age
Alice,30
Bob,25`;

const records = await parseString.toArray(csv);
console.log(records);
// [
//   { name: 'Alice', age: '30' },
//   { name: 'Bob', age: '25' }
// ]
```

⚠️ **Warning:** Loads entire result into memory. Not suitable for very large files.

---

### parseString.toArraySync()

Synchronously convert CSV string to an array of records.

```typescript
function toArraySync<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>
): CSVRecord<Header>[]
```

**Example:**
```typescript
import { parseString } from 'web-csv-toolbox';

const csv = `name,age
Alice,30
Bob,25`;

const records = parseString.toArraySync(csv);
console.log(records);
// [
//   { name: 'Alice', age: '30' },
//   { name: 'Bob', age: '25' }
// ]
```

⚠️ **Warning:** Blocks until complete. Use `toArray()` for async operations.

---

### parseString.toIterableIterator()

Get a synchronous iterable iterator.

```typescript
function toIterableIterator<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>
): IterableIterator<CSVRecord<Header>>
```

**Example:**
```typescript
import { parseString } from 'web-csv-toolbox';

const csv = `name,age
Alice,30
Bob,25`;

for (const record of parseString.toIterableIterator(csv)) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
// { name: 'Bob', age: '25' }
```

---

### parseString.toStream()

Convert to a ReadableStream of records.

```typescript
function toStream<Header extends ReadonlyArray<string>>(
  csv: string,
  options?: ParseOptions<Header>
): ReadableStream<CSVRecord<Header>>
```

**Example:**
```typescript
import { parseString } from 'web-csv-toolbox';

const csv = `name,age
Alice,30
Bob,25`;

const stream = parseString.toStream(csv);

await stream.pipeTo(
  new WritableStream({
    write(record) {
      console.log(record);
    }
  })
);
// { name: 'Alice', age: '30' }
// { name: 'Bob', age: '25' }
```

---

## Performance Characteristics

### Memory Usage

- **Streaming (default):** O(1) - constant per record
- **toArray():** O(n) - proportional to file size

**Recommendation:** Use streaming for large files, `toArray()` only for small files.

---

### Execution Strategies

| Strategy | Config | Performance | Use Case |
|----------|--------|-------------|----------|
| Main thread | `{ worker: false, wasm: false }` | Baseline | Small files (<1MB) |
| Worker | `{ worker: true }` | Non-blocking | Large files, UI apps |
| WASM | `{ wasm: true }` | Improved speed | Large UTF-8 files |
| Worker + WASM | `EnginePresets.responsiveFast()` | Maximum | Very large UTF-8 files |

**File Size Guidelines:**

| File Size | Recommended Config |
|-----------|-------------------|
| < 1MB | Main thread (default) |
| 1-10MB | `EnginePresets.balanced()` |
| > 10MB (UTF-8) | `EnginePresets.responsiveFast()` |
| > 10MB (any encoding) | `EnginePresets.balanced()` |

---

## Error Handling

### ParseError

Thrown when CSV format is invalid.

```typescript
import { parseString, ParseError } from 'web-csv-toolbox';

try {
  for await (const record of parseString(invalidCSV)) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof ParseError) {
    console.error('Invalid CSV:', error.message);
  }
}
```

---

### RangeError

Thrown when buffer size limit is exceeded.

```typescript
import { parseString } from 'web-csv-toolbox';

try {
  for await (const record of parseString(csv, {
    maxBufferSize: 1024 // 1KB
  })) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof RangeError) {
    console.error('Buffer size exceeded:', error.message);
  }
}
```

---

### AbortError

Thrown when parsing is cancelled via AbortSignal.

```typescript
import { parseString } from 'web-csv-toolbox';

const controller = new AbortController();
setTimeout(() => controller.abort(), 1000);

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

---

## Comparison with Other APIs

### parseString() vs parse()

| Feature | `parseString()` | `parse()` |
|---------|----------------|-----------|
| **Input type** | `string` only | Any (auto-detect) |
| **Type detection** | None | Yes (slight overhead) |
| **Performance** | Optimal | Slightly slower |
| **Use case** | Production | Learning, prototyping |
| **TypeScript inference** | Better | Good |

**Recommendation:** Use `parseString()` in production when input is known to be string.

---

### parseString() vs parseStringStream()

| Feature | `parseString()` | `parseStringStream()` |
|---------|----------------|----------------------|
| **Input type** | `string` | `ReadableStream<string>` |
| **Memory (small files)** | O(n) | O(1) |
| **Memory (large files)** | O(n) | O(1) |
| **Best for** | Small to medium strings | Large files, streams |

**Recommendation:** Use `parseStringStream()` for files >10MB or streaming data.

---

## Browser and Runtime Support

`parseString()` is supported across all environments:

| Runtime | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ | Full support |
| Firefox | ✅ | Full support |
| Edge | ✅ | Full support |
| Safari | ✅ | Full support |
| Node.js LTS | ✅ | Full support |
| Deno LTS | ✅ | Full support |

See: [Supported Environments](../supported-environments.md)

---

## Related Documentation

- **[Choosing the Right API](../../how-to-guides/choosing-the-right-api.md)** - API selection guide
- **[parse() API Reference](./parse.md)** - High-level universal API
- **[parseStringStream() API Reference](./parseStringStream.md)** - String stream parser
- **[Engine Configuration](../engine-config.md)** - Execution strategy reference
- **[Working with Workers](../../tutorials/working-with-workers.md)** - Worker threads guide

---

## Best Practices

### ✅ Do

- Use `parseString()` in production for known string inputs
- Use streaming iteration (`for await`) for large files
- Set appropriate `maxBufferSize` for your use case
- Use `EnginePresets` for execution strategies
- Handle errors with try-catch
- Use `AbortSignal` for long-running operations

### ❌ Don't

- Don't use `toArray()` for very large files (>100MB)
- Don't ignore error handling
- Don't forget to call `loadWASM()` when using WASM engine
- Don't create new workers for each parse - use `WorkerPool`
- Don't use synchronous methods (`toArraySync()`) in async code

---

## Summary

`parseString()` is the optimal choice for parsing CSV strings in production applications:

**Key Features:**
- ✅ No input type detection overhead
- ✅ Supports Worker and WASM execution
- ✅ Streaming and batch modes
- ✅ Full TypeScript support
- ✅ Flexible options (delimiter, quotation, headers, etc.)
- ✅ Resource limits and cancellation

**When to use:**
- Production applications with known string input
- Small to medium CSV strings (<100MB)
- Performance-critical code
- When entire CSV is available in memory

**When to avoid:**
- For very large files (>100MB) - use `parseStringStream()` instead
- When input type varies - use `parse()` instead
- For binary data - use `parseBinary()` instead
