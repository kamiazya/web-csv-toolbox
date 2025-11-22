# Node.js (Slim)

This example uses the slim entry (`web-csv-toolbox/slim`) in Node.js. Slim requires manual WASM initialization.

## Run

```bash
# At repository root (first time)
pnpm install
pnpm run build

# Run this example
cd examples/node-slim
pnpm install
pnpm start
```

- Recommended Node.js: 20.6+ (WASM loader relies on `import.meta.resolve`).

## WASM Init

```ts
import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox/slim';

await loadWASM(); // Node resolves the WASM file internally
const rows = parseStringToArraySyncWASM(csv);
```

## Using Presets (optional)

```ts
import { parseString, EnginePresets } from 'web-csv-toolbox/slim';

for await (const record of parseString(csv, {
  engine: EnginePresets.responsiveFast() // Worker + WASM
})) {
  // ...
}
```

## Cleanup

When using a WorkerPool, call `pool.terminate()` when finished.
