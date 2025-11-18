---
title: Package Exports and Environment Detection
group: Explanation
---

# Package Exports and Environment Detection

This document explains how `web-csv-toolbox` uses Node.js package exports to provide environment-specific implementations and optimized resource loading.

## Overview

This library provides multiple import paths for different use cases. The appropriate implementation is automatically selected based on your environment (Node.js, Browser, Deno, etc.) - **you don't need to worry about platform differences**.

**What you need to know:**

1. **Main library** (`web-csv-toolbox`): Full features with automatic WASM initialization
   ```typescript
   import { parseStringToArraySyncWASM } from 'web-csv-toolbox';
   const records = parseStringToArraySyncWASM(csv); // Auto-initialized
   ```

2. **Lite library** (`web-csv-toolbox/lite`): Smaller bundle size, manual WASM initialization required
   ```typescript
   import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox/lite';
   await loadWASM(); // Must call before using WASM functions
   const records = parseStringToArraySyncWASM(csv);
   ```

3. **Worker file** (`web-csv-toolbox/worker`): Only needed when using bundlers with worker-based parsing
   ```typescript
   // Vite
   import workerUrl from 'web-csv-toolbox/worker?url';

   // Webpack
   const workerUrl = new URL('web-csv-toolbox/worker', import.meta.url);
   ```

4. **WASM module** (`web-csv-toolbox/csv.wasm`): For advanced deployment scenarios
   - Default: WASM is automatically loaded (no manual import needed)
   - Advanced: Import directly for separate caching or custom loading

The library handles environment detection and optimizations automatically using [Conditional Exports](https://nodejs.org/api/packages.html#conditional-exports).

## Available Import Paths

| Import Path | Purpose | Bundle Size | Typical Usage |
|-------------|---------|-------------|---------------|
| `web-csv-toolbox` | Full features (auto-initialization) | Larger (WASM embedded in JS) | ✅ Default choice |
| `web-csv-toolbox/lite` | Smaller bundle (manual initialization) | Smaller (WASM as separate file) | ✅ Bundle size optimization |
| `web-csv-toolbox/worker` | Worker implementation | - | ✅ Via bundler |
| `web-csv-toolbox/csv.wasm` | WebAssembly module | WASM binary only | ⚠️ Advanced scenarios |

> **Note**: Bundle sizes vary depending on the bundler, tree-shaking, and build configuration. The lite version reduces the main JavaScript bundle size by not embedding the WASM binary.

## How It Works

### 1. Entry Point Variants: Main vs Lite

The library provides two entry points with different trade-offs:

#### Main Entry Point (`web-csv-toolbox`)

**Best for**: Most users who want automatic WASM initialization and convenience

```typescript
import { parseStringToArraySyncWASM } from 'web-csv-toolbox';

// Auto-initialized - works immediately
const records = parseStringToArraySyncWASM(csv);
```

**Characteristics:**
- ✅ Automatic WASM initialization (just works!)
- ✅ All features available immediately
- ✅ Simpler API (no manual `loadWASM()` call needed)
- ⚠️ Larger bundle size (WASM binary embedded as base64)
- ⚠️ **Experimental**: Auto-init may change in future versions

**When to use:**
- Rapid prototyping and development
- Applications where bundle size is not critical
- When you want the simplest possible API

#### Lite Entry Point (`web-csv-toolbox/lite`)

**Best for**: Bundle size-sensitive applications

```typescript
import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox/lite';

// Manual initialization required
await loadWASM();
const records = parseStringToArraySyncWASM(csv);
```

**Characteristics:**
- ✅ Smaller bundle size (no embedded WASM)
- ✅ External WASM loading for better caching
- ✅ More control over initialization timing
- ❌ Requires manual `loadWASM()` call
- ❌ More code to write

**When to use:**
- Production applications optimizing bundle size
- Applications with performance budgets
- When you want explicit control over WASM loading

**Bundle Size Comparison:**

| Entry Point | Main Bundle | WASM Binary | Total (Approx.) |
|-------------|-------------|-------------|-----------------|
| `web-csv-toolbox` | Larger (WASM embedded) | - | Larger |
| `web-csv-toolbox/lite` | Smaller | Separate file | Smaller overall |

> **Note**: Actual bundle sizes depend on bundler configuration, tree-shaking, and compression. The lite version reduces the main JavaScript bundle size by not embedding the WASM binary (which is instead loaded as a separate asset).

### 2. Main Export API

Both entry points export the same public API:

```typescript
import { parseString } from 'web-csv-toolbox';
// or
import { parseString } from 'web-csv-toolbox/lite';
```

The main export resolves to `./dist/main.js` (main) or `./dist/lite.js` (lite) respectively.

### 3. Worker Entry Point (`web-csv-toolbox/worker`)

The worker entry point provides environment-specific implementations:

```typescript
import workerUrl from 'web-csv-toolbox/worker?url'; // Vite
// or
const workerUrl = new URL('web-csv-toolbox/worker', import.meta.url); // Webpack
```

**Resolution logic:**

1. **Node.js environment** (`"node"` condition):
   - Resolves to `./dist/worker.node.js`
   - Uses `worker_threads` module
   - Listens for messages via `parentPort`

2. **Browser environment** (`"browser"` condition):
   - Resolves to `./dist/worker.web.js`
   - Uses Web Workers API
   - Listens for messages via `self.addEventListener('message', ...)`

3. **Default fallback**:
   - Uses browser implementation (`worker.web.js`)
   - Covers Deno and other environments

### 4. WASM Module (`web-csv-toolbox/csv.wasm`)

**What is it?**

This exports the pre-compiled WebAssembly module used for high-performance CSV parsing.

**Do you need to use this directly?**

**No, in most cases.** The library automatically loads the WASM module when you use WASM-enabled features.

```typescript
import { parse, loadWASM } from 'web-csv-toolbox';

// WASM module is automatically loaded
await loadWASM();

// Just use the API - WASM file is handled internally
for await (const record of parse(csv, { engine: { wasm: true } })) {
  console.log(record);
}
```

**Current limitations and future improvements:**

⚠️ **Currently, this export has limited practical use.** The WASM module is embedded as base64 in the JavaScript bundle for automatic initialization, so importing `csv.wasm` separately does not reduce bundle size.

**Potential use cases** (when combined with future distribution improvements):

1. **Separate caching strategy**: Cache WASM file independently from JavaScript
2. **CDN hosting**: Host WASM on a different domain or CDN
3. **Service worker pre-caching**: Pre-cache WASM for offline use
4. **Custom loading strategies**: Implement lazy-loading or conditional loading

**Future considerations:**

We are considering improvements to the distribution method to enable:
- Lightweight entry point without embedded WASM
- Streaming WASM loading to reduce initial bundle size
- Better separation between WASM and JavaScript code

These improvements would make the `csv.wasm` export more useful for bundle size optimization. For transparency, we acknowledge that the current architecture does not fully support these scenarios, but we are exploring options for future releases.

**Key points:**
- ✅ WASM is automatically loaded - no manual import needed in normal usage
- ⚠️ Currently does NOT reduce bundle size (base64 WASM is embedded)
- 🔮 Future improvements may enable lightweight distribution options

## Worker Implementation Differences

### Node.js (worker.node.js)

**Key characteristics:**
- Uses `node:worker_threads` module
- Listens via `parentPort.on("message", ...)`
- Throws error if not run in Worker Thread context

### Browser (worker.web.js)

**Key characteristics:**
- Uses global `self` as worker context
- Listens via `self.addEventListener("message", ...)`
- Compatible with Web Workers standard

Both implementations share the same parsing logic and behavior, ensuring consistent results across environments.

## Bundler Compatibility

Modern bundlers understand package exports and handle them correctly:

### Vite

```typescript
// Automatically resolves based on build target
import workerUrl from 'web-csv-toolbox/worker?url';
```

Vite's `?url` suffix tells the bundler to:
1. Resolve the correct environment file
2. Process it as a Worker
3. Return a URL (often as data URL)

### Webpack 5

```typescript
// Automatically resolves based on target
const workerUrl = new URL('web-csv-toolbox/worker', import.meta.url);
```

Webpack's `new URL()` + `import.meta.url` syntax:
1. Resolves the correct environment file
2. Emits Worker as separate chunk
3. Returns runtime URL

### Rollup

Requires `@rollup/plugin-url` or similar plugin to process Worker imports.

## Why This Design?

### Benefits

1. **Zero Configuration**: Users don't need to manually select Worker implementations
2. **Type Safety**: TypeScript types match the runtime environment
3. **Tree Shaking**: Bundlers can eliminate unused environment code
4. **Standard Compliance**: Uses official Node.js package exports spec

### Trade-offs

1. **Requires Modern Tools**: Older bundlers may not support conditional exports
2. **Complexity**: Internal implementation has more moving parts
3. **Bundle Size**: Both implementations exist in package (but only one is bundled)

## See Also

- [Worker Pool Architecture](./worker-pool-architecture.md) - How Workers are managed
- [Execution Strategies](./execution-strategies.md) - When to use Workers
- [How to Use with Bundlers](../how-to-guides/use-with-bundlers.md) - Practical usage guide
