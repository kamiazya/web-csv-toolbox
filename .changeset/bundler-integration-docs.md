---
web-csv-toolbox: patch
---

Add bundler integration guide for Workers and WebAssembly

This release adds comprehensive documentation for using web-csv-toolbox with modern JavaScript bundlers (Vite, Webpack, Rollup) when using Worker-based or WebAssembly execution.

**Package Structure Improvements:**

- Moved worker files to root level for cleaner package exports
  - `src/execution/worker/helpers/worker.{node,web}.ts` → `src/worker.{node,web}.ts`
- Added `./worker` export with environment-specific resolution (node/browser/default)
- Added `./web_csv_toolbox_wasm_bg.wasm` export for explicit WASM file access
- Updated internal relative paths in `createWorker.{node,web}.ts` to reflect new structure

**New Documentation:**

- **How-to Guide: Use with Bundlers** - Step-by-step configuration for Vite, Webpack, and Rollup
  - Worker configuration with `?url` imports
  - WASM configuration with explicit URL handling
  - WorkerPool reuse patterns
  - Common issues and troubleshooting

- **Explanation: Package Exports** - Deep dive into environment detection mechanism
  - Conditional exports for node/browser environments
  - Worker implementation differences
  - Bundler compatibility

- **Reference: Package Exports** - API reference for all package exports
  - Export paths and their resolutions
  - Conditional export conditions

**Updated Documentation:**

Added bundler usage notes to all Worker and WASM-related documentation:
- `README.md`
- `docs/explanation/execution-strategies.md`
- `docs/explanation/worker-pool-architecture.md`
- `docs/how-to-guides/choosing-the-right-api.md`
- `docs/how-to-guides/wasm-performance-optimization.md`

**Key Differences: Workers vs WASM with Bundlers**

**Workers** 🟢:
- Bundled automatically as data URLs using `?url` suffix
- Works out of the box with Vite
- Example: `import workerUrl from 'web-csv-toolbox/worker?url'`

**WASM** 🟡:
- Requires explicit URL configuration via `?url` import
- Must call `loadWASM(wasmUrl)` before parsing
- Example: `import wasmUrl from 'web-csv-toolbox/web_csv_toolbox_wasm_bg.wasm?url'`
- Alternative: Copy WASM file to public directory

**Migration Guide:**

For users already using Workers with bundlers, no changes are required. The package now explicitly documents the `workerURL` option that was previously implicit.

For new users, follow the bundler integration guide:
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';
import workerUrl from 'web-csv-toolbox/worker?url'; // Vite

for await (const record of parseString(csv, {
  engine: EnginePresets.worker({ workerURL: workerUrl })
})) {
  console.log(record);
}
```

**Breaking Changes:**

None - this is purely additive documentation and package export improvements. Existing code continues to work without modifications.
