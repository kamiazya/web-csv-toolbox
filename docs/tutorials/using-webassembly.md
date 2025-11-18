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

## Choosing an Entry Point

The library provides two entry points for WASM functionality. Choose based on your needs:

### Main Entry Point (`web-csv-toolbox`) - Recommended for Most Users

```typescript
import { parseStringToArraySyncWASM } from 'web-csv-toolbox';

// Auto-initialized - works immediately
const records = parseStringToArraySyncWASM(csv);
```

**Best for:**
- ✅ Rapid prototyping and development
- ✅ When you want the simplest API
- ✅ Applications where bundle size is not critical

**Characteristics:**
- Automatic WASM initialization (no `loadWASM()` call needed)
- Larger bundle size (WASM embedded as base64)
- ⚠️ Experimental auto-initialization may change in future

### Lite Entry Point (`web-csv-toolbox/lite`) - For Bundle Size Optimization

```typescript
import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox/lite';

// Manual initialization required
await loadWASM();
const records = parseStringToArraySyncWASM(csv);
```

**Best for:**
- ✅ Production applications with bundle size budgets
- ✅ When optimizing initial load time
- ✅ When you want explicit control over WASM loading

**Characteristics:**
- Manual `loadWASM()` call required before using WASM features
- Smaller main bundle size (WASM external)
- External WASM file for better caching

**Comparison:**

| Aspect | Main | Lite |
|--------|------|------|
| **Bundle Size** | Larger (WASM embedded) | Smaller (WASM external) |
| **Initialization** | Automatic | Manual |
| **API Complexity** | Simpler | Requires `loadWASM()` |
| **Use Case** | Convenience | Bundle optimization |

> **Note**: This tutorial uses the **main entry point** (`web-csv-toolbox`) for simplicity. To use the lite version, simply import from `web-csv-toolbox/lite` and add `await loadWASM()` before using WASM functions.

## What is WebAssembly?

WebAssembly (WASM) is a binary instruction format that runs in modern browsers and runtimes. For CSV parsing, this means:

- **Compiled code execution** using WASM instead of interpreted JavaScript
- **Potential performance benefits** for CPU-intensive parsing
- **Same memory efficiency** as JavaScript implementation

**Note:** Actual performance depends on many factors including CSV structure, file size, and runtime environment. See [CodSpeed benchmarks](https://codspeed.io/kamiazya/web-csv-toolbox) for measured performance across different scenarios.

## When to use WebAssembly

**✅ Use WASM when:**
- Parsing UTF-8 CSV files
- Server-side parsing where blocking is acceptable
- CSV uses standard delimiters (comma, tab, etc.)
- CSV uses double-quote (`"`) as quotation character

**❌ Skip WASM when:**
- CSV uses non-UTF-8 encoding (Shift-JIS, EUC-JP, etc.)
- CSV uses single-quote (`'`) as quotation character
- Stability is the highest priority (use JavaScript parser instead)
- WASM initialization overhead matters for your use case

**Note:** WASM parser is stable but the implementation may change in future versions. For maximum stability, use the JavaScript parser (`mainThread` preset).

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

// Use 'fast' preset (main thread WASM)
for await (const record of parse(csv, {
  engine: EnginePresets.fast()
})) {
  console.log(record);
}
```

### Available WASM Presets

| Preset | Optimization Target | Worker | WASM | Stability |
|--------|---------------------|--------|------|-----------|
| `fast` | Parse speed | ❌ | ✅ | ✅ Stable |
| `responsiveFast` | UI responsiveness + parse speed | ✅ | ✅ | ✅ Stable |

**Note:** For fastest execution time, use `fast()` on main thread. `responsiveFast()` prioritizes UI responsiveness with some worker communication overhead.

---

## Step 4: Combine WASM with Worker Threads

Combine WASM with Worker Threads for non-blocking UI with fast parsing:

```typescript
import { parse, loadWASM, EnginePresets } from 'web-csv-toolbox';

await loadWASM();

// Use 'responsiveFast' preset (Worker + WASM)
for await (const record of parse(csv, {
  engine: EnginePresets.responsiveFast()
})) {
  console.log(record);
}
```

**Benefits:**
- ✅ Non-blocking UI (Worker Thread)
- ✅ Fast parsing (compiled WASM code)
- ⚠️ Worker communication adds overhead (data transfer between threads)

**Note:** This approach prioritizes UI responsiveness. Execution time may be slower than `fast()` on main thread due to worker communication cost, but UI remains responsive.

---

## Step 5: Parse Network Responses with WASM

WASM works seamlessly with network fetching:

```typescript
import { parseResponse, loadWASM, EnginePresets } from 'web-csv-toolbox';

await loadWASM();

async function fetchAndParseCSV(url: string) {
  const response = await fetch(url);

  for await (const record of parseResponse(response, {
    engine: EnginePresets.responsiveFast()
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
    engine: EnginePresets.responsiveFast()
  })) {
    console.log(record);
  }
}
```

---

### Node.js Server

```typescript
import { Hono } from 'hono';
import { loadWASM, parse, ReusableWorkerPool } from 'web-csv-toolbox';

const app = new Hono();

// Initialize WASM at server startup
await loadWASM();
console.log('WASM initialized');

// Create worker pool
using pool = new ReusableWorkerPool({ maxWorkers: 4 });

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

**Performance Characteristics:**

| Approach | Execution | UI Blocking | Characteristics |
|----------|-----------|-------------|-----------------|
| JavaScript (main thread) | Standard | ✅ Yes | Most stable, all encodings |
| WASM (main thread) | Compiled code | ✅ Yes | UTF-8 only, no worker overhead |
| Worker + WASM | Compiled code | ❌ No | UTF-8 only, worker communication overhead |

**Note:** Actual performance depends on many factors:
- CSV structure and size
- Runtime environment (Node.js, browser, Deno)
- System capabilities
- Worker communication overhead (when using workers)

**Recommendation:** Benchmark your specific use case to determine the best approach. See [CodSpeed](https://codspeed.io/kamiazya/web-csv-toolbox) for measured performance across different scenarios.

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
- WASM has initialization overhead - benchmark your specific use case
- Worker + WASM adds worker communication overhead - may be slower than main thread WASM
- For fastest execution time, use `EnginePresets.fast()` on the main thread (blocks UI)
- For non-blocking UI, accept the worker communication overhead trade-off
- Optionally call `loadWASM()` once at startup to avoid repeated initialization overhead (auto-initialization works but adds latency on first use)

### Encoding errors

**Problem:** Incorrect characters in parsed data

**Solution:**
- WASM only supports UTF-8
- For other encodings (Shift-JIS, EUC-JP), use JavaScript parser with `{ engine: { wasm: false } }`

---

**Need help?** Open an issue on [GitHub](https://github.com/kamiazya/web-csv-toolbox/issues).
