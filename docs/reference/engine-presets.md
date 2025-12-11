---
title: Engine Presets Reference
group: Reference
---

# Engine Presets Reference

Pre-configured engine settings for common use cases.

## Overview

Engine presets provide convenient configurations that combine worker execution, GPU acceleration, and streaming strategies for optimal performance in different scenarios.

**All presets are functions** that optionally accept configuration options like `workerPool`, `workerURL`, `arrayBufferThreshold`, `backpressureCheckInterval`, `queuingStrategy`, `optimizationHint`, and `onFallback`.

**Each preset is optimized for specific performance characteristics:**
- Parse speed (execution time)
- UI responsiveness (non-blocking)
- Memory efficiency
- Stability

**Basic usage:**
```typescript
engine: EnginePresets.recommended()
```

**With WorkerPool:**
```typescript
import { ReusableWorkerPool } from 'web-csv-toolbox';
const pool = new ReusableWorkerPool({ maxWorkers: 4 });
engine: EnginePresets.recommended({ workerPool: pool })
```

**With OptimizationHint:**
```typescript
engine: EnginePresets.recommended({
  optimizationHint: 'speed'  // Fine-tune execution path selection
})
```

## Quick Reference

| Preset | Optimization Target | Worker | GPU | Strategy | Stability |
|--------|---------------------|--------|-----|----------|-----------|
| `stable` | Stability | ❌ | ❌ | - | ⭐ Most Stable |
| `recommended` | Balanced (general-purpose) | ✅ | ❌ | stream-transfer | ✅ Stable |
| `turbo` | Maximum throughput | ❌ | ✅ | - | ✅ Stable |

## Available Presets

### `EnginePresets.stable()`

```typescript
{
  worker: false,
  wasm: false,
  optimizationHint: "responsive"
}
```

**Description:** Most stable configuration using only standard JavaScript APIs.

**Optimization target:** Stability

**Performance characteristics:**
- Parse speed: Standard (JavaScript execution)
- UI responsiveness: ❌ Blocks main thread
- Memory efficiency: Standard
- Stability: ⭐ Most stable (standard JavaScript APIs only)

**Trade-offs:**
- ✅ Most stable: Uses only standard JavaScript APIs
- ✅ No worker initialization overhead
- ✅ No worker communication overhead
- ✅ Supports WHATWG Encoding Standard encodings (via TextDecoder)
- ✅ Supports all quotation characters
- ✅ Works everywhere without configuration
- ❌ Blocks main thread during parsing

**Use when:**
- Stability is the highest priority
- UI blocking is acceptable
- Server-side parsing
- Maximum compatibility required

**Example:**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

for await (const record of parseString(csv, {
  engine: EnginePresets.stable()
})) {
  console.log(record);
}
```

**With OptimizationHint:**
```typescript
// Override default 'responsive' hint for speed
for await (const record of parseString(csv, {
  engine: EnginePresets.stable({
    optimizationHint: 'speed'
  })
})) {
  console.log(record);
}
```

---

### `EnginePresets.recommended()`

```typescript
{
  worker: true,
  wasm: false,
  workerStrategy: "stream-transfer",
  optimizationHint: "balanced"
}
```

**Description:** Balanced configuration for general-purpose CSV processing.

**Optimization target:** Balanced (UI responsiveness + memory efficiency + broad compatibility)

**Performance characteristics:**
- Parse speed: Moderate (worker communication overhead)
- UI responsiveness: ✅ Non-blocking (worker execution)
- Memory efficiency: ✅ Optimized (zero-copy stream transfer when supported)
- Stability: ✅ Stable (automatic fallback to message-streaming on Safari)

**Trade-offs:**
- ✅ Non-blocking UI: Parsing runs in worker thread
- ✅ Memory efficient: Zero-copy stream transfer when supported
- ✅ Supports WHATWG Encoding Standard encodings (via TextDecoder)
- ✅ Supports all quotation characters
- ✅ Automatic fallback to message-streaming on Safari
- ✅ Broad compatibility: Handles user uploads with various encodings
- ✅ Stable: Uses standard Web Workers API
- ⚠️ Worker communication overhead: Data transfer between threads

**Use when:**
- General-purpose CSV processing
- Broad encoding support required
- Safari compatibility needed (auto-fallback)
- User-uploaded files with various encodings
- Browser applications with interactive UI

**Example:**
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
    // Process securely...
  }
});
```

**Example with Custom Blob Reading Threshold:**
```typescript
import { parseBlob, EnginePresets } from 'web-csv-toolbox';

// Optimize for small files: always use arrayBuffer up to 512KB
const config = EnginePresets.recommended({
  arrayBufferThreshold: 512 * 1024  // 512KB
});

for await (const record of parseBlob(file, {
  engine: config
})) {
  console.log(record);
}
```

**Example with OptimizationHint:**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

// Override default 'balanced' hint for maximum speed
for await (const record of parseString(csv, {
  engine: EnginePresets.recommended({
    optimizationHint: 'speed'  // GPU > WASM > JS priority
  })
})) {
  console.log(record);
}
```

**Example with Advanced Performance Tuning (Experimental):**
```typescript
import { parseBlob, EnginePresets } from 'web-csv-toolbox';

// Configuration tuned for potential high-throughput scenarios
const config = EnginePresets.recommended({
  arrayBufferThreshold: 2 * 1024 * 1024,  // 2MB
  backpressureCheckInterval: {
    lexer: 200,      // Check every 200 tokens (less frequent checks)
    assembler: 20    // Check every 20 records (less frequent checks)
  },
  queuingStrategy: {
    // Tune entire pipeline with larger buffers
    lexerWritable: new CountQueuingStrategy({ highWaterMark: 200 }),
    lexerReadable: new CountQueuingStrategy({ highWaterMark: 100 }),
    assemblerWritable: new CountQueuingStrategy({ highWaterMark: 100 }),
    assemblerReadable: new CountQueuingStrategy({ highWaterMark: 50 })
  }
});

for await (const record of parseBlob(file, {
  engine: config
})) {
  console.log(record);
}
```

---

### `EnginePresets.turbo()`

```typescript
{
  worker: false,
  wasm: false,
  gpu: true,
  optimizationHint: "speed"
}
```

**Description:** Maximum performance configuration with GPU acceleration.

**Optimization target:** Maximum throughput (parse speed)

**Performance characteristics:**
- Parse speed: ✅ Fastest (GPU acceleration with WASM/JS fallback)
- UI responsiveness: ❌ Blocks main thread
- Memory efficiency: Standard
- Stability: ✅ Stable (automatic fallback chain: GPU → WASM → JS)

**Trade-offs:**
- ✅ Maximum throughput: GPU acceleration when available
- ✅ Automatic fallback: GPU → WASM → JS
- ✅ No worker overhead: Runs on main thread
- ✅ Reliable: Falls back to stable implementations if GPU unavailable
- ❌ Blocks main thread during parsing
- ❌ GPU acceleration requires WebGPU support
- ⚠️ GPU implementation may evolve in future versions

**Use when:**
- Maximum throughput is critical
- UI blocking is acceptable
- Server-side parsing with GPU available
- Large datasets requiring fast processing

**Automatic Fallback Chain:**
1. **GPU** (if WebGPU available)
2. **WASM** (if GPU unavailable)
3. **JavaScript** (if WASM unavailable)

**Example:**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

// GPU auto-initializes on first use
for await (const record of parseString(csv, {
  engine: EnginePresets.turbo()
})) {
  console.log(record);
}
```

**Example with OptimizationHint:**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

// Override default 'speed' hint for consistent performance
for await (const record of parseString(csv, {
  engine: EnginePresets.turbo({
    optimizationHint: 'consistency'  // WASM > JS > GPU priority
  })
})) {
  console.log(record);
}
```

**Example with Fallback Tracking:**
```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

for await (const record of parseString(csv, {
  engine: EnginePresets.turbo({
    onFallback: (info) => {
      console.log('Fallback occurred:', info.reason);
      console.log('Using:', info.actualConfig);
    }
  })
})) {
  console.log(record);
}
```

---

## Optimization Hints

All presets support the `optimizationHint` option for fine-grained control over execution path selection.

### Available Hints

- **`speed`**: Maximize throughput (GPU > WASM > JS, main thread preferred)
- **`consistency`**: Predictable performance (WASM > JS > GPU, main thread preferred)
- **`balanced`**: Balance speed and responsiveness (JS > WASM > GPU, worker preferred)
- **`responsive`**: Minimize initial response time (JS > WASM > GPU, worker preferred)

### Default Hints by Preset

| Preset | Default Hint | Rationale |
|--------|--------------|-----------|
| `stable` | `responsive` | Fast initialization, no GPU overhead |
| `recommended` | `balanced` | Balance all performance characteristics |
| `turbo` | `speed` | Maximum throughput with GPU |

### Backend Priority

| Hint | Backend Priority | Use Case |
|------|-----------------|----------|
| `speed` | GPU > WASM > JS | Maximum throughput |
| `consistency` | WASM > JS > GPU | Predictable performance |
| `balanced` | JS > WASM > GPU | General-purpose |
| `responsive` | JS > WASM > GPU | Fast initialization |

### Context Priority

| Hint | Context Priority | Use Case |
|------|-----------------|----------|
| `speed` | main > worker-stream-transfer > worker-message | Lowest overhead |
| `consistency` | main > worker-stream-transfer > worker-message | Simpler execution |
| `balanced` | worker-stream-transfer > main > worker-message | Balance responsiveness |
| `responsive` | worker-stream-transfer > worker-message > main | Keep UI responsive |

### GPU Configuration

| Hint | Workgroup Size | Device Preference |
|------|----------------|-------------------|
| `speed` | 128 | high-performance |
| `consistency` | 64 | low-power |
| `balanced` | 64 | balanced |
| `responsive` | 64 | balanced |

### Usage Examples

**Override default hint:**
```typescript
// stable() with speed optimization
EnginePresets.stable({
  optimizationHint: 'speed'
})

// recommended() with responsive optimization
EnginePresets.recommended({
  optimizationHint: 'responsive'
})

// turbo() with consistency optimization
EnginePresets.turbo({
  optimizationHint: 'consistency'
})
```

**Combine with other options:**
```typescript
EnginePresets.recommended({
  optimizationHint: 'speed',
  workerPool: pool,
  arrayBufferThreshold: 2 * 1024 * 1024
})
```

---

## Decision Guide

### By Optimization Priority

Choose the preset that matches your primary optimization goal:

- **Stability:** `stable()` ⭐
  - Most stable: Uses only standard JavaScript APIs
  - WHATWG Encoding Standard encodings and all quotation characters
  - Works everywhere without configuration
  - Accept main thread blocking

- **Balanced (Recommended):** `recommended()`
  - General-purpose CSV processing
  - Non-blocking UI with worker execution
  - Memory efficient with stream-transfer strategy
  - Automatic Safari fallback

- **Maximum Performance:** `turbo()`
  - GPU acceleration for maximum throughput
  - Automatic fallback chain (GPU → WASM → JS)
  - Accept main thread blocking

### By Use Case

- **General-purpose CSV processing:** `recommended()`
  - Balanced performance characteristics
  - WHATWG Encoding Standard encodings supported
  - Automatic Safari fallback
  - ✅ Uses stable APIs

- **Maximum stability required:** `stable()`
  - Uses only standard JavaScript APIs
  - WHATWG Encoding Standard encodings
  - Accept main thread blocking

- **Browser with interactive UI:** `recommended()`
  - ✅ Stable, WHATWG Encoding Standard encodings
  - Non-blocking worker execution
  - Memory efficient streaming

- **Server-side parsing:** `stable()` or `turbo()`
  - `stable()`: ⭐ Most stable, WHATWG Encoding Standard encodings
  - `turbo()`: ✅ Maximum throughput with GPU

- **Large datasets (> 10MB):** `turbo()`
  - GPU acceleration for best performance
  - Automatic fallback to WASM/JS
  - Accept main thread blocking for maximum speed

- **Streaming large files:** `recommended()`
  - Zero-copy streams when supported
  - Constant memory usage
  - ✅ Stable with automatic fallback

### By Environment

- **Browser (UI-critical):** `recommended()`
  - Non-blocking UI
  - WHATWG Encoding Standard encodings
  - ✅ Stable with automatic fallback

- **Browser (Performance-critical):** `turbo()`
  - GPU acceleration for maximum throughput
  - Automatic fallback chain
  - Accept main thread blocking

- **Server-side:** `stable()` or `turbo()`
  - No worker overhead
  - Blocking acceptable
  - `stable()`: ⭐ Most stable, WHATWG Encoding Standard encodings
  - `turbo()`: ✅ GPU acceleration for throughput

- **Safari required:** `recommended()`
  - ✅ Stable, automatic fallback to message-streaming
  - Non-blocking execution

- **Chrome/Firefox/Edge only:** `recommended()` or `turbo()`
  - `recommended()`: Zero-copy stream transfer
  - `turbo()`: GPU acceleration for best performance

**Note:** Choose execution strategy based on your requirements (stability, blocking vs non-blocking, parse speed, memory efficiency, encoding support) rather than file size alone. Benchmark your specific use case to determine the best approach.

---

## Preset Options

All presets accept the following optional parameters:

### `optimizationHint`

**Type:** `'speed' | 'consistency' | 'balanced' | 'responsive'`
**Default:** Varies by preset

Fine-tune execution path selection. See [Optimization Hints](#optimization-hints) for details.

### `workerPool`

**Type:** `WorkerPool`
**Default:** Shared singleton pool

Specify a custom WorkerPool for managing worker lifecycle.

**Example:**
```typescript
import { ReusableWorkerPool } from 'web-csv-toolbox';

const pool = new ReusableWorkerPool({ maxWorkers: 4 });

EnginePresets.recommended({ workerPool: pool })
```

### `workerURL`

**Type:** `string | URL`
**Default:** Bundled worker script

Specify a custom worker script URL (browser only).

### `arrayBufferThreshold`

**Type:** `number` (bytes)
**Default:** `1048576` (1MB)

Controls Blob reading strategy for `parseBlob()` and `parseFile()`.

### `backpressureCheckInterval` 🧪

**Type:** `{ lexer?: number; assembler?: number }`
**Default:** `{ lexer: 100, assembler: 10 }`
**Status:** Experimental

Controls backpressure checking frequency.

### `queuingStrategy` 🧪

**Type:** `object`
**Status:** Experimental

Controls internal queuing behavior of the streaming pipeline.

### `onFallback`

**Type:** `(info: EngineFallbackInfo) => void`

Callback invoked when automatic fallback occurs.

**Example:**
```typescript
EnginePresets.turbo({
  onFallback: (info) => {
    console.log('Fallback reason:', info.reason);
    console.log('Using config:', info.actualConfig);
  }
})
```

---

## Migration from v1

If you're migrating from the previous 7-preset system, see **[EnginePresets v2 Migration Guide](../migration-guides/engine-presets-v2.md)** for detailed migration instructions.

**Quick mapping:**
- `responsive()` / `memoryEfficient()` / `balanced()` → `recommended()`
- `fast()` / `responsiveFast()` / `gpuAccelerated()` → `turbo()`
- `stable()` → `stable()` (no change)

---

## Related Documentation

- **[Engine Config Reference](./engine-config.md)** - Detailed configuration options
- **[Execution Strategies](../explanation/execution-strategies.md)** - Understanding execution paths
- **[How-To: Secure CSV Processing](../how-to-guides/secure-csv-processing.md)** - Using presets securely
- **[Migration Guide](../migration-guides/engine-presets-v2.md)** - Migrating from v1

For advanced configuration options beyond presets, refer to the [`EngineConfig`](https://kamiazya.github.io/web-csv-toolbox/interfaces/EngineConfig.html) type documentation in your IDE or the [API Reference](https://kamiazya.github.io/web-csv-toolbox/).
