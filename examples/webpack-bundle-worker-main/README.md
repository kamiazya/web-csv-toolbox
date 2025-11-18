# Browser Worker (Main Version) Example - Webpack

This example demonstrates Worker-based CSV parsing with embedded WASM in the browser using Webpack.

## Features

- **Worker-based parsing**: Offloads CSV parsing to Web Workers for non-blocking UI
- **Embedded WASM**: WASM files are embedded in the bundle as base64
- **Automatic initialization**: WASM initializes automatically when needed
- **Parallel processing**: Demonstrates parallel parsing with multiple Workers
- **Webpack bundling**: Uses Webpack as the bundler

## Running the Example

```bash
# Build the library first
cd ../..
pnpm run build

# Build and preview this example
cd examples/webpack-bundle-worker-main
pnpm install
pnpm run build
pnpm run preview
```

## What This Example Tests

1. **Worker (JavaScript Engine)**: Tests basic Worker-based parsing without WASM
2. **Worker + WASM**: Tests WASM-accelerated parsing inside Workers
3. **Parallel Processing**: Tests concurrent parsing with multiple Workers

## Worker Configuration

The example uses `ReusableWorkerPool` to manage Workers:

```typescript
import workerUrl from "web-csv-toolbox/worker";

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

## Notes

- Workers are automatically detected and imported via `web-csv-toolbox/worker`
- **Larger bundle**: Main worker bundle includes embedded WASM
- **Trade-off**: Faster initialization but larger bundle size compared to lite version
- Worker cleanup is handled manually using `Symbol.dispose()`
