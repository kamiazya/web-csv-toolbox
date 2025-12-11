---
title: EnginePresets v2 Migration Guide
group: Migration Guides
---

# EnginePresets v2 Migration Guide

## Breaking Changes

The EnginePresets have been consolidated from 7 presets to 3 presets with a new optimization hint system for fine-grained control.

**This is a breaking change with no deprecation aliases.**

## Preset Mapping

| Old Preset | New Preset | Migration Notes |
|-----------|-----------|----------------|
| `stable()` | `stable()` | No change - same configuration |
| `responsive()` | `recommended()` | Worker + message-streaming |
| `memoryEfficient()` | `recommended()` | Worker + stream-transfer strategy |
| `fast()` | `turbo()` | Main thread + WASM + GPU |
| `responsiveFast()` | `turbo()` | Main thread + WASM + GPU |
| `balanced()` | `recommended()` | Default recommended configuration |
| `gpuAccelerated()` | `turbo()` | GPU → WASM → JS fallback chain |

## New Presets

### `stable()`

Most stable configuration using only standard JavaScript APIs.

```typescript
EnginePresets.stable()
// Equivalent to:
{
  worker: false,
  wasm: false,
  optimizationHint: "responsive"
}
```

**Use when:**
- Stability is the highest priority
- UI blocking is acceptable
- Server-side parsing
- Maximum compatibility required

**No changes from v1.**

### `recommended()`

Balanced configuration for general-purpose CSV processing.

```typescript
EnginePresets.recommended()
// Equivalent to:
{
  worker: true,
  wasm: false,  // JS is faster than WASM for most use cases
  workerStrategy: "stream-transfer",
  optimizationHint: "balanced"
}
```

**Replaces:**
- `responsive()` - Added stream-transfer strategy for better memory efficiency
- `memoryEfficient()` - Same configuration
- `balanced()` - Same configuration

**Use when:**
- General-purpose CSV processing
- Broad encoding support required
- Safari compatibility needed (auto-fallback)
- User-uploaded files with various encodings

### `turbo()`

Maximum performance configuration with GPU and WASM acceleration.

```typescript
EnginePresets.turbo()
// Equivalent to:
{
  worker: false,  // Main thread for zero overhead
  wasm: false,    // JS is faster than WASM for most use cases
  gpu: true,      // GPU acceleration when available
  optimizationHint: "speed"
}
```

**Replaces:**
- `fast()` - Added GPU support with fallback chain
- `responsiveFast()` - Simplified to main thread (no worker overhead)
- `gpuAccelerated()` - Same configuration

**Use when:**
- Maximum throughput is critical
- GPU is available
- Main thread blocking is acceptable

## Migration Examples

### Before (v1)

```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

// Balanced configuration
for await (const record of parseString(csv, {
  engine: EnginePresets.balanced()
})) {
  console.log(record);
}

// GPU accelerated
for await (const record of parseString(csv, {
  engine: EnginePresets.gpuAccelerated()
})) {
  console.log(record);
}
```

### After (v2)

```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

// Recommended configuration (replaces balanced)
for await (const record of parseString(csv, {
  engine: EnginePresets.recommended()
})) {
  console.log(record);
}

// Turbo configuration (replaces gpuAccelerated)
for await (const record of parseString(csv, {
  engine: EnginePresets.turbo()
})) {
  console.log(record);
}
```

## New Feature: OptimizationHint

The new `optimizationHint` option provides fine-grained control over execution path selection without changing the base preset configuration.

### Available Hints

- **`speed`**: Maximize throughput (GPU > WASM > JS, main thread preferred)
- **`consistency`**: Predictable performance (WASM > JS > GPU, main thread preferred)
- **`balanced`**: Balance speed and responsiveness (JS > WASM > GPU, worker preferred)
- **`responsive`**: Minimize initial response time (JS > WASM > GPU, worker preferred)

### Usage Examples

**Override preset hint for specific use case:**

```typescript
// Use recommended preset but optimize for speed
EnginePresets.recommended({
  optimizationHint: 'speed'  // Override default 'balanced'
})

// Use turbo preset but optimize for consistency
EnginePresets.turbo({
  optimizationHint: 'consistency'  // Override default 'speed'
})

// Use stable preset with speed optimization
EnginePresets.stable({
  optimizationHint: 'speed'  // Override default 'responsive'
})
```

**Backend priority by hint:**

| Hint | Backend Priority | Use Case |
|------|-----------------|----------|
| `speed` | GPU > WASM > JS | Maximum throughput |
| `consistency` | WASM > JS > GPU | Predictable performance |
| `balanced` | JS > WASM > GPU | General-purpose |
| `responsive` | JS > WASM > GPU | Fast initialization |

**Context priority by hint:**

| Hint | Context Priority | Use Case |
|------|-----------------|----------|
| `speed` | main > worker-stream-transfer > worker-message | Lowest overhead |
| `consistency` | main > worker-stream-transfer > worker-message | Simpler execution |
| `balanced` | worker-stream-transfer > main > worker-message | Balance responsiveness |
| `responsive` | worker-stream-transfer > worker-message > main | Keep UI responsive |

**GPU configuration by hint:**

| Hint | Workgroup Size | Device Preference |
|------|----------------|-------------------|
| `speed` | 128 | high-performance |
| `consistency` | 64 | low-power |
| `balanced` | 64 | balanced |
| `responsive` | 64 | balanced |

## Migration Checklist

1. **Search and Replace:**
   ```bash
   # Find all preset usages
   grep -r "EnginePresets\.\(balanced\|responsive\|memoryEfficient\|fast\|responsiveFast\|gpuAccelerated\)" src/
   ```

2. **Update Imports:**
   ```typescript
   // No changes needed - same import path
   import { EnginePresets } from 'web-csv-toolbox';
   ```

3. **Replace Preset Calls:**
   - `balanced()` → `recommended()`
   - `responsive()` → `recommended()`
   - `memoryEfficient()` → `recommended()`
   - `fast()` → `turbo()`
   - `responsiveFast()` → `turbo()`
   - `gpuAccelerated()` → `turbo()`

4. **Consider OptimizationHint:**
   - Evaluate if you need fine-grained control beyond the preset defaults
   - Add `optimizationHint` option if needed

5. **Test:**
   - Run existing tests to verify behavior
   - Check performance characteristics match expectations
   - Verify GPU/WASM initialization if using `turbo()`

## Detailed Migration Path

### Replacing `balanced()`

**Before:**
```typescript
EnginePresets.balanced()
```

**After:**
```typescript
EnginePresets.recommended()
// Same configuration: worker + stream-transfer strategy
```

### Replacing `responsive()`

**Before:**
```typescript
EnginePresets.responsive()
```

**After:**
```typescript
EnginePresets.recommended()
// Improved: now uses stream-transfer strategy (with auto-fallback)
```

### Replacing `memoryEfficient()`

**Before:**
```typescript
EnginePresets.memoryEfficient()
```

**After:**
```typescript
EnginePresets.recommended()
// Same configuration: worker + stream-transfer strategy
```

### Replacing `fast()`

**Before:**
```typescript
import { parseString, EnginePresets, loadWasm } from 'web-csv-toolbox';

await loadWasm();

for await (const record of parseString(csv, {
  engine: EnginePresets.fast()
})) {
  console.log(record);
}
```

**After:**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

// GPU provides better performance than WASM
// No need to call loadWasm() or loadGPU() - auto-initialized
for await (const record of parseString(csv, {
  engine: EnginePresets.turbo()
})) {
  console.log(record);
}
```

### Replacing `responsiveFast()`

**Before:**
```typescript
import { parseString, EnginePresets, loadWasm } from 'web-csv-toolbox';

await loadWasm();

for await (const record of parseString(csv, {
  engine: EnginePresets.responsiveFast()
})) {
  console.log(record);
}
```

**After:**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

// Turbo now focuses on maximum throughput with GPU
// Uses main thread for lowest overhead
for await (const record of parseString(csv, {
  engine: EnginePresets.turbo()
})) {
  console.log(record);
}
```

### Replacing `gpuAccelerated()`

**Before:**
```typescript
EnginePresets.gpuAccelerated()
```

**After:**
```typescript
EnginePresets.turbo()
// Same configuration: GPU with fallback chain
```

## Common Patterns

### Production Server with Worker Pool

**Before:**
```typescript
import { ReusableWorkerPool, EnginePresets } from 'web-csv-toolbox';

const pool = new ReusableWorkerPool({ maxWorkers: 4 });

const config = EnginePresets.balanced({
  workerPool: pool
});
```

**After:**
```typescript
import { ReusableWorkerPool, EnginePresets } from 'web-csv-toolbox';

const pool = new ReusableWorkerPool({ maxWorkers: 4 });

const config = EnginePresets.recommended({
  workerPool: pool
});
```

### Browser UI-Critical Applications

**Before:**
```typescript
// Option 1: responsive
EnginePresets.responsive()

// Option 2: balanced
EnginePresets.balanced()
```

**After:**
```typescript
// Single recommended preset handles both use cases
EnginePresets.recommended()
```

### Maximum Performance (UTF-8 only)

**Before:**
```typescript
import { loadWasm } from 'web-csv-toolbox';

await loadWasm();

// Option 1: fast
EnginePresets.fast()

// Option 2: responsiveFast
EnginePresets.responsiveFast()
```

**After:**
```typescript
// GPU provides better performance, no pre-loading needed
EnginePresets.turbo()
```

## Troubleshooting

### Runtime Errors

**Error: "EnginePresets.balanced is not a function"**

**Solution:** Replace with `EnginePresets.recommended()`.

**Error: "EnginePresets.responsive is not a function"**

**Solution:** Replace with `EnginePresets.recommended()`.

**Error: "EnginePresets.fast is not a function"**

**Solution:** Replace with `EnginePresets.turbo()`.

### Performance Issues

**Issue: Slower performance after migration**

**Solutions:**
1. Consider using `optimizationHint: 'speed'` for maximum throughput
2. Use `turbo()` preset if GPU is available
3. Check GPU/WASM initialization with `isGPUReady()` / `isWasmReady()`

**Issue: Higher memory usage**

**Solutions:**
1. Ensure `recommended()` preset is using stream-transfer strategy
2. Use `optimizationHint: 'balanced'` or `'responsive'` for worker contexts
3. Consider `arrayBufferThreshold: 0` for pure streaming

### Compatibility Issues

**Issue: Safari fallback not working**

**Solution:** `recommended()` preset already includes automatic fallback to message-streaming on Safari. No action needed.

**Issue: GPU not available**

**Solution:** `turbo()` preset automatically falls back to WASM → JS. Use `onFallback` callback to track fallbacks.

## FAQ

### Why were presets consolidated?

The 7 presets created confusion about which to use. The new 3-preset system with `optimizationHint` provides:
- Clearer decision making (stable, recommended, turbo)
- Fine-grained control via optimization hints
- Better performance through GPU acceleration
- Simplified maintenance and documentation

### Do I need to change my code immediately?

Yes, this is a breaking change with no deprecation period. The old presets are removed and will cause runtime errors if not updated.

### Can I achieve the same behavior as before?

Yes, using the preset mapping and `optimizationHint` option:

```typescript
// Old: responsive() - worker + message-streaming
// New: recommended() with hint override
EnginePresets.recommended({
  optimizationHint: 'responsive'
})

// Old: fast() - main thread + WASM
// New: turbo() with consistency hint
EnginePresets.turbo({
  optimizationHint: 'consistency'
})
```

### What if I need the exact old configuration?

Use custom `EngineConfig`:

```typescript
// Old: responsive() configuration
{
  worker: true,
  wasm: false,
  workerStrategy: 'message-streaming'
}

// Old: fast() configuration
{
  worker: false,
  wasm: true
}
```

### Is GPU acceleration always better?

GPU acceleration typically provides better performance for large datasets, but actual results depend on:
- Input size and complexity
- Available GPU hardware
- Browser/runtime environment

Benchmark your specific use case to determine optimal configuration.

## Related Documentation

- **[Engine Presets Reference](../reference/engine-presets.md)** - Complete preset documentation
- **[Engine Config Reference](../reference/engine-config.md)** - OptimizationHint details
- **[Execution Strategies](../explanation/execution-strategies.md)** - Understanding execution paths

## Need Help?

If you encounter issues during migration:
1. Check the [GitHub Issues](https://github.com/kamiazya/web-csv-toolbox/issues)
2. Review the [Examples](../../examples/) directory for updated code
3. Read the [API Reference](https://kamiazya.github.io/web-csv-toolbox/)
