# Node.js (Main)

This example uses the main entry (`web-csv-toolbox`) in Node.js. The main entry auto-initializes WASM on first WASM use.

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

- Recommended Node.js: 20.6+ (WASM loader relies on `import.meta.resolve`).

## Using Presets (optional)

```ts
import { parseString, EnginePresets } from 'web-csv-toolbox';

for await (const record of parseString(csv, {
  engine: EnginePresets.responsiveFast() // Worker + WASM
})) {
  // ...
}
```

## Cleanup

This example doesn’t create a WorkerPool. If you use a pool, call `pool.terminate()` when done.
