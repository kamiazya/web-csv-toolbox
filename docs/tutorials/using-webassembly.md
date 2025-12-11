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
import { parseStringToArraySyncWasm } from 'web-csv-toolbox';

// Auto-initialization occurs on first WASM use.
// Optional but recommended: preload to reduce first‑parse latency
await loadWasm();
const records = parseStringToArraySyncWasm(csv);
```

**Best for:**
- ✅ Rapid prototyping and development
- ✅ When you want the simplest API
- ✅ Applications where bundle size is not critical

**Characteristics:**
- Automatic WASM initialization on first WASM use (not at import time)
- Preloading via `loadWasm()` is recommended to minimize first‑parse latency
- Larger bundle size (WASM embedded as base64)
- ⚠️ Experimental auto-initialization may change in future

### Slim Entry Point (`web-csv-toolbox/slim`) - For Bundle Size Optimization

```typescript
import { loadWasm, parseStringToArraySyncWasm } from 'web-csv-toolbox/slim';

// Manual initialization required
await loadWasm();
const records = parseStringToArraySyncWasm(csv);
```

**Best for:**
- ✅ Production applications with bundle size budgets
- ✅ When optimizing initial load time
- ✅ When you want explicit control over WASM loading

**Characteristics:**
- Manual `loadWasm()` call required before using WASM features
- Smaller main bundle size (WASM external)
- External WASM file for better caching

**Comparison:**

| Aspect | Main | Slim |
|--------|------|------|
| **Bundle Size** | Larger (WASM embedded) | Smaller (WASM external) |
| **Initialization** | Automatic | Manual |
| **API Complexity** | Simpler | Requires `loadWasm()` |
| **Use Case** | Convenience | Bundle optimization |

> **Note**: This tutorial uses the **main entry point** (`web-csv-toolbox`) for simplicity. To use the slim entry, simply import from `web-csv-toolbox/slim` and add `await loadWasm()` before using WASM functions.

## What is WebAssembly?

WebAssembly (WASM) is a binary instruction format that runs in modern browsers and runtimes. For CSV parsing, this means:

- **Compiled code execution** using WASM instead of interpreted JavaScript
- **SIMD acceleration** for parallel data processing (requires Chrome 91+, Firefox 89+, Safari 16.4+, or Node.js 16.4+)
- **Automatic fallback** to JavaScript implementation if SIMD is not supported
- **Potential performance benefits** for CPU-intensive parsing
- **Same memory efficiency** as JavaScript implementation

**Note:** Actual performance depends on many factors including CSV structure, file size, and runtime environment. See [CodSpeed benchmarks](https://codspeed.io/kamiazya/web-csv-toolbox) for measured performance across different scenarios.

## When to use WebAssembly

**✅ Use WASM when:**
- Parsing UTF-8 CSV files
- Runtime supports SIMD (Chrome 91+, Firefox 89+, Safari 16.4+, Node.js 16.4+)
- Server-side parsing where blocking is acceptable
- CSV uses standard delimiters (comma, tab, etc.)
- CSV uses double-quote (`"`) as quotation character

**❌ Skip WASM when:**
- Runtime doesn't support SIMD (library will automatically fall back to JavaScript)
- CSV uses non-UTF-8 encoding (Shift-JIS, EUC-JP, etc.)
- CSV uses single-quote (`'`) as quotation character
- Stability is the highest priority (use JavaScript parser instead)
- WASM initialization overhead matters for your use case

**Note:** WASM parser is stable but the implementation may change in future versions. For maximum stability, use the JavaScript parser (`mainThread` preset). The library automatically detects SIMD support and falls back to JavaScript when needed.

## Step 1: Load the WASM Module

Load the module using `loadWasm()` once at application startup.

- Main entry: Optional but recommended (reduces first‑parse latency)
- Slim entry: Required before using any WASM features

```typescript
import { loadWasm } from 'web-csv-toolbox';

// Load WASM module (one-time initialization)
await loadWasm();

console.log('WASM module loaded');
```

**Important:** Call `loadWasm()` once at application startup, not before every parse operation. With the Main entry, this is optional but recommended. The library automatically checks for SIMD support during initialization and will use the JavaScript implementation as fallback if SIMD is not available.

---

## Step 2: Parse CSV with WASM

Once loaded, use the `engine` option to enable WASM:

```typescript
import { parse, loadWasm } from 'web-csv-toolbox';

// Load WASM (once)
await loadWasm();

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
import { parse, loadWasm, EnginePresets } from 'web-csv-toolbox';

await loadWasm();

// Use 'turbo' preset (main thread + GPU/WASM)
for await (const record of parse(csv, {
  engine: EnginePresets.turbo()
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
import { parse, loadWasm, EnginePresets } from 'web-csv-toolbox';

await loadWasm();

// Use 'turbo' preset (main thread + GPU/WASM)
for await (const record of parse(csv, {
  engine: EnginePresets.turbo()
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
import { parseResponse, loadWasm, EnginePresets } from 'web-csv-toolbox';

await loadWasm();

async function fetchAndParseCSV(url: string) {
  const response = await fetch(url);

  for await (const record of parseResponse(response, {
    engine: EnginePresets.turbo()
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
import { parseStringToArraySyncWasm, loadWasm } from 'web-csv-toolbox';

await loadWasm();

const csv = `name,age
Alice,30
Bob,25`;

// Synchronous parsing (returns array)
const records = parseStringToArraySyncWasm(csv);

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
import { parse, loadWasm } from 'web-csv-toolbox';

await loadWasm();

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
import { parse, loadWasm } from 'web-csv-toolbox';

await loadWasm();

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

If you forget to call `loadWasm()`, an error occurs:

```typescript
import { parse } from 'web-csv-toolbox';

try {
  // ❌ Forgot to call loadWasm()
  for await (const record of parse(csv, {
    engine: { wasm: true }
  })) {
    console.log(record);
  }
} catch (error) {
  console.error('WASM not loaded:', error);
}
```

**Fix:** Always call `loadWasm()` before parsing:

```typescript
import { parse, loadWasm } from 'web-csv-toolbox';

await loadWasm(); // ✅ Load WASM first

for await (const record of parse(csv, {
  engine: { wasm: true }
})) {
  console.log(record);
}
```

---

### Invalid Options for WASM

```typescript
import { parse, loadWasm } from 'web-csv-toolbox';

await loadWasm();

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
import { loadWasm } from 'web-csv-toolbox';

// Load WASM on page load
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadWasm();
    console.log('WASM ready');
  } catch (error) {
    console.error('WASM initialization failed:', error);
  }
});

// Later in your code
async function handleFileUpload(file: File) {
  const csv = await file.text();

  for await (const record of parse(csv, {
    engine: EnginePresets.turbo()
  })) {
    console.log(record);
  }
}
```

---

### Node.js Server

```typescript
import { Hono } from 'hono';
import { loadWasm, parse, ReusableWorkerPool } from 'web-csv-toolbox';

const app = new Hono();

// Initialize WASM at server startup
await loadWasm();
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

WASM with SIMD support is required for optimal performance:

| Browser/Runtime | Minimum Version for SIMD | Notes |
|-----------------|-------------------------|-------|
| Chrome/Edge | 91+ | Full SIMD support |
| Firefox | 89+ | Full SIMD support |
| Safari | 16.4+ | Full SIMD support |
| Node.js | 16.4+ | Full SIMD support |

**Browser API Support:**
- **WebAssembly**: [Can I Use](https://caniuse.com/wasm) | [MDN](https://developer.mozilla.org/en-US/docs/WebAssembly)
- **WASM SIMD**: [Can I Use](https://caniuse.com/wasm-simd) | [MDN](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/SIMD)

**Automatic Fallback**: If SIMD is not supported, the library automatically uses the JavaScript implementation without errors.

For detailed browser compatibility, see [Supported Environments](../reference/supported-environments.md).

---

## Summary

You've learned how to:
- ✅ Load the WASM module with `loadWasm()`
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
- For fastest execution time, use `EnginePresets.turbo()` on the main thread (blocks UI)
- For non-blocking UI, accept the worker communication overhead trade-off
- Optionally call `loadWasm()` once at startup to avoid repeated initialization overhead (auto-initialization works but adds latency on first use)

### Encoding errors

**Problem:** Incorrect characters in parsed data

**Solution:**
- WASM only supports UTF-8
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
