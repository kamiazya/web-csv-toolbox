# Node.js Worker (Main Version) Example

This example demonstrates Worker-based CSV parsing in Node.js using the main entry of `web-csv-toolbox`.

## Features

- Worker-based parsing (Worker Threads)
- Optional WASM acceleration inside workers (auto-initialized in main entry)
- Parallel processing with `ReusableWorkerPool`

## How to Run

```bash
# At the repository root (first time):
pnpm install
pnpm run build

# Run the Node example
cd examples/node-worker-main
pnpm install
pnpm start
```

## Notes

- Node.js does not require `workerURL`; the bundled worker path is resolved internally.
- Recommended Node.js: 20.6+ (WASM loader uses `import.meta.resolve` in Node).
- When using the slim entry (`web-csv-toolbox/slim`) or bundlers, call `loadWASM(wasmUrl)` before parsing if you enable WASM.

### Cleanup

- Prefer `pool.terminate()` for explicit cleanup. If your runtime supports the Explicit Resource Management proposal (`using`), you can also rely on automatic disposal; otherwise, call `terminate()` in `finally`.

### Alternative: Engine Presets

You can also use presets for simpler engine configuration:

```ts
import { parseString, EnginePresets, ReusableWorkerPool } from 'web-csv-toolbox';

const pool = new ReusableWorkerPool({ maxWorkers: 2 });
for await (const record of parseString(csv, {
  engine: EnginePresets.turbo({ workerPool: pool })
})) {
  // ...
}
pool.terminate();
```

### Expected Output (excerpt)

```
🚀 Node.js Worker (Main Version) Test
Features: Worker-based parsing with auto WASM initialization

⏳ Parsing with Worker (JavaScript engine, non-blocking)...
✅ Parsed Result (JavaScript):
[
  { "name": "Alice", "age": "30" },
  { "name": "Bob", "age": "25" },
  { "name": "Charlie", "age": "35" }
]
```
