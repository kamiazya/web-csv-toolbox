# Browser Worker (Lite Version) Example - Webpack

This example demonstrates Worker-based CSV parsing with external WASM loading in the browser using Webpack.

## Features

- **Worker-based parsing**: Offloads CSV parsing to Web Workers for non-blocking UI
- **Smaller bundle size**: ~16KB (87.5% smaller than main version)
- **External WASM**: WASM files are loaded externally when needed
- **Parallel processing**: Demonstrates parallel parsing with multiple Workers
- **Webpack bundling**: Uses Webpack as the bundler

## Running the Example

```bash
# Build the library first
cd ../..
pnpm run build

# Build and preview this example
cd examples/webpack-bundle-worker-lite
pnpm install
pnpm run build
pnpm run preview
```

## What This Example Tests

1. **Worker (JavaScript Engine)**: Tests basic Worker-based parsing without WASM
2. **Worker + WASM**: Tests WASM-accelerated parsing inside Workers with external loading
3. **Parallel Processing**: Tests concurrent parsing with multiple Workers

## Worker Configuration

The example uses `ReusableWorkerPool` to manage Workers:

```typescript
import workerUrl from "web-csv-toolbox/worker/lite";

const pool = new ReusableWorkerPool({
  maxWorkers: 2,
  workerURL: workerUrl,
});

try {
  for await (const record of parseString(csv, {
    engine: {
      worker: true,
      wasm: true,
      workerPool: pool,
    }
  })) {
    // Process record
  }
} finally {
  pool[Symbol.dispose](); // Clean up workers
}
```

## Webpack Configuration

The example includes a Webpack configuration that:
- Bundles the library for browser use
- Handles TypeScript compilation with ts-loader
- Uses conditional resolution for browser builds
- Worker bundle is imported as a resource and copied to output

## Bundle Size Comparison

- **Main version**: ~128KB (gzipped: 58KB) - WASM embedded
- **Lite version**: ~16KB (gzipped: 4.5KB) - WASM external (87.5% reduction)

## Notes

- Workers are automatically detected and imported via `web-csv-toolbox/worker/lite`
- **Smaller bundle**: Lite worker bundle excludes embedded WASM
- **Trade-off**: Slower initial WASM load but much smaller bundle size
- Worker cleanup is handled manually using `Symbol.dispose()`
