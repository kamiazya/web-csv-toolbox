---
title: Package Exports Reference
group: Reference
---

# Package Exports Reference

## Main Exports

### `web-csv-toolbox` (Default - Full Features)

```typescript
import { parseString, EnginePresets, /* ... */ } from 'web-csv-toolbox';
```

**Resolves to**: platform-specific builds
- **Browser**: `./dist/main.web.js`
- **Node.js**: `./dist/main.node.js`

**Exports**:
- All parsing functions (`parseString`, `parseBinary`, etc.)
- Engine configuration (`EnginePresets`)
  - `EnginePresets.stable()` - Stability optimized
  - `EnginePresets.responsive()` - UI responsiveness optimized
  - `EnginePresets.memoryEfficient()` - Memory efficiency optimized
  - `EnginePresets.fast()` - Parse speed optimized
  - `EnginePresets.responsiveFast()` - UI responsiveness + parse speed optimized
  - `EnginePresets.balanced()` - Balanced (general-purpose)
- Low-level APIs (see [Low-level API Reference](#low-level-api-reference) below)
  - **Parser Models (Tier 1)**: `FlexibleStringObjectCSVParser`, `FlexibleStringArrayCSVParser`, `FlexibleBinaryObjectCSVParser`, `FlexibleBinaryArrayCSVParser`, `createStringCSVParser`, `createBinaryCSVParser`, `StringCSVParserStream`, `BinaryCSVParserStream`
  - **Lexer + Assembler (Tier 2)**: `FlexibleStringCSVLexer`, `createStringCSVLexer`, `FlexibleCSVRecordAssembler`, `createCSVRecordAssembler`, `StringCSVLexerTransformer`, `CSVRecordAssemblerTransformer`
- Worker management (`WorkerPool`, `WorkerSession`)
- WASM utilities (`loadWASM`, `isWASMReady`, `parseStringToArraySyncWASM`)

**Characteristics**:
- ✅ Automatic WASM initialization on first use (not at import time)
- 💡 Optional preloading via `loadWASM()` reduces first‑parse latency
- ⚠️ Larger bundle size (WASM embedded as base64)

### `web-csv-toolbox/slim` (Slim Entry - Smaller Bundle)

```typescript
import { parseString, loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox/slim';
```

**Resolves to**: platform-specific builds
- **Browser**: `./dist/slim.web.js`
- **Node.js**: `./dist/slim.node.js`

**Exports**:
- All parsing functions (same as main)
- Engine configuration (same as main)
- Low-level APIs (same as main)
- Worker management (same as main)
- WASM utilities with **manual initialization required**:
  - `loadWASM()` - **Must be called before using WASM functions**
  - `isSyncInitialized()` - Check WASM initialization status
  - `parseStringToArraySyncWASM()` - Synchronous WASM parsing

**Characteristics**:
- ✅ Smaller main bundle (WASM not embedded in JavaScript)
- ✅ External WASM loading for better caching
- ❌ Requires manual `loadWASM()` call before using WASM features

**Usage pattern**:
```typescript
import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox/slim';

// Must initialize WASM before use
await loadWASM();

// Now can use WASM functions
const records = parseStringToArraySyncWASM(csv);
```

## Worker Export

### `web-csv-toolbox/worker`

Environment-specific Worker implementation.

**Node.js**:
```typescript
// Resolves to: ./dist/worker.node.js
import workerUrl from 'web-csv-toolbox/worker';
```

**Browser**:
```typescript
// Resolves to: ./dist/worker.web.js
import workerUrl from 'web-csv-toolbox/worker';
```

**Usage with bundlers**:

```typescript
// Vite
import workerUrl from 'web-csv-toolbox/worker?url';

// Webpack
const workerUrl = new URL('web-csv-toolbox/worker', import.meta.url);
```

## Conditional Exports

The `./worker` export uses Node.js conditional exports:

| Condition | File | Environment |
|-----------|------|-------------|
| `node` | `worker.node.js` | Node.js (Worker Threads) |
| `browser` | `worker.web.js` | Browser (Web Workers) |
| `default` | `worker.web.js` | Deno, other environments |

## WASM Export

### `web-csv-toolbox/csv.wasm`

```typescript
import wasmUrl from 'web-csv-toolbox/csv.wasm';
```

**Resolves to**: `./dist/csv.wasm`

Pre-compiled WebAssembly module for high-performance CSV parsing.

**Do you need this?**

**No, in most cases.** The library automatically loads the WASM module when you use WASM-enabled features:

```typescript
import { parse, loadWASM } from 'web-csv-toolbox';

// WASM module is automatically loaded
await loadWASM();

// Just use the API - WASM file is handled internally
for await (const record of parse(csv, {
  engine: { wasm: true }
})) {
  console.log(record);
}
```

**Current limitations:**

⚠️ The WASM module is currently embedded as base64 in the JavaScript bundle for automatic initialization. Importing `csv.wasm` separately does **not** reduce bundle size in the current architecture.

**Potential future use cases:**

When combined with future distribution improvements, this export could enable:

1. **Separate caching strategy**: Cache WASM file independently from JavaScript
2. **CDN hosting**: Host WASM on a different domain or CDN
3. **Service worker pre-caching**: Pre-cache WASM for offline use
4. **Custom loading strategies**: Implement lazy-loading or conditional loading

**See**: [Package Exports Explanation](../explanation/package-exports.md#3-wasm-module-web-csv-toolboxcsvwasm) for detailed discussion of current limitations and future improvements.

## Low-level API Reference

The library exports a 3-tier architecture for low-level CSV parsing:

### Tier 1: Parser Models (Simplified Composition)

**Recommended for most custom parsing needs.** Combines Lexer + Assembler internally.

#### String Parsing

- **`createStringCSVParser(options?)`** - Factory function for creating format-specific parsers
  - **Returns**: `FlexibleStringObjectCSVParser` (default) or `FlexibleStringArrayCSVParser`
  - **Options**: `CSVProcessingOptions` (no `engine` option)
  - **Use case**: Stateful parsing with streaming support
  - **Example**:
    ```typescript
    import { createStringCSVParser } from 'web-csv-toolbox';

    // Object format (default)
    const objectParser = createStringCSVParser({
      header: ['name', 'age'] as const
    });
    const records = objectParser.parse('Alice,30\nBob,25\n');
    // records: [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]

    // Array format
    const arrayParser = createStringCSVParser({
      header: ['name', 'age'] as const,
      outputFormat: 'array'
    });
    const arrayRecords = arrayParser.parse('Alice,30\nBob,25\n');
    // arrayRecords: [['Alice', '30'], ['Bob', '25']]
    ```

- **Direct class usage** (format-specific):
  - **`FlexibleStringObjectCSVParser`** - Always outputs object records
  - **`FlexibleStringArrayCSVParser`** - Always outputs array records

- **`StringCSVParserStream`** - TransformStream for string CSV parsing
  - **Use case**: Stream-based parsing with backpressure handling
  - **Example**:
    ```typescript
    import { createStringCSVParser, StringCSVParserStream } from 'web-csv-toolbox';

    const parser = createStringCSVParser({ header: ['name', 'age'] as const });
    const stream = new StringCSVParserStream(parser);

    await stringStream.pipeThrough(stream).pipeTo(yourSink);
    ```

#### Binary Parsing

- **`createBinaryCSVParser(options?)`** - Factory function for creating format-specific binary parsers
  - **Returns**: `FlexibleBinaryObjectCSVParser` (default) or `FlexibleBinaryArrayCSVParser`
  - **Options**: `BinaryCSVProcessingOptions` (no `engine` option)
  - **Use case**: Parse Uint8Array, ArrayBuffer, or other TypedArray with charset handling
  - **Example**:
    ```typescript
    import { createBinaryCSVParser } from 'web-csv-toolbox';

    // Object format (default)
    const objectParser = createBinaryCSVParser({
      header: ['name', 'age'] as const,
      charset: 'utf-8'
    });
    const buffer = await fetch('data.csv').then(r => r.arrayBuffer());
    const records = objectParser.parse(buffer);
    // records: [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]

    // Array format
    const arrayParser = createBinaryCSVParser({
      header: ['name', 'age'] as const,
      outputFormat: 'array',
      charset: 'utf-8'
    });
    const arrayRecords = arrayParser.parse(buffer);
    // arrayRecords: [['Alice', '30'], ['Bob', '25']]
    ```

- **Direct class usage** (format-specific):
  - **`FlexibleBinaryObjectCSVParser`** - Always outputs object records
  - **`FlexibleBinaryArrayCSVParser`** - Always outputs array records

- **`BinaryCSVParserStream`** - TransformStream for binary CSV parsing
  - **Use case**: Stream-based binary parsing with automatic charset decoding
  - **Example**:
    ```typescript
    import { createBinaryCSVParser, BinaryCSVParserStream } from 'web-csv-toolbox';

    const parser = createBinaryCSVParser({
      header: ['name', 'age'] as const,
      charset: 'utf-8'
    });
    const stream = new BinaryCSVParserStream(parser);

    await fetch('data.csv')
      .then(res => res.body)
      .pipeThrough(stream)
      .pipeTo(yourSink);
    ```

### Tier 2: Lexer + Assembler (Advanced Control)

**For advanced use cases** requiring fine-grained control over tokenization and record assembly.

#### Lexer

- **`FlexibleStringCSVLexer`** - CSV tokenizer
  - **Factory**: `createStringCSVLexer(options?)` - Create lexer instance
  - **Use case**: Custom tokenization logic
  - **Example**:
    ```typescript
    import { createStringCSVLexer } from 'web-csv-toolbox';

    const lexer = createStringCSVLexer({ delimiter: '\t' });
    const tokens = lexer.lex('name\tage\nAlice\t30');
    ```

- **`StringCSVLexerTransformer`** - TransformStream for CSV tokenization
  - **Use case**: Stream-based tokenization

#### Assembler

- **`FlexibleCSVRecordAssembler`** - Token-to-record assembler
  - **Factory**: `createCSVRecordAssembler(options?)` - Create assembler instance
  - **Use case**: Custom record assembly logic
  - **Example**:
    ```typescript
    import { createStringCSVLexer, createCSVRecordAssembler } from 'web-csv-toolbox';

    const lexer = createStringCSVLexer();
    const assembler = createCSVRecordAssembler({ header: ['name', 'age'] });

    const tokens = lexer.lex('Alice,30\nBob,25');
    const records = [...assembler.assemble(tokens)];
    ```

- **`CSVRecordAssemblerTransformer`** - TransformStream for record assembly
  - **Use case**: Stream-based record assembly

### Tier 3: Custom Implementation

Build completely custom parsers using the primitives above. See [Custom CSV Parser Guide](../how-to-guides/custom-csv-parser.md) for details.

## Package Metadata

### `web-csv-toolbox/package.json`

```typescript
import pkg from 'web-csv-toolbox/package.json';
```

**Resolves to**: `./package.json`

Access to package metadata (version, etc.).

## TypeScript Types

All exports include TypeScript declarations:

```json
{
  "exports": {
    ".": {
      "types": "./dist/web-csv-toolbox.d.ts",
      "default": "./dist/web-csv-toolbox.js"
    },
    "./worker": {
      "node": {
        "types": "./dist/worker.node.d.ts",
        "default": "./dist/worker.node.js"
      }
      // ...
    }
  }
}
```

## See Also

- [Engine Presets Reference](./engine-presets.md) - Detailed preset configuration guide
- [Package Exports Explanation](../explanation/package-exports.md) - How conditional exports work
- [How to Use with Bundlers](../how-to-guides/using-with-bundlers.md) - Practical bundler integration
