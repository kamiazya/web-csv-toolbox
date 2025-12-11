# Browser Worker (Main Version) Example

This example demonstrates Worker-based CSV parsing with automatic WASM initialization in the browser.

## Features

- **Worker-based parsing**: Offloads CSV parsing to Web Workers for non-blocking UI
- **WASM in Workers**: Runs WebAssembly parsing inside Workers
- **Parallel processing**: Demonstrates parallel parsing with multiple Workers

## Running the Example

```bash
# Build the library first
cd ../..
pnpm run build

# Build and preview this example
cd examples/vite-bundle-worker-main
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
using pool = new ReusableWorkerPool({ maxWorkers: 2 });

for await (const record of parseString(csv, {
  engine: {
    worker: true,
    wasm: true,
    workerPool: pool,
  }
})) {
  // Process record
}
```

## Vite Configuration

The example includes a simple Vite configuration that:
- Bundles the library for browser use
- Copies the WASM file to the output directory
- No special worker configuration needed (Vite handles it automatically)

## Notes

- Workers are automatically detected and imported by `web-csv-toolbox/worker`
- WASM files are loaded dynamically from the same directory as the bundle
- Prefer `using` if your environment supports Explicit Resource Management; otherwise call `pool.terminate()` explicitly. Engine presets like `EnginePresets.recommended()` / `responsiveFast()` are also available.
