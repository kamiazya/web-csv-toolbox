# Package Exports and Environment Detection

This document explains how `web-csv-toolbox` uses Node.js package exports to provide environment-specific implementations.

## Overview

The library provides different Worker implementations for different JavaScript environments:

- **Node.js**: Uses Worker Threads API (`worker_threads`)
- **Browser/Deno**: Uses Web Workers API (`Worker`)

These are automatically selected based on the runtime environment using [Conditional Exports](https://nodejs.org/api/packages.html#conditional-exports) in `package.json`.

## Package Exports Structure

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
      },
      "browser": {
        "types": "./dist/worker.web.d.ts",
        "default": "./dist/worker.web.js"
      },
      "default": {
        "types": "./dist/worker.web.d.ts",
        "default": "./dist/worker.web.js"
      }
    }
  }
}
```

## How It Works

### 1. Main Entry Point (`.`)

The main entry point exports the public API:

```typescript
import { parseString } from 'web-csv-toolbox';
```

This always resolves to `./dist/web-csv-toolbox.js` regardless of environment.

### 2. Worker Entry Point (`./worker`)

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

## Worker Implementation Differences

### Node.js (worker.node.js)

```typescript
import { parentPort } from 'node:worker_threads';
import { createMessageHandler } from './worker.shared.js';

if (!parentPort) {
  throw new Error("This module must be run in a Worker Thread context");
}

const messageHandler = createMessageHandler(parentPort);
parentPort.on("message", (message) => {
  messageHandler(message);
});
```

**Key characteristics:**
- Requires `node:worker_threads` module
- Uses `parentPort.on()` for message handling
- Throws error if not run in Worker Thread context

### Browser (worker.web.js)

```typescript
import { createMessageHandler } from './worker.shared.js';

const workerContext = self;
const messageHandler = createMessageHandler(workerContext);

workerContext.addEventListener("message", (event) => {
  messageHandler(event.data);
});
```

**Key characteristics:**
- Uses global `self` as worker context
- Uses `addEventListener()` for message handling
- Compatible with Web Workers standard

### Shared Logic (worker.shared.js)

Both implementations use the same `createMessageHandler()` function, which contains:

- CSV parsing logic
- Message routing
- Error handling
- Stream processing

This ensures consistent behavior across environments.

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

## Internal Imports

The library also uses `imports` field for internal path resolution:

```json
{
  "imports": {
    "#execution/worker/createWorker.js": {
      "node": "./dist/execution/worker/helpers/createWorker.node.js",
      "browser": "./dist/execution/worker/helpers/createWorker.web.js",
      "default": "./dist/execution/worker/helpers/createWorker.web.js"
    }
  }
}
```

This allows internal code to use:

```typescript
import { createWorker } from '#execution/worker/createWorker.js';
```

And automatically get the correct implementation.

## See Also

- [Worker Pool Architecture](./worker-pool-architecture.md) - How Workers are managed
- [Execution Strategies](./execution-strategies.md) - When to use Workers
- [How to Use with Bundlers](../how-to-guides/use-with-bundlers.md) - Practical usage guide
