# Node.js Worker (Main Version) Example

This example demonstrates Worker-based CSV parsing in Node.js using the main entry of `web-csv-toolbox`.

## Features

- Worker-based parsing (Worker Threads)
- Optional WASM acceleration inside workers (auto-initialized in main entry)
- Parallel processing with `ReusableWorkerPool`

## How to Run

```bash
# Build the library at the repository root
pnpm run build

# Run the Node example
cd examples/node-worker-main
pnpm install
pnpm start
```

## Notes

- Node.js does not require `workerURL`; the bundled worker path is resolved internally.
- When using the lite entry (`web-csv-toolbox/lite`) or bundlers, call `loadWASM()` with a `wasmUrl` before parsing if you enable WASM.

