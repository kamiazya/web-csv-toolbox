---
title: Use with Bundlers
group: How-to Guides
---

# How to Use with Bundlers

This guide shows how to use `web-csv-toolbox` with popular JavaScript bundlers when using Worker-based or WebAssembly execution.

## Quick Start

### Vite

```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';
import workerUrl from 'web-csv-toolbox/worker?url';

const csv = `name,age,city
Alice,30,New York
Bob,25,London`;

for await (const record of parseString(csv, {
  engine: EnginePresets.recommended({ workerURL: workerUrl })
})) {
  console.log(record);
}
```

**No configuration needed.** Vite automatically handles the `?url` suffix.

### Webpack 5

```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

const workerUrl = new URL('web-csv-toolbox/worker', import.meta.url);

for await (const record of parseString(csv, {
  engine: EnginePresets.recommended({ workerURL: workerUrl })
})) {
  console.log(record);
}
```

**No configuration needed.** Webpack 5 automatically handles `new URL()` with `import.meta.url`.

## Without Workers

If you prefer not to use Workers, use the main thread engine:

```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

for await (const record of parseString(csv, {
  engine: EnginePresets.stable()
})) {
  console.log(record);
}
```

No bundler configuration needed.

## Using WebAssembly with Bundlers

When using WebAssembly for improved performance, **bundlers require explicit WASM URL configuration**.

### Why WASM Needs Special Handling

Unlike Workers which can be bundled as data URLs, WASM modules are loaded at runtime via `import.meta.url`. Bundlers need to know where to find the WASM file.

### Vite

#### Option 1: Copy WASM to public directory (Recommended)

```typescript
import { loadWasm, parseString, EnginePresets } from 'web-csv-toolbox';

// Copy node_modules/web-csv-toolbox/dist/csv.wasm
// to public/csv.wasm

await loadWasm('/csv.wasm');

for await (const record of parseString(csv, {
  engine: EnginePresets.turbo()  // Uses WASM + Worker
})) {
  console.log(record);
}
```

Add a build step to copy the WASM file:

```json
{
  "scripts": {
    "prebuild": "cp node_modules/web-csv-toolbox/dist/csv.wasm public/"
  }
}
```

#### Option 2: Use `?url` import with explicit URL (Recommended)

```typescript
import { loadWasm, parseString, EnginePresets } from 'web-csv-toolbox';
import wasmUrl from 'web-csv-toolbox/csv.wasm?url';

await loadWasm(wasmUrl);

for await (const record of parseString(csv, {
  engine: EnginePresets.turbo()
})) {
  console.log(record);
}
```

Vite will copy the WASM file to your dist folder automatically.

#### Option 3: Slim Variant for Smaller Bundle Size

If you want to minimize bundle size, use the slim variant which doesn't include inlined WASM:

```typescript
import { loadWasm, parseString, EnginePresets, ReusableWorkerPool } from 'web-csv-toolbox/slim';
import workerUrl from 'web-csv-toolbox/worker/slim?url';
import wasmUrl from 'web-csv-toolbox/csv.wasm?url';

// Initialize WASM before using it
await loadWasm(wasmUrl);

using pool = new ReusableWorkerPool({
  maxWorkers: 2,
  workerURL: workerUrl,
});

for await (const record of parseString(csv, {
  engine: {
    worker: true,
    wasm: true,
    workerPool: pool,
  }
})) {
  console.log(record);
}
```

##### Bundle Size Comparison:

- **Main variant** (`web-csv-toolbox`): WASM embedded as base64 - larger initial bundle, auto-initialization
- **Slim variant** (`web-csv-toolbox/slim`): WASM loaded separately - smaller initial bundle, manual initialization required

##### When to use Slim:
- ✅ Minimizing initial bundle size is critical
- ✅ You want lazy WASM loading (load only when needed)
- ✅ You can handle manual WASM initialization
- ✅ You're building a performance-critical web application

##### When to use Main:

- ✅ Convenience and simplicity over bundle size
- ✅ You want zero-configuration auto-initialization
- ✅ You prefer less boilerplate code
- ✅ Bundle size is not a primary concern

#### Vite Configuration

##### TypeScript Configuration

When using `?url` imports, you need to configure TypeScript to recognize these imports:

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "bundler",
    "types": ["vite/client"]  // Required for ?url suffix types
  }
}
```

##### Vite Configuration

To ensure WASM files are included in the build output:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    // Ensure browser build is selected
    conditions: ['browser', 'import', 'module', 'default'],
    mainFields: ['browser', 'module', 'main'],
  },
  // Include WASM files in build output
  assetsInclude: ['**/*.wasm'],
});
```

**Why `assetsInclude` is needed:**
- Vite may tree-shake unused imports, including `?url` imports
- `assetsInclude` ensures WASM files are always copied to the build output
- Without it, WASM files may be missing from the dist folder

### Webpack 5

```typescript
import { loadWasm, parseString } from 'web-csv-toolbox';

const wasmUrl = new URL('web-csv-toolbox/csv.wasm', import.meta.url);
await loadWasm(wasmUrl);
```

Configure Webpack to handle WASM files:

```javascript
// webpack.config.js
module.exports = {
  experiments: {
    asyncWebAssembly: true
  },
  module: {
    rules: [
      {
        test: /\.wasm$/,
        type: 'asset/resource'
      }
    ]
  }
};
```

### Worker + WASM Combined

When using both Workers and WASM (via `EnginePresets.turbo()`), you need to configure **both**.

#### Main Variant (Auto-initialization)

```typescript
import { loadWasm, parseString, EnginePresets } from 'web-csv-toolbox';
import workerUrl from 'web-csv-toolbox/worker?url';
import wasmUrl from 'web-csv-toolbox/csv.wasm?url';

// Optional: Pre-load WASM to reduce first-parse latency
await loadWasm(wasmUrl);

for await (const record of parseString(csv, {
  engine: EnginePresets.turbo({ workerURL: workerUrl })
})) {
  console.log(record);
}
```

#### Slim Variant (Manual initialization required)

```typescript
import { loadWasm, parseString, ReusableWorkerPool } from 'web-csv-toolbox/slim';
import workerUrl from 'web-csv-toolbox/worker/slim?url';
import wasmUrl from 'web-csv-toolbox/csv.wasm?url';

// Required: Initialize WASM before parsing
await loadWasm(wasmUrl);

using pool = new ReusableWorkerPool({
  maxWorkers: 2,
  workerURL: workerUrl,
});

for await (const record of parseString(csv, {
  engine: {
    worker: true,
    wasm: true,
    workerPool: pool,
  }
})) {
  console.log(record);
}
```

**Important Notes:**

- **Main variant**: Auto-initializes WASM on first use. Calling `loadWasm()` ahead of time is optional but reduces first-parse latency.
- **Slim variant**: **Must** call `loadWasm(wasmUrl)` before parsing. Without it, WASM-based parsing will fail.
- **WASM initialization**: Must complete **before** Workers start using it.
- **Bundler configuration**: Ensure your bundler emits the WASM asset and provides its URL (see Vite Configuration section above).

## Environment Detection

The package automatically selects the correct Worker implementation:

- **Node.js**: Uses Worker Threads (`worker.node.js`)
- **Browser**: Uses Web Workers (`worker.web.js`)

This is configured via `package.json` exports:

```json
{
  "exports": {
    "./worker": {
      "node": "./dist/worker.node.js",
      "browser": "./dist/worker.web.js",
      "default": "./dist/worker.web.js"
    }
  }
}
```

## Reusing Workers

For better performance when parsing multiple files, use a `WorkerPool`:

```typescript
import { parseString, EnginePresets, ReusableWorkerPool } from 'web-csv-toolbox';
import workerUrl from 'web-csv-toolbox/worker?url';

using pool = new ReusableWorkerPool({
  maxWorkers: 4,
  workerURL: workerUrl
});

const files = [csv1, csv2, csv3];

await Promise.all(
  files.map(async (csv) => {
    let count = 0;
    for await (const record of parseString(csv, {
      engine: EnginePresets.recommended({ workerPool: pool })
    })) {
      // Process record
      count++;
    }
    return count;
  })
);
```

## Common Issues

### TypeScript error: Cannot find module with `?url` suffix

**Symptom**: `Cannot find module 'web-csv-toolbox/worker?url' or its corresponding type declarations`

**Cause**: Missing TypeScript configuration for Vite's `?url` imports.

**Solution**: Add `vite/client` to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vite/client"]
  }
}
```

This enables TypeScript to recognize Vite's special import suffixes like `?url`, `?worker`, etc.

### Worker fails to load (404)

Make sure you're importing with the correct syntax for your bundler:

- **Vite**: `import workerUrl from 'web-csv-toolbox/worker?url'`
- **Webpack**: `new URL('web-csv-toolbox/worker', import.meta.url)`

### WASM module fails to load

**Symptom**: Error like `RuntimeError: Aborted(CompileError: WebAssembly.instantiate(): expected magic word 00 61 73 6d)`

**Causes**:
1. WASM file not copied to build output
2. Incorrect WASM URL
3. WASM file served with wrong MIME type

**Solutions**:

```typescript
// ✅ Good: Explicit URL
import wasmUrl from 'web-csv-toolbox/csv.wasm?url';
await loadWasm(wasmUrl);

// ❌ Bad: Missing loadWasm call
await loadWasm(); // May fail if bundler doesn't copy WASM file
```

Check your bundler configuration ensures WASM files are copied to the output directory.

### CSP (Content Security Policy) errors

If using data URLs (Vite's default), ensure your CSP allows them:

```
Content-Security-Policy: worker-src 'self' blob: data:; script-src 'self' 'wasm-unsafe-eval';
```

**For WASM**: Add `'wasm-unsafe-eval'` to `script-src` directive.

To avoid data URLs, configure your bundler to emit Workers as separate files.

## Example Projects

For complete, working examples with different bundlers and configurations:

- **Vite Examples:**
  - [vite-bundle-slim](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/vite-bundle-slim) - Browser bundle with slim entry
  - [vite-bundle-main](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/vite-bundle-main) - Browser bundle with main version
  - [vite-bundle-worker-slim](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/vite-bundle-worker-slim) - Worker bundle with slim entry
  - [vite-bundle-worker-main](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/vite-bundle-worker-main) - Worker bundle with main version
- **Webpack Examples:**
  - [webpack-bundle-worker-slim](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/webpack-bundle-worker-slim) - Worker bundle with slim entry
  - [webpack-bundle-worker-main](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/webpack-bundle-worker-main) - Worker bundle with main version

## See Also

- [Choosing the Right API](./choosing-the-right-api.md) - Learn which engine preset to use
- [Execution Strategies](../explanation/execution-strategies.md) - Understand how Workers improve performance
