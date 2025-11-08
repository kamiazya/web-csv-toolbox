---
title: Using WebAssembly
group: Tutorials
---

# Using WebAssembly for CSV Parsing

This tutorial will guide you through using web-csv-toolbox's WebAssembly (WASM) acceleration to improve CSV parsing performance.

## What you'll learn

By the end of this tutorial, you'll be able to:
- Understand when to use WebAssembly
- Load and initialize the WASM module
- Parse CSV using WASM acceleration
- Combine WASM with Worker Threads for maximum performance
- Handle WASM limitations and errors

## Prerequisites

- Completed [Getting Started](./getting-started.md) tutorial
- Node.js LTS or a modern browser
- Basic understanding of async/await

## What is WebAssembly?

WebAssembly (WASM) is a binary instruction format that runs at near-native speed in modern browsers and runtimes. For CSV parsing, this means:

- **Improved performance** compared to JavaScript for large CSV files
- **Lower CPU usage** for CPU-intensive parsing
- **Same memory efficiency** as JavaScript implementation

**Note:** For actual performance measurements, see [CodSpeed benchmarks](https://codspeed.io/kamiazya/web-csv-toolbox).

## When to use WebAssembly

**✅ Use WASM when:**
- Parsing large UTF-8 CSV files (>1MB)
- CPU performance is critical
- CSV uses standard delimiters (comma, tab, etc.)
- CSV uses double-quote (`"`) as quotation character

**❌ Skip WASM when:**
- CSV uses non-UTF-8 encoding (Shift-JIS, EUC-JP, etc.)
- CSV uses single-quote (`'`) as quotation character
- Parsing small files (<100KB)
- WASM initialization overhead matters

## Step 1: Load the WASM Module

Before using WASM, you must load the module using `loadWASM()`.

```typescript
import { loadWASM } from 'web-csv-toolbox';

// Load WASM module (one-time initialization)
await loadWASM();

console.log('WASM module loaded');
```

**Important:** Call `loadWASM()` once at application startup, not before every parse operation.

---

## Step 2: Parse CSV with WASM

Once loaded, use the `engine` option to enable WASM:

```typescript
import { parse, loadWASM } from 'web-csv-toolbox';

// Load WASM (once)
await loadWASM();

const csv = `name,age,city
Alice,30,New York
Bob,25,San Francisco
Charlie,35,Los Angeles`;

// Parse using WASM
for await (const record of parse(csv, {
  engine: { wasm: true }
})) {
  console.log(record);
}
// { name: 'Alice', age: '30', city: 'New York' }
// { name: 'Bob', age: '25', city: 'San Francisco' }
// { name: 'Charlie', age: '35', city: 'Los Angeles' }
```

---

## Step 3: Using Engine Presets

Instead of manual configuration, use predefined presets:

```typescript
import { parse, loadWASM, EnginePresets } from 'web-csv-toolbox';

await loadWASM();

// Use 'wasm' preset (main thread WASM)
for await (const record of parse(csv, {
  engine: EnginePresets.wasm
})) {
  console.log(record);
}
```

### Available WASM Presets

| Preset | Worker | WASM | Best For |
|--------|--------|------|----------|
| `wasm` | ❌ | ✅ | Medium UTF-8 files, main thread |
| `workerWasm` | ✅ | ✅ | Large UTF-8 files, non-blocking UI |
| `fastest` | ✅ | ✅ | Maximum performance (UTF-8 only) |

**Recommendation:** Use `EnginePresets.fastest()` for maximum performance.

---

## Step 4: Combine WASM with Worker Threads

For the best performance, combine WASM with Worker Threads:

```typescript
import { parse, loadWASM, EnginePresets } from 'web-csv-toolbox';

await loadWASM();

// Use 'fastest' preset (Worker + WASM)
for await (const record of parse(csv, {
  engine: EnginePresets.fastest
})) {
  console.log(record);
}
```

**Benefits:**
- ✅ Non-blocking UI (Worker Thread)
- ✅ Maximum performance (WASM acceleration)
- ✅ Best for large files (>1MB)

---

## Step 5: Parse Network Responses with WASM

WASM works seamlessly with network fetching:

```typescript
import { parseResponse, loadWASM, EnginePresets } from 'web-csv-toolbox';

await loadWASM();

async function fetchAndParseCSV(url: string) {
  const response = await fetch(url);

  for await (const record of parseResponse(response, {
    engine: EnginePresets.fastest
  })) {
    console.log(record);
  }
}

await fetchAndParseCSV('https://example.com/large-data.csv');
```

---

## Step 6: Synchronous Parsing with WASM

For special use cases, WASM provides a synchronous API:

```typescript
import { parseStringToArraySyncWASM, loadWASM } from 'web-csv-toolbox';

await loadWASM();

const csv = `name,age
Alice,30
Bob,25`;

// Synchronous parsing (returns array)
const records = parseStringToArraySyncWASM(csv);

console.log(records);
// [
//   { name: 'Alice', age: '30' },
//   { name: 'Bob', age: '25' }
// ]
```

**Use case:** When you need all records immediately (not streaming)

**⚠️ Warning:** This loads the entire result into memory. Not suitable for large files.

---

## WASM Limitations

### UTF-8 Only

WASM only supports UTF-8 encoding.

```typescript
import { parse, loadWASM } from 'web-csv-toolbox';

await loadWASM();

// ✅ Works (UTF-8)
for await (const record of parse(csv, {
  engine: { wasm: true }
})) {
  console.log(record);
}

// ❌ Error (Shift-JIS not supported)
for await (const record of parse(shiftJISBinary, {
  engine: { wasm: true },
  charset: 'shift-jis'
})) {
  console.log(record);
}
```

**Workaround:** Use JavaScript parser for non-UTF-8 encodings:

```typescript
for await (const record of parse(shiftJISBinary, {
  engine: { wasm: false }, // JavaScript parser
  charset: 'shift-jis'
})) {
  console.log(record);
}
```

---

### Double-Quote Only

WASM only supports double-quote (`"`) as quotation character.

```typescript
import { parse, loadWASM } from 'web-csv-toolbox';

await loadWASM();

// ✅ Works (double-quote)
for await (const record of parse(csv, {
  engine: { wasm: true },
  quotation: '"'
})) {
  console.log(record);
}

// ❌ Error (single-quote not supported)
for await (const record of parse(csv, {
  engine: { wasm: true },
  quotation: "'"
})) {
  console.log(record);
}
```

**Workaround:** Use JavaScript parser for single-quote CSVs:

```typescript
for await (const record of parse(csv, {
  engine: { wasm: false },
  quotation: "'"
})) {
  console.log(record);
}
```

---

## Error Handling

### WASM Not Loaded

If you forget to call `loadWASM()`, an error occurs:

```typescript
import { parse } from 'web-csv-toolbox';

try {
  // ❌ Forgot to call loadWASM()
  for await (const record of parse(csv, {
    engine: { wasm: true }
  })) {
    console.log(record);
  }
} catch (error) {
  console.error('WASM not loaded:', error);
}
```

**Fix:** Always call `loadWASM()` before parsing:

```typescript
import { parse, loadWASM } from 'web-csv-toolbox';

await loadWASM(); // ✅ Load WASM first

for await (const record of parse(csv, {
  engine: { wasm: true }
})) {
  console.log(record);
}
```

---

### Invalid Options for WASM

```typescript
import { parse, loadWASM } from 'web-csv-toolbox';

await loadWASM();

try {
  // ❌ Single-quote not supported
  for await (const record of parse(csv, {
    engine: { wasm: true },
    quotation: "'"
  })) {
    console.log(record);
  }
} catch (error) {
  console.error('Invalid quotation for WASM:', error.message);
  // "Invalid quotation, must be double quote on WASM."
}
```

---

## Application Initialization Pattern

### Browser Application

```typescript
import { loadWASM } from 'web-csv-toolbox';

// Load WASM on page load
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadWASM();
    console.log('WASM ready');
  } catch (error) {
    console.error('WASM initialization failed:', error);
  }
});

// Later in your code
async function handleFileUpload(file: File) {
  const csv = await file.text();

  for await (const record of parse(csv, {
    engine: EnginePresets.fastest
  })) {
    console.log(record);
  }
}
```

---

### Node.js Server

```typescript
import { Hono } from 'hono';
import { loadWASM, parse, WorkerPool } from 'web-csv-toolbox';

const app = new Hono();

// Initialize WASM at server startup
await loadWASM();
console.log('WASM initialized');

// Create worker pool
using pool = new WorkerPool({ maxWorkers: 4 });

app.post('/parse-csv', async (c) => {
  const csv = await c.req.text();
  const results = [];

  try {
    for await (const record of parse(csv, {
      engine: {
        worker: true,
        wasm: true,
        workerPool: pool
      }
    })) {
      results.push(record);
    }

    return c.json({ success: true, data: results });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default app;
```

---

## Performance Comparison

<!-- TODO: Add actual performance benchmarks based on real measurements -->

**General Guidelines:**

| File Size | JavaScript | WASM | Worker + WASM |
|-----------|-----------|------|---------------|
| <100KB | Baseline | May be slower (init overhead) | May be slower (init overhead) |
| 100KB-1MB | Baseline | Improved | Improved + non-blocking |
| >1MB | Baseline | Improved | Best (improved + non-blocking) |

**Note:** Actual performance depends on:
- Hardware specifications
- Runtime environment (Node.js, browser, Deno)
- CSV complexity (number of columns, escaping, etc.)

For detailed benchmarks, see [CodSpeed](https://codspeed.io/kamiazya/web-csv-toolbox).

---

## Browser Compatibility

WASM is supported across all modern browsers:

| Browser | WASM Support | Notes |
|---------|--------------|-------|
| Chrome | ✅ | Full support |
| Firefox | ✅ | Full support |
| Edge | ✅ | Full support |
| Safari | ✅ | Full support |

**Browser API Support:**
- **WebAssembly**: [Can I Use](https://caniuse.com/wasm) | [MDN](https://developer.mozilla.org/en-US/docs/WebAssembly)

For detailed browser compatibility, see [Supported Environments](../reference/supported-environments.md).

---

## Summary

You've learned how to:
- ✅ Load the WASM module with `loadWASM()`
- ✅ Parse CSV using WASM acceleration
- ✅ Combine WASM with Worker Threads
- ✅ Handle WASM limitations (UTF-8, double-quote only)
- ✅ Initialize WASM in browser and server applications
- ✅ Handle errors related to WASM

## What's Next?

- **[Working with Workers](./working-with-workers.md)**: Learn about worker threads
- **[WASM Performance Optimization](../how-to-guides/wasm-performance-optimization.md)**: Advanced optimization techniques
- **[WebAssembly Architecture](../explanation/webassembly-architecture.md)**: Deep dive into WASM implementation

## Troubleshooting

### WASM initialization fails

**Problem:** Error: "WASM failed to load"

**Solution:**
- Ensure you're using a supported browser or runtime
- Check network connectivity (WASM file may be loaded from CDN)
- Verify bundler configuration (WASM file must be included)

### Performance not improving

**Problem:** WASM is slower than JavaScript

**Solution:**
- WASM has initialization overhead - only beneficial for larger files (>100KB)
- For small files, use JavaScript parser
- Ensure `loadWASM()` is called once at startup, not before every parse

### Encoding errors

**Problem:** Incorrect characters in parsed data

**Solution:**
- WASM only supports UTF-8
- For other encodings (Shift-JIS, EUC-JP), use JavaScript parser with `{ engine: { wasm: false } }`

---

**Need help?** Open an issue on [GitHub](https://github.com/kamiazya/web-csv-toolbox/issues).
