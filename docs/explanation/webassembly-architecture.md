---
title: WebAssembly Architecture
group: Explanation
---

# WebAssembly Architecture

This document explains the WebAssembly (WASM) implementation in web-csv-toolbox and how it achieves high-performance CSV parsing.

## Overview

web-csv-toolbox includes an optional WebAssembly module that provides improved CSV parsing performance compared to the JavaScript implementation. The WASM module is a compiled version of optimized parsing code that runs at near-native speed.

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
│ - Full features  │              │ - High perf      │
│ - All encodings  │              │ - UTF-8 only     │
│ - All options    │              │ - Limited options│
└──────────────────┘              └──────────────────┘
```

**Key Points:**
- WASM is optional and requires explicit initialization
- Automatic fallback to JavaScript if WASM is unavailable
- Can be combined with Worker Threads for maximum performance
- Compiled from Rust code for optimal speed

---

## Design Decisions

### Why WebAssembly?

**Performance:**
- Near-native execution speed
- Efficient memory management
- Optimized for CPU-intensive parsing

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
- **Size:** WASM binary adds ~100KB to bundle size
- **Initialization:** Async loading adds latency
- **Limitations:** UTF-8 only, double-quote only

**Flexibility:**
- Users can choose based on their needs
- Fallback to JavaScript for unsupported features
- Smaller bundle for users who don't need WASM

---

## WASM Module Structure

### Module Loading

```typescript
// loadWASM.ts
import init, { type InitInput } from "web-csv-toolbox-wasm";
import dataURL from "web-csv-toolbox-wasm/web_csv_toolbox_wasm_bg.wasm";

export async function loadWASM(input?: InitInput | Promise<InitInput>) {
  await init(input ?? dataURL);
}
```

**How it works:**
1. WASM binary is bundled as a data URL
2. `init()` loads and instantiates the WASM module
3. Module is cached globally for reuse
4. Subsequent calls are instant (module already loaded)

---

### WASM Parsing Function

```typescript
// parseStringToArraySyncWASM.ts
import { parseStringToArraySync } from "web-csv-toolbox-wasm";

export function parseStringToArraySyncWASM<Header>(
  csv: string,
  options?: CommonOptions
): CSVRecord<Header>[] {
  // Validate options
  if (quotation !== '"') {
    throw new RangeError("Invalid quotation, must be double quote on WASM.");
  }

  // Call WASM function
  const delimiterCode = delimiter.charCodeAt(0);
  return JSON.parse(parseStringToArraySync(csv, delimiterCode));
}
```

**Key implementation details:**
- WASM function returns JSON string (not JavaScript objects)
- JSON parsing happens in JavaScript (efficient for object creation)
- Single-character delimiter passed as char code (u8 in Rust)

---

## Memory Management

### JavaScript ↔ WASM Boundary

```text
┌──────────────────┐                    ┌──────────────────┐
│ JavaScript Heap  │                    │ WASM Linear      │
│                  │                    │ Memory           │
│ - JS Objects     │  Copy data         │                  │
│ - Strings        │ ────────────────>  │ - CSV String     │
│ - Arrays         │                    │ - Parsing State  │
│                  │  Copy result       │ - Output Buffer  │
│                  │ <────────────────  │                  │
└──────────────────┘                    └──────────────────┘
```

**Data Flow:**

1. **Input:** JavaScript string copied to WASM linear memory
2. **Processing:** WASM parses CSV entirely in linear memory
3. **Output:** JSON string copied back to JavaScript heap
4. **Cleanup:** WASM memory automatically freed after parsing

**Memory Efficiency:**
- Input string: Temporary copy in WASM memory
- Parsing state: Small (few KB), constant size
- Output: JSON string (similar size to input)
- **Total overhead:** ~2x input size during parsing

---

### Memory Limits

WASM respects the same `maxBufferSize` limit as JavaScript:

```typescript
const lexer = new CSVLexer({ maxBufferSize: 10 * 1024 * 1024 }); // 10MB
```

**Why:**
- Prevents memory exhaustion
- Consistent behavior across implementations
- Protection against malicious input

---

## Performance Characteristics

### Speed Comparison

<!-- TODO: Add actual benchmark results based on measurements -->

**General observations:**

| CSV Size | JavaScript | WASM | Performance |
|----------|-----------|------|-------------|
| 100KB | Baseline | Improved | See benchmarks |
| 1MB | Baseline | Improved | See benchmarks |
| 10MB | Baseline | Improved | See benchmarks |

**Why WASM offers improved performance:**
- Compiled to machine code (vs interpreted JavaScript)
- Efficient memory access patterns
- Optimized by LLVM compiler
- No garbage collection pauses during parsing

For actual measured performance, see [CodSpeed benchmarks](https://codspeed.io/kamiazya/web-csv-toolbox).

---

### Initialization Overhead

```typescript
// First call - slow (module loading)
await loadWASM(); // ~10-50ms

// Subsequent calls - instant (module cached)
await loadWASM(); // <1ms
```

**Break-even point:**
- Files >100KB: WASM benefits outweigh initialization overhead
- Files <100KB: JavaScript may be more efficient (no initialization overhead)

---

### Memory Usage

Both implementations have similar memory usage:

| Stage | JavaScript | WASM |
|-------|-----------|------|
| Input | String (in heap) | String (copied to linear memory) |
| Parsing | CSVLexer buffer (~10MB max) | Parsing state (~10MB max) |
| Output | Objects (in heap) | JSON string → Objects |

**Total:** WASM uses ~2x input size temporarily, same as JavaScript.

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
- ✅ Improved performance (compiled code)
- ❌ Blocks main thread during parsing
- Use case: Server-side parsing, small to medium files

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
- ✅ Improved performance (compiled code)
- ✅ Best for large files
- Use case: Browser applications, large files

---

## Limitations and Trade-offs

### UTF-8 Only

**Limitation:**
WASM parser only supports UTF-8 encoded strings.

**Why:**
- Simplifies implementation
- UTF-8 is the web standard
- Smaller WASM binary size

**Workaround:**
For non-UTF-8 encodings, the router automatically falls back to JavaScript:

```typescript
// Automatic fallback for Shift-JIS
for await (const record of parse(csv, {
  engine: { wasm: true },
  charset: 'shift-jis' // Falls back to JavaScript
})) {
  console.log(record);
}
```

---

### Double-Quote Only

**Limitation:**
WASM parser only supports double-quote (`"`) as quotation character.

**Why:**
- Simplifies state machine
- Double-quote is CSV standard (RFC 4180)
- Smaller WASM binary size

**Workaround:**
For single-quote CSVs, use JavaScript parser:

```typescript
for await (const record of parse(csv, {
  engine: { wasm: false },
  quotation: "'"
})) {
  console.log(record);
}
```

---

### No Streaming

**Limitation:**
WASM parser processes the entire CSV string at once (not streaming).

**Why:**
- Simpler implementation
- Better performance for complete strings
- Avoids complex state management across calls

**Impact:**
- Memory usage proportional to file size
- Not suitable for unbounded streams
- Fine for files up to ~100MB

**Workaround:**
For streaming, the JavaScript implementation supports chunk-by-chunk parsing:

```typescript
const lexer = new CSVLexer();

for (const chunk of chunks) {
  for (const token of lexer.lex(chunk, true)) {
    // Process tokens incrementally
  }
}

lexer.flush();
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
┌──────────────────┐              ┌──────────────────┐
│ Fallback to JS   │              │ Check: UTF-8?    │
└──────────────────┘              └──────────────────┘
                                          ↓ No         ↓ Yes
                                  ┌──────────────┐  ┌──────────────┐
                                  │ Fallback     │  │ Check:       │
                                  │ to JS        │  │ Double-quote?│
                                  └──────────────┘  └──────────────┘
                                                          ↓ No      ↓ Yes
                                                    ┌──────────┐  ┌──────────┐
                                                    │ Fallback │  │ Use WASM │
                                                    │ to JS    │  └──────────┘
                                                    └──────────┘
```

**Fallback scenarios:**
1. WASM module not loaded (`loadWASM()` not called)
2. Non-UTF-8 encoding specified
3. Single-quote quotation character specified
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
const lexer = new CSVLexer({ maxBufferSize: 10 * 1024 * 1024 });
```

**Why:**
- Prevents memory exhaustion
- Protection against CSV bombs
- Consistent security model

---

## Browser and Runtime Support

WASM is supported across all modern runtimes:

| Runtime | WASM Support | Notes |
|---------|--------------|-------|
| Chrome | ✅ | Full support |
| Firefox | ✅ | Full support |
| Edge | ✅ | Full support |
| Safari | ✅ | Full support |
| Node.js LTS | ✅ | Full support |
| Deno LTS | ✅ | Full support |

**Browser API Support:**
- **WebAssembly**: [Can I Use](https://caniuse.com/wasm) | [MDN](https://developer.mozilla.org/en-US/docs/WebAssembly)

See: [Supported Environments](../reference/supported-environments.md)

---

## Build Process

### WASM Compilation

The WASM module is built from Rust source code:

```bash
# Compile Rust to WASM
wasm-pack build --target web

# Optimize WASM binary
wasm-opt -O3 -o output.wasm input.wasm

# Generate TypeScript bindings
wasm-bindgen --target web
```

**Output:**
- `web_csv_toolbox_wasm_bg.wasm` - WASM binary
- `web_csv_toolbox_wasm.js` - JavaScript glue code
- `web_csv_toolbox_wasm.d.ts` - TypeScript definitions

---

### Bundle Integration

The WASM binary is bundled with the npm package:

```text
web-csv-toolbox/
├── dist/
│   ├── index.js                          # Main entry point
│   ├── loadWASM.js                       # WASM loader
│   └── wasm/
│       ├── web_csv_toolbox_wasm_bg.wasm  # WASM binary
│       ├── web_csv_toolbox_wasm.js       # Glue code
│       └── web_csv_toolbox_wasm.d.ts     # Types
```

**Bundler support:**
- Webpack: Automatically handles WASM
- Vite: Built-in WASM support
- Rollup: Requires `@rollup/plugin-wasm`

---

## Related Documentation

- **[Using WebAssembly Tutorial](../tutorials/using-webassembly.md)** - Getting started with WASM
- **[WASM Performance Optimization](../how-to-guides/wasm-performance-optimization.md)** - Optimization techniques
- **[WASM API Reference](../reference/api/wasm.md)** - API documentation
- **[Execution Strategies](./execution-strategies.md)** - Understanding execution modes

---

## Summary

web-csv-toolbox's WebAssembly implementation provides:

1. **Performance**: Improved speed through compiled code
2. **Portability**: Runs on all modern browsers and runtimes
3. **Safety**: Memory-safe, sandboxed execution
4. **Flexibility**: Optional, automatic fallback to JavaScript
5. **Integration**: Works with Worker Threads for maximum performance

**Trade-offs:**
- UTF-8 only (no Shift-JIS, EUC-JP, etc.)
- Double-quote only (no single-quote)
- No streaming (processes entire string at once)
- Initialization overhead (~10-50ms)

**Recommendation:** Use WASM for large UTF-8 CSV files (>100KB) where performance is critical.

**Performance:** See [CodSpeed benchmarks](https://codspeed.io/kamiazya/web-csv-toolbox) for actual measured performance.
