# Deno Main Example - Engine Test Suite

This example demonstrates using web-csv-toolbox with Deno, testing JavaScript and WASM engines.

## Features

- Auto WASM initialization
- EnginePresets support
- Performance comparison between engines
- npm: specifier for package imports

## Run

```bash
deno task start
```

Or directly:

```bash
deno run --allow-read index.ts
```

## Engine Availability

| Engine | Status | Notes |
|--------|--------|-------|
| JavaScript (stable) | ✅ Available | Pure JS, maximum compatibility |
| WASM | ✅ Available | Fast parsing, auto-initialized |
| Worker | ⚠️ Limited | Deno Workers differ from Web Workers |
| GPU (WebGPU) | ❌ Not available | Browser-only feature |

## What's tested

1. **JavaScript Engine** - Pure JavaScript engine with inline config
2. **WASM Direct** - Using `parseStringToArraySyncWASM`
3. **WASM via Config** - Using `engine: { wasm: true }`
4. **Performance** - JS vs WASM comparison (1000 rows)

## Example Output

```
🦕 Deno Main Version - Engine Test Suite
=========================================

Engine Availability in Deno CLI:
----------------------------------------
✅ JavaScript (stable)  - Available
✅ WASM                 - Available
⚠️  Worker              - Limited
❌ GPU (WebGPU)         - Not available in Deno CLI

Test 1: stable() Preset (JavaScript Engine)
----------------------------------------
✅ Parsed 3 records in 0.50ms

Test 2: WASM Engine (parseStringToArraySyncWASM)
----------------------------------------
✅ Parsed 3 records in 0.20ms

...
```

## For GPU Testing

GPU (WebGPU) is only available in browser environments. Use the `browser-engine-test` example:

```bash
cd ../browser-engine-test
pnpm install
pnpm dev          # Interactive browser testing
pnpm test:gpu     # Headless GPU tests with Playwright
```
