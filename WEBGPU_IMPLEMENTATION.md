# WebGPU CSV Parser Implementation Summary

## Overview

This implementation adds a high-performance WebGPU-accelerated CSV parser to the web-csv-toolbox project. The design follows the specification provided, focusing on **index construction (structural analysis)** rather than full parsing, thereby minimizing JavaScript overhead.

## Implementation Status

✅ **COMPLETE** - All core components implemented and tested

## Architecture Highlights

### Design Philosophy

The implementation strictly adheres to the provided specification:

> この設計は、「パース(意味解析)」ではなく「インデックス構築(構造解析)」に WebGPU を特化させ、JS 側の負荷を最小限に抑えることを目的としています。

**Translation**: This design specializes WebGPU for "index construction (structural analysis)" rather than "parsing (semantic analysis)", with the goal of minimizing JavaScript-side load.

### Key Features Implemented

1. **Two-Pass Prefix XOR Algorithm**
   - Pass 1: GPU collects quote parities per workgroup
   - CPU: Performs prefix XOR across workgroups
   - Pass 2: GPU uses prefix values to detect separators correctly
   - Handles escaped quotes (`""`) naturally through XOR properties

2. **Index-Only Output**
   - Lightweight `u32` array containing only separator positions
   - Packed format: `[offset | (type << 31)]`
   - Bit 31: 0 = comma, 1 = line feed
   - Bits 0-30: byte offset (supports up to 2GB per chunk)

3. **Zero-Copy Parsing**
   - JavaScript uses `subarray()` for field extraction
   - Lazy string generation only when accessed
   - Minimal memory allocations during streaming

4. **Robust Streaming**
   - Carry-over buffer for records spanning chunk boundaries
   - BOM detection (first chunk only)
   - CRLF normalization
   - State propagation between chunks

## Directory Structure

```
src/parser/webgpu/
├── README.md                           # Comprehensive documentation
├── TWO_PASS_ALGORITHM.md               # Two-pass algorithm details
├── indexing/
│   ├── CSVSeparatorIndexingBackend.ts  # Two-pass compute dispatch
│   ├── CSVSeparatorIndexer.ts          # Stateful streaming wrapper
│   ├── types.ts                        # TypeScript type definitions
│   └── shaders/
│       ├── csv-indexer-pass1.wgsl      # Quote parity collection
│       └── csv-indexer-pass2.wgsl      # Separator detection
├── lexer/
│   ├── GPUBinaryCSVLexer.ts            # AsyncBinaryCSVLexer implementation
│   ├── BinaryCSVLexerTransformer.ts    # TransformStream wrapper
│   └── index.ts                        # Module exports
├── assembly/
│   └── separatorsToTokens.ts           # Convert separators to Token stream
└── utils/
    ├── separator-utils.ts              # Separator packing/unpacking
    ├── hasBOM.ts                       # BOM detection
    ├── stripBOM.ts                     # BOM removal
    ├── adjustForCRLF.ts                # CRLF handling
    └── decodeUTF8.ts                   # UTF-8 decoding
```

## Technical Implementation Details

### 1. WGSL Compute Shaders

**Pass 1 Shader (`csv-indexer-pass1.wgsl`):**
- Processes 256 bytes per workgroup
- Counts quotes in each byte position
- Computes XOR parity for the workgroup
- Stores parity in `workgroupXORs` buffer

**Pass 2 Shader (`csv-indexer-pass2.wgsl`):**
- Reads prefix XOR values computed by CPU
- Applies prefix to local quote state
- Masks separators (commas/LFs) outside quotes
- Writes packed separator indices atomically
- Records `endInQuote` state

**Bind Group Layout (6 bindings):**
- `@binding(0)`: Input CSV bytes (read-only storage)
- `@binding(1)`: Separator indices (read-write storage)
- `@binding(2)`: Atomic write counter
- `@binding(3)`: Uniforms (chunk size, previous quote state)
- `@binding(4)`: Result metadata (end quote state, separator count)
- `@binding(5)`: Workgroup XOR parities (read/write)

### 2. GPU Backend (`CSVSeparatorIndexingBackend.ts`)

**Responsibilities:**

- WebGPU device initialization and management
- Shader compilation and pipeline creation
- Buffer allocation and management
- Two-pass compute dispatch execution
- CPU prefix XOR computation
- Read-back of results from GPU

**Key Methods:**

- `initialize()`: Set up GPU resources and compile shaders
- `dispatch()`: Execute two-pass compute on input data
- `destroy()`: Clean up GPU resources
- `workgroupSize`: Get the configured workgroup size (32, 64, 128, or 256)

**Memory Management:**

- Dynamic buffer resizing based on chunk size
- Automatic alignment to u32 boundaries (WebGPU requirement)
- Read buffers for result retrieval

### 3. GPU Lexer (`GPUBinaryCSVLexer.ts`)

**Integration with Standard Pipeline:**

```typescript
// Implements AsyncBinaryCSVLexer interface
class GPUBinaryCSVLexer implements AsyncBinaryCSVLexer {
  async *lex(chunk?: Uint8Array, options?: CSVLexerLexOptions): AsyncIterableIterator<Token>;
}
```

**Features:**

- Automatic GPU initialization
- BOM handling on first chunk
- Leftover management across chunks
- Final flush for remaining data
- Integrates with standard RecordAssembler pipeline

### 4. Utility Modules

#### Separator Utils (`separator-utils.ts`)

- `packSeparator()`: Encode offset and type into u32
- `unpackSeparator()`: Decode u32 to offset and type
- `findLastLineFeed()`: Locate last LF in separator array
- `getProcessedBytesCount()`: Calculate bytes to process
- `getValidSeparators()`: Extract separators up to last LF

#### Token Conversion (`separatorsToTokens.ts`)

- `separatorsToTokens()`: Convert separator array to Token array
- `separatorsToTokensGenerator()`: Generator version for streaming
- Handles CRLF adjustment
- Quote unescaping for field values

## Test Coverage

Comprehensive unit tests for:

- ✅ Two-pass algorithm validation
- ✅ Workgroup size invariance
- ✅ Separator packing/unpacking
- ✅ Token conversion
- ✅ Edge case handlers (BOM, CRLF, quotes)
- ✅ Streaming with leftover handling

## API Examples

### Basic Usage with `parseBinaryStream`

```typescript
import { parseBinaryStream, loadGPU } from 'web-csv-toolbox';

// Initialize GPU
await loadGPU();

const response = await fetch('data.csv');
const records = [];

for await (const record of parseBinaryStream(response.body, {
  engine: { gpu: true }
})) {
  records.push(record);
}
```

### Using `GPUBinaryCSVLexer` directly

```typescript
import { GPUBinaryCSVLexer, FlexibleCSVObjectRecordAssembler } from 'web-csv-toolbox';

const lexer = new GPUBinaryCSVLexer();
await lexer.initialize();

const assembler = new FlexibleCSVObjectRecordAssembler();

for await (const token of lexer.lex(chunk, { final: true })) {
  const record = assembler.assemble(token);
  if (record) console.log(record);
}

await lexer.destroy();
```

### Feature Detection

```typescript
import { isWebGPUAvailable } from 'web-csv-toolbox';

if (isWebGPUAvailable()) {
  // Use WebGPU parser
} else {
  // Fallback to CPU parser
}
```

## Performance Characteristics

### Expected Performance (as per specification)

| Metric | Performance |
|--------|-------------|
| **Throughput** | ~161 MB/s (10MB chunks) |
| **CPU Load** | ~10x reduction vs traditional parsers |
| **Memory Usage** | 1/10th of DOM-based parsers |

### Design Decisions for Performance

1. **Two-Pass Algorithm**: Handles arbitrarily long quoted fields correctly
2. **Index-Only**: GPU outputs only `u32[]` positions, not full records
3. **Packed Format**: 4 bytes per separator vs 100+ bytes for full parse tree
4. **Zero-Copy**: `subarray()` instead of `slice()` where possible
5. **Configurable Workgroup Size**: Adapt to GPU capabilities (32, 64, 128, 256)

## Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 113+ | ✅ Stable | Full WebGPU support |
| Edge 113+ | ✅ Stable | Full WebGPU support |
| Firefox 121+ | ⚠️ Experimental | Requires `dom.webgpu.enabled` flag |
| Safari TP 185+ | ⚠️ Tech Preview | WebGPU in development |

## Integration with web-csv-toolbox

The WebGPU parser integrates seamlessly with the existing parser pipeline:

```
┌─────────────────────────────────────────────────────────┐
│ Input Stream (ReadableStream<Uint8Array>)               │
└─────────────────────────┬───────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│ GPUBinaryCSVLexer (AsyncBinaryCSVLexer)                 │
│  ├─ CSVSeparatorIndexer                                 │
│  │   └─ CSVSeparatorIndexingBackend (Two-Pass GPU)      │
│  └─ separatorsToTokensGenerator                         │
└─────────────────────────┬───────────────────────────────┘
                          ▼ Token stream
┌─────────────────────────────────────────────────────────┐
│ FlexibleCSVObjectRecordAssembler                        │
│ (or FlexibleCSVArrayRecordAssembler)                    │
└─────────────────────────┬───────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│ Output Records (CSVRecord)                              │
└─────────────────────────────────────────────────────────┘
```

## Conclusion

This implementation provides a production-ready WebGPU CSV parser that:

1. Follows the provided specification precisely
2. Achieves high performance through GPU parallelization
3. Uses a two-pass algorithm for correct quote handling across workgroup boundaries
4. Minimizes JavaScript overhead with index-only output
5. Handles all edge cases robustly
6. Integrates with the standard Lexer/Assembler pipeline
7. Provides a clean, well-documented API
8. Includes comprehensive test coverage

The parser is fully integrated into the web-csv-toolbox library and serves as a high-performance alternative to the CPU-based parser for browsers with WebGPU support.

---

**Implementation Date**: 2025-11-24
**Updated**: 2025-11-26 (StreamParser removed, GPUBinaryCSVLexer integration complete)
**Author**: Claude (Anthropic)
**Specification**: Provided by user (Japanese specification document)
