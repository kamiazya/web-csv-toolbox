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
import { parse, loadWASM, EnginePresets } from 'web-csv-toolbox';

// Optional: Preload WASM at app startup to reduce first-parse latency
await loadWASM();

// WASM auto-initializes on first use if not preloaded
for await (const record of parse(csv, { engine: EnginePresets.fast() })) {
  console.log(record);
}
```

**Best for:**
- ✅ Rapid prototyping and development
- ✅ When you want the simplest API
- ✅ Applications where bundle size is not critical

**Characteristics:**
- **Automatic initialization**: WASM initializes on first use (no manual `loadWASM()` required)
- **Optional preloading**: Call `loadWASM()` at startup to reduce first-parse latency
- Larger bundle size (WASM embedded as base64)
- ⚠️ Experimental auto-initialization may change in future

### Slim Entry Point (`web-csv-toolbox/slim`) - For Bundle Size Optimization

```typescript
import { parse, loadWASM, EnginePresets } from 'web-csv-toolbox/slim';

// Required: Initialize WASM before use
await loadWASM();

for await (const record of parse(csv, { engine: EnginePresets.fast() })) {
  console.log(record);
}
```

**Best for:**
- ✅ Production applications with bundle size budgets
- ✅ When optimizing initial load time
- ✅ When you want explicit control over WASM loading

**Characteristics:**
- **Manual initialization required**: Must call `loadWASM()` before using WASM features
- Smaller main bundle size (WASM loaded externally)
- External WASM file enables better caching

**Comparison:**

| Aspect | Main | Slim |
|--------|------|------|
| **Bundle Size** | Larger (WASM embedded) | Smaller (WASM external) |
| **Initialization** | Automatic (optional preload) | Manual (`loadWASM()` required) |
| **`loadWASM()` Call** | Optional (reduces first-parse latency) | Required before WASM use |
| **Use Case** | Convenience | Bundle optimization |

> **Note**: This tutorial uses the **main entry point** (`web-csv-toolbox`) for simplicity. Examples show `await loadWASM()` for best practice (preloading), but it's optional with the main entry. For slim entry, `loadWASM()` is required.

## What is WebAssembly?

WebAssembly (WASM) is a binary instruction format that runs in modern browsers and runtimes. For CSV parsing, this means:

- **Compiled code execution** using WASM instead of interpreted JavaScript
- **Potential performance benefits** for CPU-intensive parsing
- **Same memory efficiency** as JavaScript implementation

**Note:** Actual performance depends on many factors including CSV structure, file size, and runtime environment. See [CodSpeed benchmarks](https://codspeed.io/kamiazya/web-csv-toolbox) for measured performance across different scenarios.

## When to use WebAssembly

**✅ Use WASM when:**
- Parsing UTF-8 or UTF-16 encoded CSV files
- Server-side parsing where blocking is acceptable
- CSV uses ASCII delimiters (comma, tab, semicolon, etc.)
- Using ASCII quotation marks (`"`, `'`, etc.)
- Working with Unicode-heavy data (consider `charset: 'utf-16'`)

**❌ Skip WASM when:**
- CSV uses non-UTF-8/UTF-16 encoding (Shift-JIS, EUC-JP, etc.)
- Stability is the highest priority (use JavaScript parser instead)
- WASM initialization overhead matters for your use case

**Note:** WASM parser is stable but the implementation may change in future versions. For maximum stability, use the JavaScript parser (`stable` preset).

## Step 1: Load the WASM Module

Load the module using `loadWASM()` once at application startup.

- Main entry: Optional but recommended (reduces first‑parse latency)
- Slim entry: Required before using any WASM features

```typescript
import { loadWASM } from 'web-csv-toolbox';

// Load WASM module (one-time initialization)
await loadWASM();

console.log('WASM module loaded');
```

**Important:** Call `loadWASM()` once at application startup, not before every parse operation. With the Main entry, this is optional but recommended.

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

## Step 5.5: Parse Binary Data with WASM

WASM supports binary input (`Uint8Array`, `ArrayBuffer`) with streaming:

```typescript
import { parseBinary, loadWASM, EnginePresets } from 'web-csv-toolbox';

await loadWASM();

const buffer = await fetch('data.csv').then(r => r.arrayBuffer());

for await (const record of parseBinary(buffer, {
  engine: EnginePresets.fast()
})) {
  console.log(record);
}
```

---

## Step 5.6: Stream Processing with WASM

For large files, use `BinaryCSVParserStream` with `{ engine: { wasm: true } }` for memory-efficient streaming:

```typescript
import { BinaryCSVParserStream, loadWASM } from 'web-csv-toolbox';

await loadWASM();

const stream = new BinaryCSVParserStream({ engine: { wasm: true } });

await fetch('large-file.csv')
  .then(res => res.body)
  .pipeThrough(stream)
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record);
    }
  }));
```

Or use the high-level `parseBinaryStream` API:

```typescript
import { parseBinaryStream, loadWASM } from 'web-csv-toolbox';

await loadWASM();

const stream = await fetch('large-file.csv').then(r => r.body);

for await (const record of parseBinaryStream(stream, {
  engine: { wasm: true }
})) {
  console.log(record);
}
```

**Benefits of streaming:**
- ✅ Constant memory usage (doesn't load entire file)
- ✅ Process files larger than available memory
- ✅ Start processing before download completes

---

## Step 6: Synchronous Parsing with WASM

For special use cases, WASM provides synchronous APIs through the high-level parsing functions:

```typescript
import { parseString, parseBinary, loadWASM } from 'web-csv-toolbox';

await loadWASM();

const csv = `name,age
Alice,30
Bob,25`;

// Synchronous parsing with WASM (returns array)
const records = parseString.toArraySync(csv, {
  engine: { wasm: true }
});

console.log(records);
// [
//   { name: 'Alice', age: '30' },
//   { name: 'Bob', age: '25' }
// ]

// Binary data can also be parsed synchronously with WASM
const encoder = new TextEncoder();
const binary = encoder.encode(csv);
const binaryRecords = parseBinary.toArraySync(binary, {
  engine: { wasm: true }
});
```

**Use case:** When you need all records immediately (not streaming)

**⚠️ Warning:** This loads the entire result into memory. Not suitable for large files.

---

## WASM Limitations

### String Encoding Support

WASM supports **UTF-8 and UTF-16** encodings for string inputs:

```typescript
import { parse, loadWASM } from 'web-csv-toolbox';

await loadWASM();

// ✅ Works (UTF-8, default)
for await (const record of parse(csv, {
  engine: { wasm: true }
})) {
  console.log(record);
}

// ✅ Works (UTF-16, optimized for JavaScript strings)
for await (const record of parse(unicodeCsv, {
  engine: { wasm: true },
  charset: 'utf-16'  // Skip TextEncoder/TextDecoder overhead
})) {
  console.log(record);
}

// ❌ Error (Shift-JIS not supported in WASM)
for await (const record of parse(shiftJISBinary, {
  engine: { wasm: true },
  charset: 'shift-jis'
})) {
  console.log(record);
}
```

**UTF-16 Mode Benefits:**
- JavaScript strings are internally UTF-16
- Avoids TextEncoder/TextDecoder overhead
- Faster for Unicode-heavy data (Japanese, Chinese, etc.)
- Works with string inputs only (binary inputs always use UTF-8)

**Workaround for non-UTF-8/UTF-16 encodings:**
Use JavaScript parser for legacy encodings like Shift-JIS:

```typescript
for await (const record of parse(shiftJISBinary, {
  engine: { wasm: false }, // JavaScript parser
  charset: 'shift-jis'
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
| WASM (main thread) | Compiled code | ✅ Yes | UTF-8/UTF-16, no worker overhead |
| Worker + WASM | Compiled code | ❌ No | UTF-8/UTF-16, worker communication overhead |

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
- ✅ Handle WASM limitations (UTF-8 only)
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
- WASM supports UTF-8 and UTF-16 encodings
- For UTF-16 string inputs, use `charset: 'utf-16'` option
- For other encodings (Shift-JIS, EUC-JP), use JavaScript parser with `{ engine: { wasm: false } }`

## Example Projects

For complete, working examples using WASM with different entry points:

- **Node.js Examples:**
  - [node-slim](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/node-slim) - Slim entry (external WASM loading)
  - [node-main](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/node-main) - Main entry (embedded WASM)
  - [node-worker-main](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/node-worker-main) - Worker with main version
- **Browser Examples (Vite):**
  - [vite-bundle-slim](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/vite-bundle-slim) - Slim entry with external WASM
  - [vite-bundle-main](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/vite-bundle-main) - Main entry with embedded WASM
- **Browser Examples (Webpack):**
  - [webpack-bundle-worker-slim](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/webpack-bundle-worker-slim) - Webpack with slim entry
  - [webpack-bundle-worker-main](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/webpack-bundle-worker-main) - Webpack with main entry

---

**Need help?** Open an issue on [GitHub](https://github.com/kamiazya/web-csv-toolbox/issues).
