---
"web-csv-toolbox": minor
---

refactor!: rename engine presets to clarify optimization targets

This release improves the naming of engine presets to clearly indicate what each preset optimizes for. The new names focus on performance characteristics (stability, UI responsiveness, parse speed, memory efficiency) rather than implementation details.

## Breaking Changes

### Engine Preset Renaming

Engine presets have been renamed to better communicate their optimization targets:

```diff
- import { EnginePresets } from 'web-csv-toolbox';
+ import { EnginePresets } from 'web-csv-toolbox';

- engine: EnginePresets.mainThread()
+ engine: EnginePresets.stable()

- engine: EnginePresets.worker()
+ engine: EnginePresets.responsive()

- engine: EnginePresets.workerStreamTransfer()
+ engine: EnginePresets.memoryEfficient()

- engine: EnginePresets.wasm()
+ engine: EnginePresets.fast()

- engine: EnginePresets.workerWasm()
+ engine: EnginePresets.responsiveFast()
```

**Optimization targets:**

| Preset | Optimizes For |
|--------|---------------|
| `stable()` | Stability (uses only standard JavaScript APIs) |
| `responsive()` | UI responsiveness (non-blocking) |
| `memoryEfficient()` | Memory efficiency (zero-copy streams) |
| `fast()` | Parse speed (fastest execution time) |
| `responsiveFast()` | UI responsiveness + parse speed |
| `balanced()` | Balanced (general-purpose) |

### Removed Presets

Two presets have been removed:

```diff
- engine: EnginePresets.fastest()
+ engine: EnginePresets.responsiveFast()

- engine: EnginePresets.strict()
  // No replacement - limited use case
```

**Why removed:**
- `fastest()`: Misleading name - prioritized UI responsiveness over raw execution speed due to worker communication overhead
- `strict()`: Limited use case - primarily for testing/debugging

## Improvements

### Clearer Performance Documentation

Each preset now explicitly documents its performance characteristics:

- **Parse speed**: How fast CSV parsing executes
- **UI responsiveness**: Whether parsing blocks the main thread
- **Memory efficiency**: Memory usage patterns
- **Stability**: API stability level (Most Stable, Stable, Experimental)

### Trade-offs Transparency

Documentation now clearly explains the trade-offs for each preset:

```typescript
// stable() - Most stable, blocks main thread
// ✅ Most stable: Uses only standard JavaScript APIs
// ✅ No worker communication overhead
// ❌ Blocks main thread during parsing

// responsive() - Non-blocking, stable
// ✅ Non-blocking UI: Parsing runs in worker thread
// ⚠️ Worker communication overhead

// fast() - Fastest parse speed, blocks main thread
// ✅ Fast parse speed: Compiled WASM code
// ✅ No worker communication overhead
// ❌ Blocks main thread
// ❌ UTF-8 encoding only

// responsiveFast() - Non-blocking + fast, stable
// ✅ Non-blocking UI + fast parsing
// ⚠️ Worker communication overhead
// ❌ UTF-8 encoding only
```

## Migration Guide

### Quick Migration

Replace old preset names with new names:

1. **`mainThread()` → `stable()`** - If you need maximum stability
2. **`worker()` → `responsive()`** - If you need non-blocking UI
3. **`workerStreamTransfer()` → `memoryEfficient()`** - If you need memory efficiency
4. **`wasm()` → `fast()`** - If you need fastest parse speed (and blocking is acceptable)
5. **`workerWasm()` → `responsiveFast()`** - If you need non-blocking UI + fast parsing
6. **`fastest()` → `responsiveFast()`** - Despite the name, this is the correct replacement
7. **`strict()` → Remove** - Or use custom config with `strict: true`

### Choosing the Right Preset

**By priority:**

- **Stability first**: `stable()` - Most stable, uses only standard JavaScript APIs
- **UI responsiveness first**: `responsive()` or `balanced()` - Non-blocking execution
- **Parse speed first**: `fast()` - Fastest execution time (blocks main thread)
- **General-purpose**: `balanced()` - Balanced performance characteristics

**By use case:**

- **Server-side parsing**: `stable()` or `fast()` - Blocking acceptable
- **Browser with interactive UI**: `responsive()` or `balanced()` - Non-blocking required
- **UTF-8 files only**: `fast()` or `responsiveFast()` - WASM acceleration
- **Streaming large files**: `memoryEfficient()` or `balanced()` - Constant memory usage

### Example Migration

**Before:**

```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

// Old: Unclear what "fastest" optimizes for
for await (const record of parseString(csv, {
  engine: EnginePresets.fastest()
})) {
  console.log(record);
}
```

**After:**

```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

// New: Clear that this optimizes for UI responsiveness + parse speed
for await (const record of parseString(csv, {
  engine: EnginePresets.responsiveFast()
})) {
  console.log(record);
}
```

## Documentation Updates

All documentation has been updated to reflect the new preset names and include detailed performance characteristics, trade-offs, and use case guidance.

See the [Engine Presets Reference](https://github.com/kamiazya/web-csv-toolbox/blob/main/docs/reference/engine-presets.md) for complete documentation.
