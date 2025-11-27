# Deno Slim Example

This example demonstrates using web-csv-toolbox with Deno using the slim entry point.

## Features

- Manual WASM initialization
- Smaller JavaScript bundle size
- npm: specifier for package imports

## Run

```bash
deno task start
```

Or directly:

```bash
deno run --allow-read index.ts
```

## What's tested

- Manual WASM initialization with `loadWASM`
- WASM-based parsing with `parseString.toArraySync`
