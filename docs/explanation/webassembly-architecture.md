---
title: WebAssembly Architecture
group: Explanation
---

# WebAssembly Architecture

This document explains the WebAssembly (WASM) implementation in web-csv-toolbox and how it achieves high-performance CSV parsing.

## Overview

web-csv-toolbox includes an optional WebAssembly module that provides improved CSV parsing performance compared to the JavaScript implementation. The WASM module is a compiled version of optimized parsing code that runs at near-native speed.

The library provides two entry points for WASM functionality:
- **Main entry point** (`web-csv-toolbox`): Automatic WASM initialization with embedded binary
- **Slim entry point** (`web-csv-toolbox/slim`): Manual initialization with external WASM loading

```text
┌─────────────────────────────────────────────────────────────┐
│ High-Level API (parse, parseString, etc.)                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Execution Router                                             │
│ - Selects execution strategy based on EngineConfig          │
└─────────────────────────────────────────────────────────────┘
                          ↓
        ┌─────────────────┴─────────────────┐
        ↓                                    ↓
┌──────────────────┐              ┌──────────────────┐
│ JavaScript       │              │ WebAssembly      │
│ Implementation   │              │ Implementation   │
│                  │              │                  │
│ - All features   │              │ - Compiled code  │
│ - All encodings  │              │ - UTF-8/UTF-16   │
│ - All options    │              │ - Limited options│
└──────────────────┘              └──────────────────┘
```

**Key Points:**
- WASM is optional (JavaScript fallback always available)
- Initialization is automatic when using WASM-enabled features
- Can be combined with Worker Threads for non-blocking parsing
- Compiled from Rust code using LLVM optimization

---

## Entry Points

This project ships two entry points (Main and Slim) that differ only in how WebAssembly is initialized and delivered. For a practical comparison and guidance on when to use each:

→ See: [Main vs Slim Entry Points](./main-vs-slim.md)

---

## Design Decisions

### Why WebAssembly?

**Performance:**
- Compiled to machine code
- Efficient memory management
- Optimized by LLVM compiler

**Portability:**
- Runs on all major browsers
- Supported in Node.js and Deno
- Single binary for all platforms

**Safety:**
- Memory-safe by design
- Sandboxed execution environment
- No access to system resources

---

### Why Rust?

The WASM module is compiled from Rust code because:

**Performance:**
- Zero-cost abstractions
- Optimized by LLVM compiler
- Minimal runtime overhead

**Memory Safety:**
- No null pointer dereferences
- No buffer overflows
- Memory managed at compile time

**WASM Support:**
- First-class WASM support via `wasm-bindgen`
- Easy JavaScript interop
- Automatic TypeScript definitions

---

### Why Optional?

WASM is opt-in rather than always-on because:

**Trade-offs:**
- **Size:** WASM binary adds to bundle size
- **Initialization:** Module loading adds overhead
- **Limitations:** UTF-8 and UTF-16 only

**Flexibility:**
- Users can choose based on their needs
- Automatic fallback to JavaScript for unsupported features
- JavaScript parser provides full feature compatibility

---

## WASM Module Structure

### Module Loading

```typescript
// loadWASM.ts (conceptual)
import init, { type InitInput } from 'web-csv-toolbox-wasm';
// In the web-csv-toolbox distribution, the WASM asset is exported as `web-csv-toolbox/csv.wasm`.
import wasmUrl from 'web-csv-toolbox/csv.wasm';

export async function loadWASM(input?: InitInput) {
  await init({ module_or_path: input ?? wasmUrl });
}
```

**How it works:**
1. The WASM binary is distributed as a separate asset (`csv.wasm`)
2. `init()` loads and instantiates the module (via URL or Buffer)
3. Module is cached globally for reuse
4. Subsequent calls are instant (already initialized)

---

### WASM Parser Architecture

The WASM module exposes a `CSVParser` class that uses a "Flat" output format for efficient data transfer:

```typescript
// Rust-side CSVParser (simplified)
class CSVParser {
  // Streaming API - process chunks incrementally
  processChunk(chunk: string): void;
  processChunkBytes(chunk: Uint8Array): void;

  // Finalize and get results
  finish(): FlatParseResult;

  // One-shot API - parse complete input
  parseAll(input: string): FlatParseResult;
  parseAllBytes(input: Uint8Array): FlatParseResult;
}

// FlatParseResult - efficient flat data structure
interface FlatParseResult {
  headers: string[];           // Column headers
  fieldData: string[];         // All field values in row-major order
  actualFieldCounts: number[]; // Actual field count per record (for sparse data)
  recordCount: number;         // Total number of records
  fieldCount: number;          // Number of fields per record (header count)
}
```

**Key implementation details:**
- WASM returns `FlatParseResult` (flat arrays, not nested objects)
- JavaScript-side converts flat data to objects via `flatToObjects()` utility
- Single-byte ASCII delimiter passed as char code (u8 in Rust)
- Supports both streaming (`processChunk`/`finish`) and one-shot (`parseAll`) modes

---

### JavaScript WASM Wrapper Classes

The library provides JavaScript wrapper classes that integrate the WASM module with the standard API:

```text
┌─────────────────────────────────────────────────────────────┐
│ High-Level API (parse, parseString, parseBinary, etc.)      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ WASM Parser Models (JavaScript wrappers)                     │
│                                                              │
│ String Input:                Binary Input:                   │
│ - WASMStringObjectCSVParser  - WASMBinaryObjectCSVParser     │
│ - WASMStringArrayCSVParser   - WASMBinaryArrayCSVParser      │
│                                                              │
│ Streaming (via engine option):                               │
│ - BinaryCSVParserStream with { engine: { wasm: true } }      │
│ - StringCSVParserStream with { engine: { wasm: true } }      │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ WASM CSVParser (Rust/csv-core)                               │
│ - processChunk/processChunkBytes (streaming)                 │
│ - finish() → FlatParseResult                                 │
│ - parseAll/parseAllBytes (one-shot)                          │
└─────────────────────────────────────────────────────────────┘
```

**Parser Models:**
- `WASMStringObjectCSVParser`: Parses string input, outputs object records
- `WASMStringArrayCSVParser`: Parses string input, outputs array records
- `WASMBinaryObjectCSVParser`: Parses `Uint8Array` input, outputs object records
- `WASMBinaryArrayCSVParser`: Parses `Uint8Array` input, outputs array records

**Stream Parsers:**
- `BinaryCSVParserStream`: `TransformStream` for binary streams, supports `{ engine: { wasm: true } }`
- `StringCSVParserStream`: `TransformStream` for string streams, supports `{ engine: { wasm: true } }`

---

## Memory Management

### JavaScript ↔ WASM Boundary

```text
┌──────────────────┐                    ┌──────────────────┐
│ JavaScript Heap  │                    │ WASM Linear      │
│                  │                    │ Memory           │
│ - JS Objects     │  Copy data         │                  │
│ - Strings        │ ────────────────>  │ - CSV String/    │
│ - Uint8Array     │                    │   Bytes          │
│                  │  FlatParseResult   │ - Parsing State  │
│                  │ <────────────────  │ - Field Buffer   │
└──────────────────┘                    └──────────────────┘
```

**Data Flow:**

1. **Input:** JavaScript string or `Uint8Array` copied to WASM linear memory
2. **Processing:** WASM parses CSV using `csv-core` library (streaming DFA)
3. **Output:** `FlatParseResult` (headers + flat field array) returned to JavaScript
4. **Conversion:** JavaScript converts flat data to objects via `flatToObjects()`

**Memory Efficiency:**
- Input: Copied to WASM memory (string or bytes)
- Parsing state: DFA state + field buffer (configurable via `maxBufferSize`)
- Output: Flat arrays (more efficient than nested objects)
- **Total overhead:** Approximately 2x input size during parsing

---

### Memory Limits

WASM respects the same `maxBufferSize` limit as JavaScript:

```typescript
const lexer = new FlexibleStringCSVLexer({ maxBufferSize: 10 * 1024 * 1024 }); // Example: 10MB
```

**Why:**
- Prevents memory exhaustion
- Consistent behavior across implementations
- Protection against malicious input

---

## Performance Characteristics

### Speed Comparison

**Performance depends on many factors:**
- CSV structure and size
- Runtime environment (browser, Node.js, Deno)
- System capabilities

**Theoretical advantages of WASM:**
- Compiled to machine code (vs interpreted JavaScript)
- Efficient memory access patterns
- Optimized by LLVM compiler

**Actual performance:**
For measured performance in various scenarios, see [CodSpeed benchmarks](https://codspeed.io/kamiazya/web-csv-toolbox).

---

### Initialization Overhead

```typescript
// First call - module loading
await loadWASM();

// Subsequent calls - instant (module cached)
await loadWASM();
```

**Considerations:**
- Module loading adds initial overhead
- Once loaded, module is cached for subsequent use
- Performance trade-offs depend on file size and parsing frequency
- Benchmark your specific use case to determine the best approach

---

### Memory Usage

Both implementations have similar memory usage:

| Stage | JavaScript | WASM |
|-------|-----------|------|
| Input | String (in heap) | String (copied to linear memory) |
| Parsing | CSVLexer buffer (configurable) | Parsing state (configurable) |
| Output | Objects (in heap) | JSON string → Objects |

**Total:** Both implementations use approximately 2x input size temporarily during parsing.

---

## Execution Strategies

### Main Thread WASM

```typescript
for await (const record of parse(csv, {
  engine: { wasm: true }
})) {
  console.log(record);
}
```

**Architecture:**
```text
Main Thread:
  1. Load CSV string
  2. Call WASM function
  3. Parse CSV in WASM
  4. Return results
  5. Yield records
```

**Characteristics:**
- ✅ Uses compiled WASM code
- ✅ No worker communication overhead
- ❌ Blocks main thread during parsing
- **Performance trade-off:** Faster execution (no communication cost) but UI becomes unresponsive
- Use case: Server-side parsing, scenarios where blocking is acceptable

---

### Worker + WASM

```typescript
for await (const record of parse(csv, {
  engine: { worker: true, wasm: true }
})) {
  console.log(record);
}
```

**Architecture:**
```text
Main Thread:                 Worker Thread:
  1. Transfer CSV data  -->    1. Receive CSV data
  2. Wait for results          2. Call WASM function
  3. Receive records    <--    3. Parse CSV in WASM
  4. Yield records             4. Send results back
```

**Characteristics:**
- ✅ Non-blocking UI
- ✅ Uses compiled WASM code
- ✅ Offloads parsing to worker thread
- ⚠️ Worker communication adds overhead (data transfer between threads)
- **Performance trade-off:** Execution time may increase due to communication cost, but UI remains responsive
- Use case: Browser applications, scenarios requiring UI responsiveness

---

## Limitations and Trade-offs

### Encoding Support

WASM encoding support differs between binary and string inputs:

**Binary Inputs (Uint8Array, ArrayBuffer, etc.):**
- **WASM**: UTF-8 only (decoded internally)
- **JavaScript**: Any encoding supported by TextDecoder (UTF-8, Shift-JIS, EUC-JP, etc.)

```typescript
// ✅ WASM with UTF-8 binary
const utf8Binary = new TextEncoder().encode(csvString);
for await (const record of parse(utf8Binary, {
  engine: { wasm: true }
})) {
  console.log(record);
}

// ❌ WASM with Shift-JIS binary → Automatic fallback to JavaScript
for await (const record of parse(shiftJISBinary, {
  engine: { wasm: true },
  charset: 'shift-jis'  // Falls back to JavaScript automatically
})) {
  console.log(record);
}
```

**String Inputs:**
- **WASM**: Two processing modes
  - `charset: 'utf-8'` (default): Encode to UTF-8 bytes → WASM processing
  - `charset: 'utf-16'`: Direct UTF-16 processing (faster, skips TextEncoder/TextDecoder)
- **JavaScript**: Always supported (already JavaScript strings)

```typescript
// ✅ WASM with UTF-16 mode (optimized for JavaScript strings)
for await (const record of parse(unicodeCsv, {
  engine: { wasm: true },
  charset: 'utf-16'  // Skip TextEncoder/TextDecoder overhead
})) {
  console.log(record);
}
```

**UTF-16 Mode Benefits:**
- JavaScript strings are internally UTF-16
- Avoids TextEncoder/TextDecoder overhead
- Faster for Unicode-heavy data (Japanese, Chinese, etc.)
- Only works with string inputs

**Summary Table:**

| Input Type | WASM Support | JavaScript Support |
|-----------|--------------|-------------------|
| Binary | UTF-8 only | Any TextDecoder encoding |
| String | UTF-8/UTF-16 processing | Always supported |

---

### Single-Byte ASCII Delimiter and Quotation

**Limitation:**
WASM parser only supports single-byte ASCII delimiters and quotation characters (code point < 128).

**Supported:**
- ASCII delimiters (`,`, `\t`, `;`, `|`, etc.)
- ASCII quotation marks (`"`, `'`, etc.)
- Default is comma (`,`) for delimiter and double-quote (`"`) for quotation (RFC 4180 standard)

**Not Supported (WASM only):**
- Multi-byte UTF-8 characters (e.g., Japanese comma `、`, Japanese brackets `「」`)

**Not Supported (both JS and WASM):**
- Multi-character delimiters (e.g., `::`, `||`)
- Multi-character quotation marks

**Workaround for non-ASCII characters:**
For multi-byte UTF-8 characters as delimiter/quotation, use the JavaScript parser:

```typescript
for await (const record of parse(csv, {
  engine: { wasm: false },
  delimiter: '、' // Multi-byte UTF-8 delimiter requires JavaScript parser
})) {
  console.log(record);
}

---

### Output Format Support

WASM supports both object and array output formats through the high-level API:

```typescript
// Object output (default)
const objects = await parse.toArray(csv, {
  engine: { wasm: true },
  outputFormat: "object", // or omit for default
});
// [{ name: "Alice", age: "30" }, ...]

// Array output
const arrays = await parse.toArray(csv, {
  engine: { wasm: true },
  outputFormat: "array",
});
// [["Alice", "30"], ...]
```

Low-level WASM parsers are also available for direct access:

```typescript
import { WASMStringArrayCSVParser, WASMStringObjectCSVParser, loadWASM } from 'web-csv-toolbox';

await loadWASM();

// Array parser
const arrayParser = new WASMStringArrayCSVParser();
const arrays = [...arrayParser.parse("name,age\nAlice,30")];
// [['Alice', '30'], ...]

// Object parser
const objectParser = new WASMStringObjectCSVParser();
const objects = [...objectParser.parse("name,age\nAlice,30")];
// [{ name: 'Alice', age: '30' }, ...]
```

---

### String Input Requires Complete Data

**Limitation:**
WASM string parsing (`parseString`, `parse` with string input) processes the entire CSV string at once.

**Why:**
- String-based API (`parseAll`) is optimized for complete strings
- Avoids complex UTF-8 boundary handling across chunks

**Impact:**
- Memory usage proportional to file size for string inputs
- Not suitable for unbounded string streams

**Binary Streaming Available:**
For streaming use cases, use `BinaryCSVParserStream` with the `engine` option:

```typescript
import { BinaryCSVParserStream, loadWASM } from 'web-csv-toolbox';

await loadWASM();

const parser = new BinaryCSVParserStream({ engine: { wasm: true } });

await fetch('large.csv')
  .then(res => res.body)
  .pipeThrough(parser)
  .pipeTo(new WritableStream({
    write(record) { console.log(record); }
  }));
```

Or via high-level APIs with binary/Response input:

```typescript
// These support WASM streaming via BinaryCSVParserStream with engine option
for await (const record of parseBinaryStream(stream, { engine: { wasm: true } })) { ... }
for await (const record of parseResponse(response, { engine: { wasm: true } })) { ... }
```

---

## Automatic Fallback

The execution router automatically falls back to JavaScript when WASM is unavailable or incompatible:

```text
┌─────────────────────────────────────────────────────────────┐
│ User requests WASM execution                                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Check: Is WASM loaded?                                       │
└─────────────────────────────────────────────────────────────┘
        ↓ No                              ↓ Yes
┌──────────────────┐              ┌──────────────────────┐
│ Fallback to JS   │              │ Check: UTF-8/UTF-16? │
└──────────────────┘              └──────────────────────┘
                                          ↓ No         ↓ Yes
                                  ┌──────────────┐  ┌──────────────┐
                                  │ Fallback     │  │ Check:       │
                                  │ to JS        │  │ Single-char? │
                                  └──────────────┘  └──────────────┘
                                                          ↓ No      ↓ Yes
                                                    ┌──────────┐  ┌──────────┐
                                                    │ Fallback │  │ Use WASM │
                                                    │ to JS    │  └──────────┘
                                                    └──────────┘
```

**Fallback scenarios:**
1. WASM initialization failed or module could not be loaded
2. Non-UTF-8/UTF-16 encoding specified (e.g., Shift-JIS)
3. Non-ASCII delimiter or quotation specified (e.g., Japanese `、`)
4. WASM not supported in runtime (rare)

---

## Security Considerations

### Sandboxed Execution

WASM runs in a sandboxed environment:

**Isolation:**
- No access to file system
- No access to network
- No access to system calls
- Cannot escape sandbox

**Memory Safety:**
- No buffer overflows (Rust guarantees)
- No null pointer dereferences
- Bounds checking on all memory access

---

### Resource Limits

WASM respects the same resource limits as JavaScript:

```typescript
// maxBufferSize applies to both JS and WASM
const lexer = new FlexibleStringCSVLexer({ maxBufferSize: 10 * 1024 * 1024 }); // Example
```

**Why:**
- Prevents memory exhaustion
- Protection against CSV bombs
- Consistent security model

---

## Runtime Requirements

WASM features in this library depend on your runtime’s native WebAssembly support. Verify your environment before relying on WASM acceleration.

- WebAssembly docs: [Can I Use](https://caniuse.com/wasm) · [MDN](https://developer.mozilla.org/en-US/docs/WebAssembly)
- Library coverage and testing scope: [Supported Environments](../reference/supported-environments.md)

If your runtime doesn’t support WebAssembly or you choose not to use it, the JavaScript parser remains available as a fallback.

### Bundle Integration

The WASM binary is bundled with the npm package:

```text
web-csv-toolbox/
├── dist/
│   ├── main.web.js / main.node.js            # Main entry points
│   ├── slim.web.js / slim.node.js            # Slim entry points
│   ├── csv.wasm                               # WASM binary (exported as web-csv-toolbox/csv.wasm)
│   ├── _virtual/                              # Build-time virtual modules for inlined WASM (main entry)
│   └── wasm/
│       └── loaders/                           # loadWASM / loadWASMSync loaders
```

**Bundler support:**
- Webpack: Automatically handles WASM
- Vite: Built-in WASM support
- Rollup: Requires `@rollup/plugin-wasm`

---

## Related Documentation

- **[Using WebAssembly Tutorial](../tutorials/using-webassembly.md)** - Getting started with WASM
- **[WASM Performance Optimization](../how-to-guides/wasm-performance-optimization.md)** - Optimization techniques
- **[loadWASM API Reference](https://kamiazya.github.io/web-csv-toolbox/functions/loadWASM.html)** - WASM initialization
- **[parseString API Reference](https://kamiazya.github.io/web-csv-toolbox/functions/parseString.html)** - String parsing (use `{ engine: { wasm: true } }` for WASM)
- **[Execution Strategies](./execution-strategies.md)** - Understanding execution modes

---

## Summary

web-csv-toolbox's WebAssembly implementation provides:

1. **Compiled Execution**: Uses WASM compiled from Rust code
2. **Portability**: Runs on all modern browsers and runtimes
3. **Safety**: Memory-safe, sandboxed execution
4. **Flexibility**: Optional, automatic fallback to JavaScript
5. **Integration**: Works with Worker Threads for non-blocking parsing

**Trade-offs:**
- UTF-8 and UTF-16 only (no Shift-JIS, EUC-JP, etc.)
- Processes entire string at once (not incremental)
- Module loading adds initial overhead

**When to use WASM:**
- Evaluate performance for your specific use case
- Consider WASM when:
  - Working with UTF-8 or UTF-16 CSV files
  - Using single-byte ASCII delimiter and quotation
  - Processing complete CSV strings
  - Unicode-heavy data (use `charset: 'utf-16'`)
- Benchmark your actual data to make informed decisions

**Performance:** See [CodSpeed benchmarks](https://codspeed.io/kamiazya/web-csv-toolbox) for actual measured performance across different scenarios.
