# WebGPU CSV Parser

High-throughput CSV indexing built on WebGPU. This folder contains both the GPU compute backend (`indexing/`) and the streaming parser (`streaming/`) that converts separator indices into structured records without ever materializing the full CSV AST.

## Overview

- **Two-pass GPU pipeline** – Pass 1 collects quote parity per workgroup, the CPU performs a prefix XOR, and Pass 2 consumes that prefix to detect separators with unbounded quoted fields.
- **Streaming-first** – `StreamParser` incrementally parses multi‑GB sources with constant memory, carrying quote state and partial records across chunks.
- **Measured performance** – 10 MB chunks hit ~161 MB/s, while 100 MB workloads are ~9.2× faster than the CPU baseline on RTX 3080/Chrome 120.
- **Typed API surface** – Everything (backend, streaming parser, utilities) is TypeScript-first and tree‑shakeable.

## Core Components

| Component | Location | Description |
|-----------|----------|-------------|
| `CSVIndexingBackend` | `indexing/CSVIndexingBackend.ts` | Orchestrates the two-pass compute dispatch, CPU prefix XOR, buffer management, and result reads. |
| Pass 1 shader | `indexing/shaders/csv-indexer-pass1.wgsl` | Emits one XOR parity per 256-byte workgroup. |
| Pass 2 shader | `indexing/shaders/csv-indexer-pass2.wgsl` | Applies CPU prefixes, masks separators, writes packed indices, and records `endInQuote`. |
| Public types | `indexing/types.ts` | Shared structs for uniforms, metadata, separators, and streaming state. |
| `StreamParser` | `streaming/stream-parser.ts` | High-level chunked parser with BOM detection, CRLF normalization, carry-over handling, and `await using` support. |
| Tests | `two-pass-validation.browser.test.ts`, `streaming/*.test.ts` | Regression coverage for long quoted fields and property-based equivalence with PapaParse. |

See `TWO_PASS_ALGORITHM.md` for a deep dive into the workgroup parity hand-off.

## Two-Pass Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Pass 1 (GPU, csv-indexer-pass1.wgsl)                        │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │ WG 0     │ │ WG 1     │ │ WG 2     │ │ WG N     │         │
│ │ 256 B    │ │ 256 B    │ │ 256 B    │ │ 256 B    │         │
│ │ XOR→1    │ │ XOR→0    │ │ XOR→1    │ │ XOR→0    │         │
│ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘         │
│      ▼            ▼            ▼            ▼               │
│    workgroupXORs buffer (array<atomic<u32>>)                │
└─────────────┬───────────────────────────────────────────────┘
              ▼  mapAsync + prefix scan
┌─────────────────────────────────────────────────────────────┐
│ CPU Prefix XOR (CSVIndexingBackend)                         │
│ prefix[wg] = prevInQuote ^ ⨁(parities before wg)            │
│ upload → workgroupXORs buffer (now read-only u32 view)      │
└─────────────┬───────────────────────────────────────────────┘
              ▼
┌─────────────────────────────────────────────────────────────┐
│ Pass 2 (GPU, csv-indexer-pass2.wgsl)                        │
│  apply prefix + local XOR → mask commas/LFs → ordered write │
│  store `endInQuote`, separator indices, and counts          │
└─────────────┬───────────────────────────────────────────────┘
              ▼
┌─────────────────────────────────────────────────────────────┐
│ CPU Field Assembly (StreamParser)                           │
│  adjust CRLF, decode UTF-8, emit records, update carry state│
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. Concatenate the previous leftover bytes with the new chunk (and strip BOM on the very first chunk).
2. Dispatch Pass 1 to collect per-workgroup quote parity.
3. Map `workgroupXORs`, compute CPU prefix XORs, overwrite the buffer with prefix values.
4. Dispatch Pass 2 to detect commas/line-feeds outside quotes, store packed indices, and capture `endInQuote`.
5. Read separator data back, keep bytes up to the last LF, and emit records.
6. Carry over tail bytes + quote state (via `endInQuote` + leftover parity) for the next chunk.

## Usage

All sample imports assume the repo’s base-url alias (`@/`). Adjust paths if you consume the compiled package instead.

### Quick Parse with `parseCSVStream`

```ts
import { parseCSVStream } from "@/parser/webgpu/streaming/stream-parser.ts";

const response = await fetch("/data.csv");
const records = await parseCSVStream(response.body, {
  config: { chunkSize: 2 * 1024 * 1024 }, // optional
});

console.log("Rows:", records.length);
```

### Streaming with Callbacks (and `await using`)

```ts
import { StreamParser } from "@/parser/webgpu/streaming/stream-parser.ts";

await using parser = await StreamParser.create({
  config: { enableTiming: true },
  onRecord: (record) => console.log(record.fields.map((f) => f.value)),
  onError: (error) => console.error("Parse error", error),
});

await parser.parseStream((await fetch("/large.csv")).body);
// parser.destroy() is called automatically by async disposal
```

### Reusing a GPU Device

```ts
const adapter = await navigator.gpu?.requestAdapter();
const device = await adapter?.requestDevice();

const parserA = new StreamParser({ config: { device } });
const parserB = new StreamParser({ config: { device, chunkSize: 4 << 20 } });

await parserA.initialize();
await parserB.initialize();
// ... parse multiple streams in sequence ...
await parserA.destroy();
await parserB.destroy();
device?.destroy();
```

### Low-Level Backend

```ts
import { CSVIndexingBackend } from "@/parser/webgpu/indexing/CSVIndexingBackend.ts";

const backend = new CSVIndexingBackend({ enableTiming: true });
await backend.initialize();

const bytes = new TextEncoder().encode('a,"b,c"\nd,e,f\n');
const { data, timing } = await backend.dispatch(bytes, {
  chunkSize: bytes.length,
  prevInQuote: 0,
});

console.log(data.sepIndices.slice(0, data.sepCount)); // packed separators
console.log(timing?.phases);
await backend.destroy();
```

## Technical Notes

### Separator Encoding

Packed separator layout (see `utils/separator-utils.ts`):

```
Bit 31  : Type flag (0 = comma, 1 = LF)
Bits 0-30: Byte offset within the chunk (≤ 2,147,483,647)
```

`packSeparator(offset, type)` and friends keep memory usage near ~4 bytes per separator even for multi-GB inputs.

### Quote Propagation & Chunk Carry-Over

- Two-pass prefix propagation guarantees correctness for arbitrarily long quoted fields (details in `TWO_PASS_ALGORITHM.md`).
- `StreamParser` never reprocesses bytes with the wrong state: if a chunk ends without a newline, it carries the whole buffer forward and leaves `prevInQuote` untouched.
- After emitting full records, the parser recomputes quote parity for the leftover slice so the next chunk starts in the right state (`prevInQuote = endInQuote ^ leftoverParity`).

### Edge Case Handling

| Case | Behavior |
|------|----------|
| UTF‑8 BOM | Stripped once on the first chunk (unless `skipBOM` is set). |
| CRLF | GPU only marks `\n`; CPU backtracks one byte when a preceding `\r` exists. |
| Escaped quotes | Doubling (`""`) collapses naturally thanks to XOR parity; CPU unescapes when materializing fields. |
| Empty fields / rows | Adjacent separators and repeated LFs emit empty strings/records with zero allocations. |
| Streaming leftovers | Records can span chunks of any size; only completed rows trigger callbacks. |

## Performance

| Chunk Size | Workgroups | Avg Time | Throughput | Notes |
|------------|------------|----------|------------|-------|
| 1 MB | 4 096 | 16.5 ms | 60.7 MB/s | Includes two-pass overhead and readbacks. |
| 10 MB | 40 960 | 62.0 ms | 161.4 MB/s | GPU time is sub-millisecond; transfers dominate. |
| 100 MB | 409 600 | 0.91 s | 109.8 MB/s | ~9.23× faster than the CPU fallback (83.8 s). |

`CSVIndexingBackend` can log per-phase timings (`pass1Gpu`, `gpuToCpu`, `cpuCompute`, etc.) by toggling `enableTiming`.

## Browser Compatibility & Feature Detection

| Browser | Status |
|---------|--------|
| Chrome / Edge 113+ | ✅ Stable |
| Firefox 121+ | ⚠️ Behind `dom.webgpu.enabled` |
| Safari TP 185+ | ⚠️ Technology Preview |

```ts
import { isWebGPUAvailable } from "@/parser/execution/gpu/isGPUAvailable.ts";

if (!isWebGPUAvailable()) {
  // fallback to WASM or CPU parser
}
```

## API Reference

### `StreamParser`

```ts
class StreamParser {
  constructor(options?: StreamingParserOptions);
  static create(options?: StreamingParserOptions): Promise<StreamParser>;
  initialize(): Promise<void>;
  parseStream(stream: ReadableStream<Uint8Array> | null): Promise<void>;
  reset(): void;
  destroy(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
}
```

Key options (`StreamingParserOptions`):
- `config` → forwarded to `CSVIndexingBackend` (`chunkSize`, `maxSeparators`, `device`, `enableTiming`, ...).
- `onRecord(record)` → async-friendly callback per parsed row.
- `onError(error)` → hook for error reporting.
- `skipBOM` → disables BOM stripping logic.

### `parseCSVStream(stream, options?)`

Convenience helper that buffers results into an array by wiring `onRecord` internally. Accepts the same `config` subset as `StreamParser`.

### `CSVIndexingBackend`

```ts
class CSVIndexingBackend {
  constructor(config?: {
    chunkSize?: number;
    maxSeparators?: number;
    gpu?: GPU;
    device?: GPUDevice;
    enableTiming?: boolean;
  });
  initialize(): Promise<void>;
  dispatch(input: Uint8Array, uniforms: ParseUniforms): Promise<{
    data: GPUParseResult;
    timing?: ComputeTiming;
  }>;
  destroy(): Promise<void>;
  getDevice(): GPUDevice | null;
  get isInitialized(): boolean;
}
```

Buffers (`indexing/types.ts`) include input, separator indices, atomic counter, uniforms, result metadata, and the shared `workgroupXORs` scratchpad used in both passes.

## Testing & Benchmarks

```bash
# Unit + integration tests (browser + node environments)
pnpm test

# Focus the WebGPU validation suites
pnpm vitest run src/parser/webgpu/two-pass-validation.browser.test.ts

# Browser benchmark harness (serves benchmark-two-pass.html)
pnpm dev
```

## References

- [`TWO_PASS_ALGORITHM.md`](./TWO_PASS_ALGORITHM.md)
- [`WEBGPU_IMPLEMENTATION.md`](../../../WEBGPU_IMPLEMENTATION.md)
- WebGPU Spec – https://www.w3.org/TR/webgpu/
- WGSL Spec – https://www.w3.org/TR/WGSL/
- Parallel Prefix Sum (GPU Gems 3, Ch. 39)
- RFC 4180 – https://www.rfc-editor.org/rfc/rfc4180
