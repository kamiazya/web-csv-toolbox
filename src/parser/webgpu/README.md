# WebGPU CSV Parser

High-throughput CSV indexing built on WebGPU. This folder contains the GPU compute backend (`indexing/`), lexer (`lexer/`), and assembly utilities (`assembly/`) that convert separator indices into structured records.

## Overview

- **Two-pass GPU pipeline** – Pass 1 collects quote parity per workgroup, the CPU performs a prefix XOR, and Pass 2 consumes that prefix to detect separators with unbounded quoted fields.
- **Streaming-first** – The `GPUBinaryCSVLexer` incrementally parses multi‑GB sources with constant memory, carrying quote state and partial data across chunks.
- **Measured performance** – 10 MB chunks hit ~161 MB/s, while 100 MB workloads are ~9.2× faster than the CPU baseline on RTX 3080/Chrome 120.
- **Typed API surface** – Everything (backend, lexer, utilities) is TypeScript-first and tree‑shakeable.

## Core Components

| Component | Location | Description |
|-----------|----------|-------------|
| `CSVSeparatorIndexingBackend` | `indexing/CSVSeparatorIndexingBackend.ts` | Orchestrates the two-pass compute dispatch, CPU prefix XOR, buffer management, and result reads. |
| `CSVSeparatorIndexer` | `indexing/CSVSeparatorIndexer.ts` | Stateful streaming wrapper for the backend with leftover handling. |
| `GPUBinaryCSVLexer` | `lexer/GPUBinaryCSVLexer.ts` | High-level AsyncBinaryCSVLexer implementation using GPU acceleration. |
| `BinaryCSVLexerTransformer` | `lexer/BinaryCSVLexerTransformer.ts` | TransformStream wrapper for pipeline integration. |
| Pass 1 shader | `indexing/shaders/csv-indexer-pass1.wgsl` | Emits one XOR parity per 256-byte workgroup. |
| Pass 2 shader | `indexing/shaders/csv-indexer-pass2.wgsl` | Applies CPU prefixes, masks separators, writes packed indices, and records `endInQuote`. |
| Public types | `indexing/types.ts` | Shared structs for uniforms, metadata, separators, and streaming state. |
| Token conversion | `assembly/separatorsToTokens.ts` | Converts GPU separator indices into Token stream for record assemblers. |

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
│ CPU Prefix XOR (CSVSeparatorIndexingBackend)                │
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
│ CPU Token Assembly (GPUBinaryCSVLexer + RecordAssembler)    │
│  convert separators to tokens, assemble into records        │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. Concatenate the previous leftover bytes with the new chunk (and strip BOM on the very first chunk).
2. Dispatch Pass 1 to collect per-workgroup quote parity.
3. Map `workgroupXORs`, compute CPU prefix XORs, overwrite the buffer with prefix values.
4. Dispatch Pass 2 to detect commas/line-feeds outside quotes, store packed indices, and capture `endInQuote`.
5. Convert separator data to Tokens, keep bytes up to the last LF, and emit tokens.
6. Carry over tail bytes + quote state (via `endInQuote` + leftover parity) for the next chunk.

## Usage

All sample imports assume the repo's base-url alias (`@/`). Adjust paths if you consume the compiled package instead.

### Using `parseBinaryStream` with GPU

```ts
import { parseBinaryStream, loadGPU } from "web-csv-toolbox";

// Initialize GPU
await loadGPU();

const response = await fetch("/data.csv");
const records = [];

for await (const record of parseBinaryStream(response.body, {
  engine: { gpu: true }
})) {
  records.push(record);
}

console.log("Rows:", records.length);
```

### Using `GPUBinaryCSVLexer` directly

```ts
import { GPUBinaryCSVLexer, FlexibleCSVObjectRecordAssembler } from "web-csv-toolbox";

const lexer = new GPUBinaryCSVLexer();
await lexer.initialize();

const assembler = new FlexibleCSVObjectRecordAssembler();
const stream = (await fetch("/large.csv")).body;
const reader = stream.getReader();

try {
  while (true) {
    const { done, value: chunk } = await reader.read();

    for await (const token of lexer.lex(chunk, { final: done })) {
      const record = assembler.assemble(token);
      if (record) {
        console.log(record);
      }
    }

    if (done) break;
  }
} finally {
  await lexer.destroy();
}
```

### Using `BinaryCSVLexerTransformer` in Pipelines

```ts
import { BinaryCSVLexerTransformer, CSVRecordAssemblerTransformer } from "web-csv-toolbox";

const lexerTransformer = new BinaryCSVLexerTransformer();
const assemblerTransformer = new CSVRecordAssemblerTransformer();

const response = await fetch("/data.csv");
const recordStream = response.body
  .pipeThrough(lexerTransformer)
  .pipeThrough(assemblerTransformer);

for await (const record of recordStream) {
  console.log(record);
}

await lexerTransformer.destroy();
```

### Low-Level Backend

```ts
import { CSVSeparatorIndexingBackend } from "web-csv-toolbox";

const backend = new CSVSeparatorIndexingBackend({
  gpu: navigator.gpu,
  enableTiming: true
});
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

`packSeparator(offset, type)` and friends keep memory usage near ~4 bytes per separator even for multi-GB inputs.

### Quote Propagation & Chunk Carry-Over

- Two-pass prefix propagation guarantees correctness for arbitrarily long quoted fields (details in `TWO_PASS_ALGORITHM.md`).
- The lexer never reprocesses bytes with the wrong state: if a chunk ends without a newline, it carries the whole buffer forward and leaves `prevInQuote` untouched.
- After emitting full tokens, the parser recomputes quote parity for the leftover slice so the next chunk starts in the right state.

### Edge Case Handling

| Case | Behavior |
|------|----------|
| UTF‑8 BOM | Stripped once on the first chunk. |
| CRLF | GPU only marks `\n`; CPU backtracks one byte when a preceding `\r` exists. |
| Escaped quotes | Doubling (`""`) collapses naturally thanks to XOR parity; CPU unescapes when materializing fields. |
| Empty fields / rows | Adjacent separators and repeated LFs emit empty strings/records with zero allocations. |
| Streaming leftovers | Records can span chunks of any size; only completed rows trigger callbacks. |

## Performance

| Chunk Size | Workgroups | Avg Time | Throughput | Notes |
|------------|------------|----------|------------|-------|
| 1 MB | 4 096 | 16.5 ms | 60.7 MB/s | Includes two-pass overhead and readbacks. |
| 10 MB | 40 960 | 62.0 ms | 161.4 MB/s | GPU time is sub-millisecond; transfers dominate. |
| 100 MB | 409 600 | 0.91 s | 109.8 MB/s | ~9.23× faster than the CPU fallback (83.8 s). |

`CSVSeparatorIndexingBackend` can log per-phase timings (`pass1Gpu`, `gpuToCpu`, `cpuCompute`, etc.) by toggling `enableTiming`.

## Browser Compatibility & Feature Detection

| Browser | Status |
|---------|--------|
| Chrome / Edge 113+ | ✅ Stable |
| Firefox 121+ | ⚠️ Behind `dom.webgpu.enabled` |
| Safari TP 185+ | ⚠️ Technology Preview |

```ts
import { isWebGPUAvailable } from "web-csv-toolbox";

if (!isWebGPUAvailable()) {
  // fallback to WASM or CPU parser
}
```

## API Reference

### `GPUBinaryCSVLexer`

```ts
class GPUBinaryCSVLexer implements AsyncBinaryCSVLexer {
  constructor(config?: GPUBinaryCSVLexerConfig);
  initialize(): Promise<void>;
  lex(chunk?: Uint8Array, options?: CSVLexerLexOptions): AsyncIterableIterator<Token>;
  destroy(): Promise<void>;
}
```

### `BinaryCSVLexerTransformer`

```ts
class BinaryCSVLexerTransformer extends TransformStream<Uint8Array, Token> {
  constructor(options?: BinaryCSVLexerTransformerOptions);
  destroy(): Promise<void>;
}
```

### `CSVSeparatorIndexingBackend`

```ts
class CSVSeparatorIndexingBackend {
  constructor(config?: CSVSeparatorIndexingBackendConfig);
  initialize(): Promise<void>;
  dispatch(input: Uint8Array, uniforms: ParseUniforms): Promise<{
    data: GPUParseResult;
    timing?: ComputeTiming;
  }>;
  destroy(): Promise<void>;
  getDevice(): GPUDevice | null;
  get isInitialized(): boolean;
  get workgroupSize(): WorkgroupSize;
}
```

### `CSVSeparatorIndexer`

```ts
class CSVSeparatorIndexer {
  constructor(config?: CSVSeparatorIndexerConfig);
  initialize(backend?: CSVSeparatorIndexingBackendInterface): Promise<void>;
  index(chunk: Uint8Array, options?: CSVSeparatorIndexerIndexOptions): Promise<CSVSeparatorIndexResult>;
  flush(): CSVSeparatorIndexResult;
  reset(): void;
  destroy(): Promise<void>;
  getLeftover(): Uint8Array;
}
```

## Testing & Benchmarks

```bash
# Unit + integration tests (browser + node environments)
pnpm test

# Focus the WebGPU validation suites
pnpm vitest run src/parser/webgpu/indexing/

# Browser benchmark harness (serves benchmark-two-pass.html)
pnpm dev
```

## References

- [`TWO_PASS_ALGORITHM.md`](./TWO_PASS_ALGORITHM.md)
- [`WEBGPU_IMPLEMENTATION.md`](../../../WEBGPU_IMPLEMENTATION.md)
- WebGPU Spec – https://www.w3.org/TR/webgpu/
- WGSL Spec – https://www.w3.org/TR/WGSL/
- Parallel Prefix Sum (GPU Gems 3, Ch. 39)
- RFC 4180 – https://www.rfc-editor.org/rfc/rfc4180
