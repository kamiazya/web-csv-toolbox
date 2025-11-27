---
title: Engine Presets Reference
group: Reference
---

# Engine Presets Reference

Pre-configured engine settings for common use cases.

## Overview

Engine presets provide convenient configurations that combine worker execution, WASM acceleration, GPU acceleration, and streaming strategies for optimal performance in different scenarios.

**Three Simple Presets:**

| Preset | Backend Priority | Context | Use Case |
|--------|------------------|---------|----------|
| `stable()` | JS | Main thread | Maximum compatibility, server-side |
| `recommended()` | WASM > JS | Worker | UI responsiveness + performance (default) |
| `turbo()` | GPU > WASM > JS | Main thread | Maximum speed (>10MB files) |

**All presets are functions** that optionally accept configuration options like `workerPool`, `workerURL`, `arrayBufferThreshold`, `backpressureCheckInterval`, `queuingStrategy`, `optimizationHint`, and `onFallback`.

**Basic usage:**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

// Recommended for most browser applications
for await (const record of parseString(csv, {
  engine: EnginePresets.recommended()
})) {
  console.log(record);
}
```

**With WorkerPool:**
```typescript
import { ReusableWorkerPool } from 'web-csv-toolbox';
const pool = new ReusableWorkerPool({ maxWorkers: 4 });
engine: EnginePresets.recommended({ workerPool: pool })
```

**With fallback tracking:**
```typescript
engine: EnginePresets.turbo({
  onFallback: (info) => console.warn(`Fallback: ${info.reason}`)
})
```

## Quick Reference

| Preset | Backend | Context | Worker | WASM | GPU | Default Hint |
|--------|---------|---------|--------|------|-----|--------------|
| `stable()` | JS only | Main thread | - | - | - | `responsive` |
| `recommended()` | WASM > JS | Worker | Yes | Yes | - | `balanced` |
| `turbo()` | GPU > WASM > JS | Main thread | - | Yes | Yes | `speed` |

## Available Presets

### `EnginePresets.stable()`

```typescript
{
  worker: false,
  wasm: false,
  gpu: false,
  optimizationHint: "responsive"
}
```

**Description:** Maximum compatibility configuration using only standard JavaScript APIs.

**Backend:** JS
**Context:** Main thread

**Performance characteristics:**
- Parse speed: Standard (JavaScript execution)
- UI responsiveness: Blocks main thread
- Memory efficiency: Standard
- Stability: Most stable (standard JavaScript APIs only)

**Trade-offs:**
- Works everywhere without configuration
- Supports WHATWG Encoding Standard encodings (via TextDecoder)
- Supports all quotation characters
- No worker/WASM initialization overhead
- Blocks main thread during parsing

**Use when:**
- Server-side parsing (Node.js, Deno)
- Maximum compatibility required
- UI blocking is acceptable
- Non-UTF-8 encodings needed

**Example:**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

for await (const record of parseString(csv, {
  engine: EnginePresets.stable()
})) {
  console.log(record);
}
```

---

### `EnginePresets.recommended()`

```typescript
{
  worker: true,
  wasm: true,
  gpu: false,
  workerStrategy: "stream-transfer",
  optimizationHint: "balanced"
}
```

**Description:** Balanced configuration for browser applications. Uses WASM for speed and Worker for non-blocking UI. Automatically falls back when features are unavailable.

**Backend:** WASM > JS
**Context:** Worker (with stream-transfer) > Main (fallback)

**Performance characteristics:**
- Parse speed: Fast (WASM acceleration when available)
- UI responsiveness: Non-blocking (worker execution)
- Memory efficiency: Optimized (zero-copy stream transfer when supported)
- Stability: Stable with automatic fallback

**Trade-offs:**
- Non-blocking UI: Parsing runs in worker thread
- Fast parsing: WASM acceleration when UTF-8
- Memory efficient: Zero-copy stream transfer when supported
- Automatic fallback to message-streaming on Safari
- Requires bundler configuration for worker URL

**Use when:**
- Browser applications (recommended default)
- UI responsiveness is important
- Good performance without blocking

**Example:**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

// Recommended for most browser applications
for await (const record of parseString(csv, {
  engine: EnginePresets.recommended()
})) {
  console.log(record);
  // UI stays responsive!
}
```

**Example with WorkerPool:**
```typescript
import { parseStringStream, EnginePresets, ReusableWorkerPool } from 'web-csv-toolbox';

const pool = new ReusableWorkerPool({ maxWorkers: 4 });

app.post('/validate-csv', async (c) => {
  if (pool.isFull()) {
    return c.json({ error: 'Service busy' }, 503);
  }

  const csvStream = c.req.raw.body?.pipeThrough(new TextDecoderStream());

  for await (const record of parseStringStream(csvStream, {
    engine: EnginePresets.recommended({ workerPool: pool })
  })) {
    // Process records...
  }
});
```

---

### `EnginePresets.turbo()`

```typescript
{
  worker: false,
  wasm: true,
  gpu: true,
  optimizationHint: "speed"
}
```

**Description:** Maximum speed configuration. Uses GPU acceleration when available, with WASM and JS fallbacks. Runs on main thread for maximum throughput.

**Backend:** GPU > WASM > JS
**Context:** Main thread

**Performance characteristics:**
- Parse speed: Maximum (GPU acceleration when available)
- UI responsiveness: Blocks main thread
- Memory efficiency: Standard
- Stability: Stable with automatic fallback

**Trade-offs:**
- Maximum throughput: GPU acceleration when available
- Automatic fallback: WASM > JS when GPU unavailable
- No worker communication overhead
- Blocks main thread during parsing
- GPU: WebGPU required (Chrome 113+, experimental)

**Use when:**
- Processing large CSV files (>10MB)
- Maximum throughput is critical
- UI blocking is acceptable
- Batch processing scenarios

**Example:**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

// Maximum speed for large files
for await (const record of parseString(csv, {
  engine: EnginePresets.turbo({
    onFallback: (info) => console.warn(`Fallback: ${info.reason}`)
  })
})) {
  console.log(record);
}
```

---

## Deprecated Aliases

The following preset names are deprecated but still available for backward compatibility:

| Deprecated Name | Maps To | Notes |
|-----------------|---------|-------|
| `balanced()` | `recommended()` | Use `recommended()` instead |
| `responsive()` | `recommended()` | Use `recommended()` instead |
| `memoryEfficient()` | `recommended()` | Use `recommended()` instead |
| `fast()` | `turbo()` | Use `turbo()` instead |
| `responsiveFast()` | `turbo()` | Use `turbo()` instead |
| `gpuAccelerated()` | `turbo()` | Use `turbo()` instead |
| `ultraFast()` | `turbo()` | Use `turbo()` instead |

**Migration example:**
```typescript
// Before (deprecated)
engine: EnginePresets.balanced()
engine: EnginePresets.responsiveFast()

// After (recommended)
engine: EnginePresets.recommended()
engine: EnginePresets.turbo()
```

---

## Decision Guide

### By Priority

| Priority | Recommended Preset |
|----------|-------------------|
| Maximum compatibility | `stable()` |
| UI responsiveness + performance | `recommended()` |
| Maximum speed | `turbo()` |

### By Environment

| Environment | Recommended Preset |
|-------------|-------------------|
| Browser (general) | `recommended()` |
| Browser (large files, blocking OK) | `turbo()` |
| Server-side (Node.js/Deno) | `stable()` |
| Safari required | `recommended()` (auto-fallback) |

### By Use Case

| Use Case | Recommended Preset |
|----------|-------------------|
| Interactive web application | `recommended()` |
| Batch processing | `turbo()` |
| File upload validation | `recommended()` |
| CLI tool | `stable()` or `turbo()` |
| API server | `stable()` |

---

## Preset Options

All presets accept the following options:

### Common Options (`PresetOptions`)

| Option | Type | Description |
|--------|------|-------------|
| `arrayBufferThreshold` | `number` | Blob reading strategy threshold (default: 1MB) |
| `backpressureCheckInterval` | `{ lexer: number, assembler: number }` | Backpressure monitoring intervals |
| `queuingStrategy` | `QueuingStrategyConfig` | Internal streaming queuing strategies |
| `optimizationHint` | `OptimizationHint` | Override the preset's default hint |
| `onFallback` | `(info: EngineFallbackInfo) => void` | Callback when fallback occurs |

### Worker Options (`WorkerPresetOptions`)

Available for `recommended()`:

| Option | Type | Description |
|--------|------|-------------|
| `workerPool` | `WorkerPool` | Worker pool for managing worker lifecycle |
| `workerURL` | `string \| URL` | Custom worker URL |

**Example with options:**
```typescript
import { parseBlob, EnginePresets } from 'web-csv-toolbox';

const config = EnginePresets.recommended({
  arrayBufferThreshold: 512 * 1024,  // 512KB
  onFallback: (info) => {
    console.warn(`Fallback occurred: ${info.reason}`);
  }
});

for await (const record of parseBlob(file, { engine: config })) {
  console.log(record);
}
```

---

## Related Documentation

- **[Execution Strategies](../explanation/execution-strategies.md)** - Understanding how strategies work
- **[How-To: Secure CSV Processing](../how-to-guides/secure-csv-processing.md)** - Using presets securely
- **[Using with Bundlers](../how-to-guides/using-with-bundlers.md)** - Bundler configuration for workers

For advanced configuration options beyond presets, refer to the [`EngineConfig`](https://kamiazya.github.io/web-csv-toolbox/interfaces/EngineConfig.html) type documentation in your IDE or the [API Reference](https://kamiazya.github.io/web-csv-toolbox/).
