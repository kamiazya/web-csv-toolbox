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
  engine: EnginePresets.worker({ workerURL: workerUrl })
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
  engine: EnginePresets.worker({ workerURL: workerUrl })
})) {
  console.log(record);
}
```

**No configuration needed.** Webpack 5 automatically handles `new URL()` with `import.meta.url`.

### Rollup

Install the plugin:

```bash
npm install @rollup/plugin-url --save-dev
```

Configure Rollup:

```javascript
// rollup.config.js
import url from '@rollup/plugin-url';

export default {
  plugins: [
    url({
      include: ['**/worker.*.js'],
      limit: 0, // Always emit as separate files
      fileName: '[name][extname]'
    })
  ]
};
```

Use in your code:

```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';
import workerUrl from 'web-csv-toolbox/worker';

for await (const record of parseString(csv, {
  engine: EnginePresets.worker({ workerURL: workerUrl })
})) {
  console.log(record);
}
```

## Without Workers

If you prefer not to use Workers, use the main thread engine:

```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

for await (const record of parseString(csv, {
  engine: EnginePresets.mainThread()
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

**Option 1: Copy WASM to public directory (Recommended)**

```typescript
import { loadWASM, parseString, EnginePresets } from 'web-csv-toolbox';

// Copy node_modules/web-csv-toolbox/dist/web_csv_toolbox_wasm_bg.wasm
// to public/web_csv_toolbox_wasm_bg.wasm

await loadWASM('/web_csv_toolbox_wasm_bg.wasm');

for await (const record of parseString(csv, {
  engine: EnginePresets.fastest()  // Uses WASM + Worker
})) {
  console.log(record);
}
```

Add a build step to copy the WASM file:

```json
{
  "scripts": {
    "prebuild": "cp node_modules/web-csv-toolbox/dist/web_csv_toolbox_wasm_bg.wasm public/"
  }
}
```

**Option 2: Use `?url` import with explicit URL**

```typescript
import { loadWASM, parseString, EnginePresets } from 'web-csv-toolbox';
import wasmUrl from 'web-csv-toolbox/web_csv_toolbox_wasm_bg.wasm?url';

await loadWASM(wasmUrl);

for await (const record of parseString(csv, {
  engine: EnginePresets.fastest()
})) {
  console.log(record);
}
```

Vite will copy the WASM file to your dist folder automatically.

### Webpack 5

```typescript
import { loadWASM, parseString } from 'web-csv-toolbox';

const wasmUrl = new URL(
  'web-csv-toolbox/web_csv_toolbox_wasm_bg.wasm',
  import.meta.url
);

await loadWASM(wasmUrl);
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

### Rollup

Install the plugin:

```bash
npm install @rollup/plugin-wasm --save-dev
```

Configure Rollup:

```javascript
// rollup.config.js
import wasm from '@rollup/plugin-wasm';

export default {
  plugins: [
    wasm({
      maxFileSize: 100000 // 100KB (adjust as needed)
    })
  ]
};
```

Use in your code:

```typescript
import { loadWASM, parseString } from 'web-csv-toolbox';

// WASM will be available at runtime via plugin
await loadWASM();

for await (const record of parseString(csv, { engine: { wasm: true } })) {
  console.log(record);
}
```

### Worker + WASM Combined

When using both Workers and WASM (via `EnginePresets.fastest()` or `workerWasm()`), you need to configure **both**:

```typescript
import { loadWASM, parseString, EnginePresets } from 'web-csv-toolbox';
import workerUrl from 'web-csv-toolbox/worker?url';
import wasmUrl from 'web-csv-toolbox/web_csv_toolbox_wasm_bg.wasm?url';

await loadWASM(wasmUrl);

for await (const record of parseString(csv, {
  engine: EnginePresets.fastest({ workerURL: workerUrl })
})) {
  console.log(record);
}
```

**Important**: The WASM module must be loaded **before** the Worker starts using it. Always call `loadWASM()` before parsing when using `workerWasm()` or `fastest()` presets.

## Environment Detection

The package automatically selects the correct Worker implementation:

- **Node.js**: Uses Worker Threads (`worker.node.js`)
- **Browser**: Uses Web Workers (`worker.web.js`)

This is configured via `package.json` exports:

```json
{
  "exports": {
    "./worker": {
      "node": "./dist/execution/worker/helpers/worker.node.js",
      "browser": "./dist/execution/worker/helpers/worker.web.js",
      "default": "./dist/execution/worker/helpers/worker.web.js"
    }
  }
}
```

## Reusing Workers

For better performance when parsing multiple files, use a `WorkerPool`:

```typescript
import { parseString, EnginePresets, ReusableWorkerPool } from 'web-csv-toolbox';
import workerUrl from 'web-csv-toolbox/worker?url';

const pool = new ReusableWorkerPool({
  maxWorkers: 4,
  workerURL: workerUrl
});

const files = [csv1, csv2, csv3];

await Promise.all(
  files.map(async (csv) => {
    const records = [];
    for await (const record of parseString(csv, {
      engine: EnginePresets.worker({ workerPool: pool })
    })) {
      records.push(record);
    }
    return records;
  })
);

await pool.terminate();
```

## Common Issues

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
import wasmUrl from 'web-csv-toolbox/web_csv_toolbox_wasm_bg.wasm?url';
await loadWASM(wasmUrl);

// ❌ Bad: Missing loadWASM call
await loadWASM(); // May fail if bundler doesn't copy WASM file
```

Check your bundler configuration ensures WASM files are copied to the output directory.

### CSP (Content Security Policy) errors

If using data URLs (Vite's default), ensure your CSP allows them:

```
Content-Security-Policy: worker-src 'self' blob: data:; script-src 'self' 'wasm-unsafe-eval';
```

**For WASM**: Add `'wasm-unsafe-eval'` to `script-src` directive.

To avoid data URLs, configure your bundler to emit Workers as separate files.

## See Also

- [Choosing the Right API](./choosing-the-right-api.md) - Learn which engine preset to use
- [Execution Strategies](../explanation/execution-strategies.md) - Understand how Workers improve performance
