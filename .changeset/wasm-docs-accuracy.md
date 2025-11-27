---
"web-csv-toolbox": minor
---

feat: add engine option to factory functions, improve WASM validation

## New Features

### Factory Functions with Engine Option

Factory functions now accept an `engine` option to switch between JavaScript and WASM implementations:

```typescript
import { createStringCSVParser, createBinaryCSVParser } from 'web-csv-toolbox';

// Use WASM parser
const wasmParser = createStringCSVParser({
  header: ['name', 'age'] as const,
  engine: { wasm: true }
});

// Use JavaScript parser (default)
const jsParser = createStringCSVParser({
  header: ['name', 'age'] as const,
  engine: { wasm: false }
});
```

New types added:
- `FactoryEngineConfig` - Engine configuration for factories (wasm only, no worker support)
- `FactoryEngineOptions` - Options interface with engine property

Supported factory functions:
- `createStringCSVParser()` - Full JS/WASM switching
- `createBinaryCSVParser()` - Full JS/WASM switching with charset validation
- `createStringCSVLexer()` - Accepts engine option (future extensibility)
- `createCSVRecordAssembler()` - Accepts engine option (future extensibility)

## Breaking Type Changes

### `WorkerEngineConfig` Split into Discriminated Union

`WorkerEngineConfig` is now a union of three types that enforce mutual exclusivity between `workerURL` and `workerPool`:

- **`WorkerEngineConfigWithURL`**: Use custom worker URL (no pool)
- **`WorkerEngineConfigWithPool`**: Use worker pool (configure workerURL in pool)
- **`WorkerEngineConfigDefault`**: Use default bundled worker (neither URL nor pool)

```typescript
// ✅ Valid: workerURL only
{ worker: true, workerURL: '/worker.js' }

// ✅ Valid: workerPool only
{ worker: true, workerPool: pool }

// ✅ Valid: neither (default)
{ worker: true }

// ❌ Type Error: cannot have both
{ worker: true, workerURL: '/worker.js', workerPool: pool }
```

### `WorkerPresetOptions` Updated Similarly

`EnginePresets.responsive()`, `responsiveFast()`, `memoryEfficient()`, and `balanced()` now enforce the same mutual exclusivity.

## Bug Fixes

### WASM Validation for Multi-byte UTF-8 Characters

Fixed validation to reject multi-byte UTF-8 characters for delimiter/quotation in WASM mode:

```typescript
// ❌ Now throws RangeError (previously accepted incorrectly)
createStringCSVParser({
  delimiter: '、',  // Japanese comma - 1 char in JS but 3 bytes in UTF-8
  engine: { wasm: true }
});
// Error: Delimiter must be a single-byte ASCII character (code point < 128)
```

WASM parser constraints are now correctly enforced:
- **Both JS and WASM**: Single-character delimiter/quotation only (no multi-character)
- **WASM only**: Single-byte ASCII (code point < 128) required
- **JS only**: Any single Unicode character supported (including multi-byte UTF-8)

## Documentation Fixes

Updated documentation to accurately reflect delimiter/quotation constraints:

- Clarified that multi-character delimiters (e.g., `::`, `||`) are NOT supported by either parser
- Clarified that WASM requires single-byte ASCII delimiter/quotation
- Added examples showing valid and invalid delimiter usage

Files updated:
- `docs/explanation/webassembly-architecture.md`
- `docs/explanation/execution-strategies.md`
- `docs/explanation/main-vs-slim.md`
- `docs/reference/supported-environments.md`
- `docs/reference/engine-presets.md`
- `docs/reference/package-exports.md`
- `docs/how-to-guides/parse-csv-data.md`
- `docs/tutorials/using-webassembly.md`
- `README.md`

## New Examples

### Worker + WASM Bundler Setup
Added practical examples for combining Worker threads with WASM acceleration in README using `ReusableWorkerPool`:

```typescript
import { parse, loadWASM, ReusableWorkerPool } from "web-csv-toolbox";
import workerUrl from "web-csv-toolbox/worker?url";
import wasmUrl from "web-csv-toolbox/csv.wasm?url";

await loadWASM(wasmUrl);

using pool = new ReusableWorkerPool({ workerURL: workerUrl });

for await (const record of parse(csv, {
  engine: { worker: true, wasm: true, workerPool: pool }
})) {
  console.log(record);
}
```
