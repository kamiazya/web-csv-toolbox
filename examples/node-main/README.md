# Node.js (Main) - Engine Test Suite

This example tests JavaScript and WASM engines with web-csv-toolbox in Node.js.

## Run

```bash
# At repository root (first time)
pnpm install
pnpm run build

# Run this example
cd examples/node-main
pnpm install
pnpm start
```

- **Required Node.js: 24.0+** (uses `using` syntax for explicit resource management).

## Engine Availability

| Engine | Status | Notes |
|--------|--------|-------|
| JavaScript (stable) | ✅ Available | Pure JS, maximum compatibility |
| WASM | ✅ Available | Fast parsing, auto-initialized |
| Worker | ⚠️ Available | Requires worker setup |
| GPU (WebGPU) | ❌ Not available | Browser-only feature |

## What's tested

1. **stable() Preset** - JavaScript engine with `EnginePresets.stable()`
2. **WASM Direct** - Using `parseStringToArraySyncWASM`
3. **WASM via Config** - Using `engine: { wasm: true }`
4. **Performance** - JS vs WASM comparison (1000 rows)

## Using Presets

```ts
import { parseString, EnginePresets } from 'web-csv-toolbox';

// JavaScript engine (maximum compatibility)
for await (const record of parseString(csv, {
  engine: EnginePresets.stable()
})) {
  // ...
}

// WASM engine (faster)
for await (const record of parseString(csv, {
  engine: { wasm: true, worker: false, gpu: false }
})) {
  // ...
}
```

## For GPU Testing

GPU (WebGPU) is only available in browser environments. Use the `browser-engine-test` example:

```bash
cd ../browser-engine-test
pnpm install
pnpm dev          # Interactive browser testing
pnpm test:gpu     # Headless GPU tests with Playwright
```
