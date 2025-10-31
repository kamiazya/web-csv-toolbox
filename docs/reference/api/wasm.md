# WebAssembly API Reference

Complete reference for WebAssembly-related functions in web-csv-toolbox.

## Overview

The WASM API provides high-performance CSV parsing using WebAssembly. It offers improved performance for UTF-8 CSV files compared to the JavaScript implementation.

**Requirements:**
- UTF-8 encoding only
- Double-quote (`"`) quotation only
- Single-character delimiters

---

## loadWASM()

Loads and initializes the WebAssembly module.

```typescript
function loadWASM(input?: InitInput | Promise<InitInput>): Promise<void>
```

### Parameters

#### `input` (optional)

**Type:** `InitInput | Promise<InitInput>`
**Default:** Bundled WASM binary

Custom WASM module source.

**Possible values:**
- `undefined` - Use bundled WASM binary (default)
- `string` - URL to WASM file
- `URL` - URL object
- `Request` - Fetch Request object
- `Response` - Fetch Response object
- `BufferSource` - WASM binary data
- `WebAssembly.Module` - Pre-compiled module

### Returns

`Promise<void>` - Resolves when WASM module is loaded

### Example: Basic Usage

```typescript
import { loadWASM } from 'web-csv-toolbox';

// Load bundled WASM (most common)
await loadWASM();

console.log('WASM ready');
```

---

### Example: Custom WASM URL

```typescript
import { loadWASM } from 'web-csv-toolbox';

// Load from CDN
await loadWASM('https://cdn.example.com/web_csv_toolbox.wasm');
```

---

### Example: Fetch Response

```typescript
import { loadWASM } from 'web-csv-toolbox';

// Load from custom endpoint
const response = await fetch('/assets/wasm/csv-parser.wasm');
await loadWASM(response);
```

---

### Example: Application Initialization

```typescript
import { loadWASM } from 'web-csv-toolbox';

async function initializeApp() {
  try {
    await loadWASM();
    console.log('Application initialized');
  } catch (error) {
    console.error('WASM initialization failed:', error);
    // Fallback to JavaScript parser
  }
}

// Browser
window.addEventListener('DOMContentLoaded', initializeApp);

// Node.js
await initializeApp();
```

---

### Error Handling

```typescript
import { loadWASM } from 'web-csv-toolbox';

try {
  await loadWASM();
} catch (error) {
  if (error instanceof TypeError) {
    console.error('Invalid WASM input:', error);
  } else if (error instanceof WebAssembly.CompileError) {
    console.error('WASM compilation failed:', error);
  } else if (error instanceof WebAssembly.LinkError) {
    console.error('WASM linking failed:', error);
  } else {
    console.error('Unknown error:', error);
  }
}
```

---

### Notes

- Call `loadWASM()` once at application startup
- Subsequent calls are instant (module cached)
- Safe to call multiple times (idempotent)
- Must be called before using WASM parsing

---

## parseStringToArraySyncWASM()

Synchronously parses CSV string to an array of records using WebAssembly.

```typescript
function parseStringToArraySyncWASM<Header>(
  csv: string,
  options?: CommonOptions<Delimiter, Quotation>
): CSVRecord<Header>[]
```

### Parameters

#### `csv`

**Type:** `string`

CSV string to parse.

**Requirements:**
- Must be UTF-8 encoded string
- Can be any size (respects `maxBufferSize`)

#### `options` (optional)

**Type:** `CommonOptions`

Parsing options.

```typescript
interface CommonOptions {
  delimiter?: string;
  quotation?: string;
  maxBufferSize?: number;
}
```

##### `delimiter`

**Type:** `string`
**Default:** `','`
**Constraint:** Must be single character

Field delimiter.

##### `quotation`

**Type:** `string`
**Default:** `'"'`
**Constraint:** Must be `"` (double-quote)

Quotation character.

##### `maxBufferSize`

**Type:** `number`
**Default:** `10485760` (10MB)

Maximum buffer size in characters.

### Returns

`CSVRecord<Header>[]` - Array of CSV records

### Example: Basic Usage

```typescript
import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox';

await loadWASM();

const csv = `name,age
Alice,30
Bob,25`;

const records = parseStringToArraySyncWASM(csv);

console.log(records);
// [
//   { name: 'Alice', age: '30' },
//   { name: 'Bob', age: '25' }
// ]
```

---

### Example: Custom Delimiter

```typescript
import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox';

await loadWASM();

const tsv = `name\tage
Alice\t30
Bob\t25`;

const records = parseStringToArraySyncWASM(tsv, {
  delimiter: '\t'
});

console.log(records);
// [
//   { name: 'Alice', age: '30' },
//   { name: 'Bob', age: '25' }
// ]
```

---

### Example: With Type Safety

```typescript
import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox';

await loadWASM();

const csv = `name,age
Alice,30
Bob,25`;

type Header = ['name', 'age'];
const records = parseStringToArraySyncWASM<Header>(csv);

// TypeScript knows: records[0].name, records[0].age
console.log(records[0].name); // 'Alice'
console.log(records[0].age); // '30'
```

---

### Error Handling

#### WASM Not Loaded

```typescript
import { parseStringToArraySyncWASM } from 'web-csv-toolbox';

try {
  // ❌ Forgot to call loadWASM()
  const records = parseStringToArraySyncWASM(csv);
} catch (error) {
  console.error('WASM not loaded:', error);
}
```

**Fix:** Call `loadWASM()` first.

---

#### Invalid Quotation

```typescript
import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox';

await loadWASM();

try {
  // ❌ Single-quote not supported
  const records = parseStringToArraySyncWASM(csv, {
    quotation: "'"
  });
} catch (error) {
  console.error(error.message);
  // "Invalid quotation, must be double quote on WASM."
}
```

---

#### Multi-Character Delimiter

```typescript
import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox';

await loadWASM();

try {
  // ❌ Multi-character delimiter not supported
  const records = parseStringToArraySyncWASM(csv, {
    delimiter: '||'
  });
} catch (error) {
  console.error(error.message);
  // "Invalid delimiter, must be a single character on WASM."
}
```

---

#### Buffer Size Exceeded

```typescript
import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox';

await loadWASM();

try {
  const largeCSV = 'a'.repeat(20_000_000); // 20MB
  const records = parseStringToArraySyncWASM(largeCSV, {
    maxBufferSize: 10_000_000 // 10MB
  });
} catch (error) {
  console.error(error.message);
  // "Buffer size (20000000 characters) exceeded maximum allowed size of 10000000 characters"
}
```

---

### Performance Characteristics

#### Memory Usage

**O(n)** - Proportional to input size

- Input: CSV string in memory
- Processing: Temporary buffer in WASM memory
- Output: Array of records in memory

**Total:** ~3x input size during parsing

⚠️ **Warning:** This loads the entire result into memory. Not suitable for very large files (>100MB).

---

#### Processing Speed

<!-- TODO: Add actual performance benchmarks based on real measurements -->

**Performance characteristics:**
- Compiled to machine code (near-native speed)
- Optimized by LLVM compiler
- No garbage collection pauses during parsing

For detailed benchmarks, see [CodSpeed](https://codspeed.io/kamiazya/web-csv-toolbox).

---

### Comparison with Async Parsing

| Feature | `parseStringToArraySyncWASM` | `parse` with WASM |
|---------|------------------------------|-------------------|
| **API Style** | Synchronous | Asynchronous |
| **Memory** | Loads all into array | Streaming (one record at a time) |
| **Speed** | Synchronous (no async overhead) | Asynchronous (with streaming) |
| **Blocking** | Blocks until complete | Non-blocking (with worker) |
| **Use Case** | Small to medium files | Large files, UI applications |

**Recommendation:** Use `parse()` with WASM for production applications.

---

## Using WASM with High-Level APIs

Instead of calling `parseStringToArraySyncWASM()` directly, use high-level APIs with the `engine` option:

### parse() with WASM

```typescript
import { parse, loadWASM, EnginePresets } from 'web-csv-toolbox';

await loadWASM();

// Streaming with WASM
for await (const record of parse(csv, {
  engine: EnginePresets.wasm
})) {
  console.log(record);
}
```

**Benefits:**
- Streaming (memory-efficient)
- Consistent API across implementations
- Automatic error handling

---

### parse() with Worker + WASM

```typescript
import { parse, loadWASM, EnginePresets } from 'web-csv-toolbox';

await loadWASM();

// Non-blocking UI with maximum performance
for await (const record of parse(csv, {
  engine: EnginePresets.fastest
})) {
  console.log(record);
}
```

**Benefits:**
- Non-blocking UI
- Maximum performance
- Best for large files

---

## TypeScript Types

```typescript
import type { InitInput } from 'web-csv-toolbox-wasm';
import type { CSVRecord, CommonOptions } from 'web-csv-toolbox';

// loadWASM input types
type InitInput =
  | string
  | URL
  | Request
  | Response
  | BufferSource
  | WebAssembly.Module;

// CommonOptions (subset used by WASM)
interface CommonOptions<
  Delimiter extends string = ',',
  Quotation extends string = '"'
> {
  delimiter?: Delimiter;
  quotation?: Quotation;
  maxBufferSize?: number;
}

// CSVRecord type
type CSVRecord<Header extends ReadonlyArray<string>> = {
  [K in Header[number]]: string | undefined;
};
```

---

## Browser and Runtime Support

WASM is supported across all modern runtimes:

| Runtime | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ | Full support |
| Firefox | ✅ | Full support |
| Edge | ✅ | Full support |
| Safari | ✅ | Full support |
| Node.js LTS | ✅ | Full support |
| Deno LTS | ✅ | Full support |

**Browser API Support:**
- **WebAssembly**: [Can I Use](https://caniuse.com/wasm) | [MDN](https://developer.mozilla.org/en-US/docs/WebAssembly)

See: [Supported Environments](../supported-environments.md)

---

## Related Documentation

- **[Using WebAssembly Tutorial](../../tutorials/using-webassembly.md)** - Getting started guide
- **[WebAssembly Architecture](../../explanation/webassembly-architecture.md)** - Deep dive into WASM
- **[WASM Performance Optimization](../../how-to-guides/wasm-performance-optimization.md)** - Optimization guide
- **[Engine Configuration](../engine-config.md)** - Engine options reference

---

## Best Practices

### ✅ Do

- Call `loadWASM()` once at application startup
- Use high-level APIs (`parse()`) instead of direct WASM functions
- Handle WASM loading errors gracefully
- Use Worker + WASM for large files
- Set appropriate `maxBufferSize` for your use case

### ❌ Don't

- Don't call `loadWASM()` before every parse operation
- Don't use `parseStringToArraySyncWASM()` for very large files (>100MB)
- Don't ignore WASM limitations (UTF-8, double-quote only)
- Don't forget error handling
- Don't use WASM for small files (<100KB) - initialization overhead

---

## Troubleshooting

### WASM loading fails

**Problem:** Error during `loadWASM()`

**Solution:**
- Check browser/runtime supports WASM
- Verify WASM file is accessible (network, bundler)
- Check console for detailed error message

---

### Performance not improving

**Problem:** WASM is slower than JavaScript

**Solution:**
- Only beneficial for files >100KB
- Ensure `loadWASM()` called once at startup
- Use `EnginePresets.fastest()` for maximum performance

---

### Encoding errors

**Problem:** Incorrect characters in output

**Solution:**
- WASM only supports UTF-8
- For other encodings, use JavaScript parser: `{ engine: { wasm: false } }`

---

## Summary

web-csv-toolbox's WASM API provides:

1. **`loadWASM()`**: Initialize WASM module
2. **`parseStringToArraySyncWASM()`**: Synchronous parsing
3. **Engine integration**: Use with `parse()` for streaming

**Key Features:**
- High-performance parsing (compiled to machine code)
- UTF-8 only, double-quote only
- Synchronous and asynchronous APIs
- Combines with Worker Threads for maximum performance

**Recommendation:** Use `parse()` with `EnginePresets.fastest()` for production applications.

**Performance:** See [CodSpeed benchmarks](https://codspeed.io/kamiazya/web-csv-toolbox) for measured performance data.
