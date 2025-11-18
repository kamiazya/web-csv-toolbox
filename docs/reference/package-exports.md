---
title: Package Exports Reference
group: Reference
---

# Package Exports Reference

## Main Exports

### `web-csv-toolbox` (Default - Full Features)

```typescript
import { parseString, EnginePresets, /* ... */ } from 'web-csv-toolbox';
```

**Resolves to**: platform-specific builds
- **Browser**: `./dist/main.web.js`
- **Node.js**: `./dist/main.node.js`

**Exports**:
- All parsing functions (`parseString`, `parseBinary`, etc.)
- Engine configuration (`EnginePresets`)
  - `EnginePresets.stable()` - Stability optimized
  - `EnginePresets.responsive()` - UI responsiveness optimized
  - `EnginePresets.memoryEfficient()` - Memory efficiency optimized
  - `EnginePresets.fast()` - Parse speed optimized
  - `EnginePresets.responsiveFast()` - UI responsiveness + parse speed optimized
  - `EnginePresets.balanced()` - Balanced (general-purpose)
- Low-level APIs (`DefaultStringCSVLexer`, `DefaultCSVRecordAssembler`, etc.)
- Worker management (`WorkerPool`, `WorkerSession`)
- WASM utilities (`loadWASM`, `isWASMReady`, `parseStringToArraySyncWASM`)

**Characteristics**:
- ✅ Automatic WASM initialization (works immediately)
- ✅ All features available
- ⚠️ Larger bundle size (WASM embedded as base64)

### `web-csv-toolbox/lite` (Lite - Smaller Bundle)

```typescript
import { parseString, loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox/lite';
```

**Resolves to**: platform-specific builds
- **Browser**: `./dist/lite.web.js`
- **Node.js**: `./dist/lite.node.js`

**Exports**:
- All parsing functions (same as main)
- Engine configuration (same as main)
- Low-level APIs (same as main)
- Worker management (same as main)
- WASM utilities with **manual initialization required**:
  - `loadWASM()` - **Must be called before using WASM functions**
  - `isSyncInitialized()` - Check WASM initialization status
  - `parseStringToArraySyncWASM()` - Synchronous WASM parsing

**Characteristics**:
- ✅ Smaller main bundle (WASM not embedded in JavaScript)
- ✅ External WASM loading for better caching
- ❌ Requires manual `loadWASM()` call before using WASM features

**Usage pattern**:
```typescript
import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox/lite';

// Must initialize WASM before use
await loadWASM();

// Now can use WASM functions
const records = parseStringToArraySyncWASM(csv);
```

## Worker Export

### `web-csv-toolbox/worker`

Environment-specific Worker implementation.

**Node.js**:
```typescript
// Resolves to: ./dist/worker.node.js
import workerUrl from 'web-csv-toolbox/worker';
```

**Browser**:
```typescript
// Resolves to: ./dist/worker.web.js
import workerUrl from 'web-csv-toolbox/worker';
```

**Usage with bundlers**:

```typescript
// Vite
import workerUrl from 'web-csv-toolbox/worker?url';

// Webpack
const workerUrl = new URL('web-csv-toolbox/worker', import.meta.url);
```

## Conditional Exports

The `./worker` export uses Node.js conditional exports:

| Condition | File | Environment |
|-----------|------|-------------|
| `node` | `worker.node.js` | Node.js (Worker Threads) |
| `browser` | `worker.web.js` | Browser (Web Workers) |
| `default` | `worker.web.js` | Deno, other environments |

## WASM Export

### `web-csv-toolbox/csv.wasm`

```typescript
import wasmUrl from 'web-csv-toolbox/csv.wasm';
```

**Resolves to**: `./dist/csv.wasm`

Pre-compiled WebAssembly module for high-performance CSV parsing.

**Do you need this?**

**No, in most cases.** The library automatically loads the WASM module when you use WASM-enabled features:

```typescript
import { parse, loadWASM } from 'web-csv-toolbox';

// WASM module is automatically loaded
await loadWASM();

// Just use the API - WASM file is handled internally
for await (const record of parse(csv, {
  engine: { wasm: true }
})) {
  console.log(record);
}
```

**Current limitations:**

⚠️ The WASM module is currently embedded as base64 in the JavaScript bundle for automatic initialization. Importing `csv.wasm` separately does **not** reduce bundle size in the current architecture.

**Potential future use cases:**

When combined with future distribution improvements, this export could enable:

1. **Separate caching strategy**: Cache WASM file independently from JavaScript
2. **CDN hosting**: Host WASM on a different domain or CDN
3. **Service worker pre-caching**: Pre-cache WASM for offline use
4. **Custom loading strategies**: Implement lazy-loading or conditional loading

**See**: [Package Exports Explanation](../explanation/package-exports.md#3-wasm-module-web-csv-toolboxcsvwasm) for detailed discussion of current limitations and future improvements.

## Package Metadata

### `web-csv-toolbox/package.json`

```typescript
import pkg from 'web-csv-toolbox/package.json';
```

**Resolves to**: `./package.json`

Access to package metadata (version, etc.).

## TypeScript Types

All exports include TypeScript declarations:

```json
{
  "exports": {
    ".": {
      "types": "./dist/web-csv-toolbox.d.ts",
      "default": "./dist/web-csv-toolbox.js"
    },
    "./worker": {
      "node": {
        "types": "./dist/worker.node.d.ts",
        "default": "./dist/worker.node.js"
      }
      // ...
    }
  }
}
```

## See Also

- [Engine Presets Reference](./engine-presets.md) - Detailed preset configuration guide
- [Package Exports Explanation](../explanation/package-exports.md) - How conditional exports work
- [How to Use with Bundlers](../how-to-guides/use-with-bundlers.md) - Practical bundler integration
