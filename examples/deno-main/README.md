# Deno Main Example

This example demonstrates using web-csv-toolbox with Deno using the main entry point.

## Features

- Auto WASM initialization
- Full feature set
- npm: specifier for package imports

## Run

```bash
deno task start
```

Or directly:

```bash
deno run index.ts
```

## What's tested

- JavaScript-based CSV parsing with `parseString`
- WASM-based parsing with `parseStringToArraySyncWASM` (auto-initialized)
