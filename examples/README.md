# Examples

This directory contains examples demonstrating different build configurations for web-csv-toolbox.

## Available Examples

### Browser Examples

#### [vite-bundle-main](./vite-bundle-main)

Main version with auto-initialized WASM (base64-inlined).

- **Bundle size**: 115.31 kB (gzip: 55.38 kB)
- **Use case**: Quick prototyping, immediate WASM availability
- **Initialization**: Automatic (no setup required)

#### [vite-bundle-lite](./vite-bundle-lite)

Lite version with streaming WASM loading.

- **Bundle size**: 3.43 kB (gzip: 1.53 kB)
- **Use case**: Production builds, bundle size optimization
- **Initialization**: Manual (`await loadWASM()` required)
- **Savings**: 111.88 kB (97.0% reduction!)

#### [vite-bundle-worker-main](./vite-bundle-worker-main)

Worker-based parsing with auto-initialized WASM.

- **Bundle size**: 134.95 kB (gzip: 61.36 kB)
- **Use case**: Non-blocking CSV parsing, parallel processing
- **Features**: Web Workers, WASM in Workers, parallel parsing
- **Initialization**: Automatic (WASM initializes in Worker threads)

### Node.js Examples

#### [node-main](./node-main)

Main version for Node.js with auto-initialized WASM.

- **Use case**: Node.js scripts, CLI tools
- **Initialization**: Automatic (no setup required)

#### [node-lite](./node-lite)

Lite version for Node.js with manual WASM initialization.

- **Use case**: Production Node.js applications, smaller dependency footprint
- **Initialization**: Manual (`await loadWASM()` required)

#### [node-worker-main](./node-worker-main)

Worker-based parsing for Node.js with auto-initialized WASM.

- **Use case**: CPU-intensive parsing, parallel processing in Node.js
- **Features**: Worker Threads, WASM in Workers, parallel parsing
- **Initialization**: Automatic (WASM initializes in Worker threads)

## Which Version Should I Use?

### Use Main Version When:
- You need immediate WASM parser availability
- Bundle size is not a primary concern
- You want zero setup/configuration
- Prototyping or development

### Use Lite Version When:
- Bundle size is critical (production builds)
- You can handle async initialization
- You want better caching behavior
- You're building a web application

### Use Worker Version When:
- You need non-blocking CSV parsing
- Processing large CSV files that might freeze the UI
- Parallel processing of multiple CSV files
- CPU-intensive operations that should run in background threads

## Worker Setup Requirements

### For Browser (Vite)

When using Workers in a Vite-bundled application, you need to:

1. **Copy worker files** to your dist directory during build:
   ```typescript
   // vite.config.ts
   import { cpSync, copyFileSync } from "node:fs";

   export default defineConfig({
     plugins: [{
       name: "copy-worker-assets",
       closeBundle() {
         // Copy worker entry point
         copyFileSync("../../dist/worker.web.js", "dist/worker.web.js");

         // Copy worker dependencies
         const dirs = ['worker', 'parser', 'utils', 'wasm', 'core', 'engine', 'helpers', 'converters'];
         dirs.forEach(dir => cpSync(`../../dist/${dir}`, `dist/${dir}`, { recursive: true }));
       }
     }]
   });
   ```

2. **Explicitly provide workerURL** when creating workers:
   ```typescript
   const pool = new ReusableWorkerPool({
     maxWorkers: 2,
     workerURL: "./worker.web.js"  // Point to copied worker file
   });
   ```

### For Node.js

Worker Threads work automatically - no special configuration needed:

```typescript
import { parseString, ReusableWorkerPool } from "web-csv-toolbox";

const pool = new ReusableWorkerPool({ maxWorkers: 2 });
// Worker file is automatically resolved
```

## Bundle Size Comparison

| Version | Bundle Size | Gzipped | Savings | Notes |
|---------|-------------|---------|---------|-------|
| Main    | 115.31 kB   | 55.38 kB | - | WASM inlined (base64) |
| Lite    | 3.43 kB     | 1.53 kB | 97.0% | WASM loaded separately |
| Worker  | 134.95 kB   | 61.36 kB | - | Includes Worker code + WASM |

## Testing in Browser

Each example includes an HTML file for browser testing.

### Development Server

```bash
# From the example directory
cd examples/vite-bundle-lite  # or vite-bundle-main
pnpm run dev
```

Then open http://localhost:5173 in your browser.

### Preview Built Bundle

```bash
# From the example directory
cd examples/vite-bundle-lite  # or vite-bundle-main
pnpm run build
pnpm run preview
```

Then open http://localhost:4173 in your browser.

### Verify WASM Streaming (Lite Version)

1. Open the lite example in your browser
2. Open DevTools Network tab
3. Look for `csv.wasm` being fetched separately
4. Verify `bundle.js` is only ~3.4 kB (not ~115 kB)

## Running Examples

### Browser Examples

```bash
# Install dependencies (from root)
pnpm install

# Build the main package first
pnpm run build

# Build and test browser examples
cd examples/vite-bundle-main  # or vite-bundle-lite, vite-bundle-worker-main
pnpm run build
pnpm run preview
```

### Node.js Examples

```bash
# Install dependencies (from root)
pnpm install

# Build the main package first
pnpm run build

# Run Node.js examples
cd examples/node-main  # or node-lite, node-worker-main
pnpm start
```

## Workspace Configuration

Examples are part of the pnpm workspace and automatically resolve `web-csv-toolbox` from the local package.

See [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) for configuration.
