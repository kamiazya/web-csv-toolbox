# GPU Acceleration Guide

WebGPU-accelerated CSV parsing provides significant performance improvements for large files through parallel GPU processing.

## Quick Start

```typescript
import { parseString } from 'web-csv-toolbox';

// Enable GPU acceleration
for await (const record of parseString(csv, {
  engine: { gpu: true }
})) {
  console.log(record);
}
```

## Performance Characteristics

### Throughput

| File Size | GPU Stream | CPU Stream | Speedup |
|-----------|------------|------------|---------|
| 10MB      | 12.1 MB/s  | 8.4 MB/s   | **1.44×** |
| 100MB     | 12.0 MB/s  | 8.3 MB/s   | **1.44×** |
| 500MB     | 12.1 MB/s  | 8.2 MB/s   | **1.48×** |
| 1GB       | 12.2 MB/s  | 8.1 MB/s   | **1.50×** |

**Conclusion**: GPU provides **consistent 1.44-1.50× speedup** over CPU streaming across all file sizes.

### When to Use GPU

✅ **Recommended**:
- Files > 100MB with streaming required
- Memory-constrained environments
- Need for consistent throughput across file sizes

❌ **Not Recommended**:
- Files < 1MB (100× slower due to ~8ms GPU setup overhead)
- Small/medium files where sync APIs are available
- Environments without WebGPU support (Chrome 113+, Edge 113+)

### Comparison with Other Approaches

| Approach | Throughput | Best For | Limitations |
|----------|------------|----------|-------------|
| **JS Sync** | 56 MB/s | Files <100MB, sync possible | Memory: 2× file size |
| **WASM Sync** | 43 MB/s | Files 1-10MB, sync possible | Slower than JS for small files |
| **CPU Stream** | 8 MB/s | Memory constrained, <100MB | 7× streaming overhead |
| **GPU Stream** | 12 MB/s | Memory constrained, >100MB | 7× streaming overhead, setup cost |

## Browser Support

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 113+ | ✅ Full | Best performance |
| Edge 113+ | ✅ Full | Based on Chromium |
| Firefox | ❌ Planned | Auto-fallback to WASM/JS |
| Safari | ❌ Not yet | Auto-fallback to WASM/JS |

## Usage Examples

### Basic Usage

```typescript
import { parseString } from 'web-csv-toolbox';

const csv = await fetch('/large-file.csv').then(r => r.text());

for await (const record of parseString(csv, {
  engine: { gpu: true }
})) {
  console.log(record);
}
```

### With Fallback Handling

```typescript
import { parseString } from 'web-csv-toolbox';

for await (const record of parseString(csv, {
  engine: {
    gpu: true,
    onFallback: (info) => {
      console.warn(`GPU unavailable: ${info.reason}`);
      console.log(`Using fallback: ${JSON.stringify(info.actualConfig)}`);
    }
  }
})) {
  console.log(record);
}
```

### With Custom GPU Device

```typescript
import { parseString } from 'web-csv-toolbox';

// Acquire GPU device manually (for sharing across operations)
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

// Parse multiple files with same device
for (const csv of csvFiles) {
  for await (const record of parseString(csv, {
    engine: {
      gpu: true,
      gpuDevice: device
    }
  })) {
    console.log(record);
  }
}
```

## Auto-Fallback Chain

When GPU is enabled, the parser automatically falls back through this chain:

```
GPU → WASM → Pure JS
```

**Fallback scenarios**:
- WebGPU not supported (browser doesn't support it)
- GPU device acquisition failed
- Shader compilation failed
- GPU execution error

**Fallback notification**:
```typescript
engine: {
  gpu: true,
  onFallback: (info) => {
    console.log(info.reason); // "WebGPU is not supported in this environment"
    console.log(info.requestedConfig); // { gpu: true }
    console.log(info.actualConfig); // { wasm: true } (fallback)
  }
}
```

## Performance Tips

### 1. Use for Large Files Only

```typescript
// ✅ Good: Large file (>100MB)
const largeCsv = await fetch('/100mb-file.csv').then(r => r.text());
for await (const record of parseString(largeCsv, {
  engine: { gpu: true }
})) {
  process(record);
}

// ❌ Bad: Small file (<1MB)
const smallCsv = "a,b\n1,2\n3,4";
for await (const record of parseString(smallCsv, {
  engine: { gpu: true } // GPU setup overhead dominates
})) {
  process(record);
}
```

### 2. Prefer Sync APIs When Possible

```typescript
import { parseString } from 'web-csv-toolbox';

// If memory allows, use sync API (faster than GPU streaming)
if (csvSize < 100_000_000) { // <100MB
  const records = parseString.toArraySync(csv);
  // 56 MB/s (JS sync) vs 12.1 MB/s (GPU stream)
} else {
  // For very large files, use GPU streaming
  for await (const record of parseString(csv, {
    engine: { gpu: true }
  })) {
    process(record);
  }
}
```

### 3. Reuse GPU Device

```typescript
// ✅ Good: Share device across operations
const adapter = await navigator.gpu.requestAdapter();
const device = await adapter.requestDevice();

for (const file of files) {
  const csv = await file.text();
  for await (const record of parseString(csv, {
    engine: { gpu: true, gpuDevice: device }
  })) {
    process(record);
  }
}

// ❌ Bad: Create new device for each file
for (const file of files) {
  const csv = await file.text();
  for await (const record of parseString(csv, {
    engine: { gpu: true } // Creates new device each time
  })) {
    process(record);
  }
}
```

## Implementation Details

### Two-Pass Algorithm

The GPU implementation uses a two-pass algorithm to handle arbitrarily long quoted fields:

**Pass 1: Quote Parity Collection**
- Each workgroup (256 bytes) computes XOR parity of quotes
- Stores parity in `workgroupXORs` buffer

**CPU: Prefix XOR**
- Computes prefix XOR across all workgroups
- Determines quote state at the start of each workgroup

**Pass 2: Separator Detection**
- Uses CPU-computed quote states
- Detects separators (commas, line feeds) outside quotes
- Writes separator positions atomically (race-free)

### Memory Usage

```
GPU memory = input size + separator buffer + workgroup buffer
            ≈ input size + input size + (input size / 256) * 4 bytes
            ≈ 2× input size
```

Similar to JS sync approach, but processing happens on GPU.

## Troubleshooting

### GPU Not Available

**Symptom**: Fallback to WASM/JS every time

**Solutions**:
- Check browser version (Chrome 113+, Edge 113+ required)
- Enable WebGPU in browser flags (chrome://flags)
- Check if GPU is available: `navigator.gpu`

```typescript
// Check GPU availability
if (!navigator.gpu) {
  console.error('WebGPU not supported');
} else {
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.error('No GPU adapter available');
  }
}
```

### Slow Performance on Small Files

**Symptom**: GPU slower than expected

**Cause**: GPU setup overhead (~8ms) dominates for small files

**Solution**: Use sync APIs for files <100MB:
```typescript
const records = parseString.toArraySync(csv); // Faster for small files
```

### Memory Issues

**Symptom**: Out of memory errors

**Cause**: Large file + GPU buffers

**Solution**: Process in chunks or use streaming:
```typescript
// Use streaming for very large files
for await (const record of parseString(csv, {
  engine: { gpu: true }
})) {
  await processAndClear(record); // Process + free memory
}
```

## Benchmarks

From Report 48 (WebGPU Performance Analysis):

### GPU vs CPU Streaming

```
File Size vs Throughput:
10MB:  GPU 12.1 MB/s ████████████ vs CPU 8.4 MB/s ████████
100MB: GPU 12.0 MB/s ████████████ vs CPU 8.3 MB/s ████████
500MB: GPU 12.1 MB/s ████████████ vs CPU 8.2 MB/s ████████
1GB:   GPU 12.2 MB/s ████████████ vs CPU 8.1 MB/s ████████
```

### Speedup Trend

```
File Size vs Speedup:
10MB:  1.44× ██████████████
100MB: 1.44× ██████████████
500MB: 1.48× ███████████████
1GB:   1.50× ███████████████
```

Speedup increases slightly with file size.

### Setup Overhead

```
Small File Performance:
100 rows:   GPU 8.68ms vs JS 0.069ms (100× slower)
1000 rows:  GPU 17.85ms vs JS 1.82ms (10× slower)
```

GPU setup overhead is significant for small files.

## Future Improvements

### Planned Features
- [ ] GPU sync API (estimated 1.6× faster than JS sync)
- [ ] Hybrid selection strategy (auto-select optimal parser)
- [ ] Stream transfer optimization
- [ ] SharedArrayBuffer for zero-copy

### Expected Performance
With GPU sync API:
- Theoretical throughput: ~92 MB/s (12.1 MB/s × 7.6 streaming overhead factor)
- Expected speedup: 1.6× faster than JS sync (92 vs 56 MB/s)

## See Also

- [Benchmark Reports](../../benchmark/reports/README.md)
- [Report 48: WebGPU Performance Analysis](../../benchmark/reports/48-webgpu-analysis/ANALYSIS.md)
- [Two-Pass Algorithm Documentation](../../src/parser/webgpu/TWO_PASS_ALGORITHM.md)
