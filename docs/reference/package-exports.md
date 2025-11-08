---
title: Package Exports Reference
group: Reference
---

# Package Exports Reference

## Main Export

### `web-csv-toolbox`

```typescript
import { parseString, EnginePresets, /* ... */ } from 'web-csv-toolbox';
```

**Resolves to**: `./dist/web-csv-toolbox.js`

**Exports**:
- All parsing functions (`parseString`, `parseBinary`, etc.)
- Engine configuration (`EnginePresets`)
- Low-level APIs (`CSVLexer`, `CSVRecordAssembler`, etc.)
- Worker management (`ReusableWorkerPool`, `WorkerSession`)

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

### `web-csv-toolbox/web_csv_toolbox_wasm_bg.wasm`

```typescript
import wasmUrl from 'web-csv-toolbox/web_csv_toolbox_wasm_bg.wasm';
```

**Resolves to**: `./dist/web_csv_toolbox_wasm_bg.wasm`

WebAssembly binary for WASM-based parsing.

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

- [Package Exports Explanation](../explanation/package-exports.md) - How conditional exports work
- [How to Use with Bundlers](../how-to-guides/use-with-bundlers.md) - Practical bundler integration
