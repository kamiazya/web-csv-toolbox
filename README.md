<div align="center">

[![npm version](https://badge.fury.io/js/web-csv-toolbox.svg)](https://badge.fury.io/js/web-csv-toolbox)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
![node version](https://img.shields.io/node/v/web-csv-toolbox)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fkamiazya%2Fweb-csv-toolbox.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fkamiazya%2Fweb-csv-toolbox?ref=badge_shield)

![npm package minimized gzipped size](https://img.shields.io/bundlejs/size/web-csv-toolbox)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/kamiazya/web-csv-toolbox)
![npm](https://img.shields.io/npm/dm/web-csv-toolbox)
[![codecov](https://codecov.io/gh/kamiazya/web-csv-toolbox/graph/badge.svg?token=8RbDcXHTFl)](https://codecov.io/gh/kamiazya/web-csv-toolbox)

# `🌐 web-csv-toolbox 🧰`

A CSV Toolbox utilizing Web Standard APIs.

🔗

[![GitHub](https://img.shields.io/badge/-GitHub-181717?logo=GitHub&style=flat)](https://github.com/kamiazya/web-csv-toolbox)
[![npm](https://img.shields.io/badge/-npm-CB3837?logo=npm&style=flat)](https://www.npmjs.com/package/web-csv-toolbox)
[![API Reference](https://img.shields.io/badge/-API%20Reference-3178C6?logo=TypeScript&style=flat&logoColor=fff)](https://kamiazya.github.io/web-csv-toolbox/)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/kamiazya/web-csv-toolbox)
[![Sponsor](https://img.shields.io/badge/-GitHub%20Sponsor-fff?logo=GitHub%20Sponsors&style=flat)](https://github.com/sponsors/kamiazya)
[![CodSpeed Badge](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://codspeed.io/kamiazya/web-csv-toolbox)

[![format: Biome](https://img.shields.io/badge/format%20with-Biome-F7B911?logo=biome&style=flat)](https://biomejs.dev/)
[![test: Vitest](https://img.shields.io/badge/tested%20with-Vitest-6E9F18?logo=vitest&style=flat)](https://vitest.dev/)
[![build: Vite](https://img.shields.io/badge/build%20with-Vite-646CFF?logo=vite&style=flat)](https://rollupjs.org/)

<a href="https://flatt.tech/oss/gmo/trampoline" target="_blank"><img src="https://flatt.tech/assets/images/badges/gmo-oss.svg" height="24px" alt="GMO OSS support"/></a>

</div>

---

## Key Concepts ✨

- 🌐 **Web Standards first** - Utilizing Web Standards APIs like [Web Streams API](https://developer.mozilla.org/en/docs/Web/API/Streams_API)
- ❤️ **TypeScript friendly & User friendly** - Fully typed and documented
- 0️⃣ **Zero dependencies** - Using only Web Standards APIs
- 💪 **Property-based testing** - Using [fast-check](https://fast-check.dev/) and [vitest](https://vitest.dev)
- ✅ **Cross-platform** - Works on browsers, Node.js, and Deno

## Key Features 📗

- 🌊 **Efficient CSV Parsing with Streams** - Memory-efficient processing using Web Streams API
- 🛑 **AbortSignal and Timeout Support** - Cancellable operations with automatic timeouts
- 🛡️ **Memory Safety Protection** - Built-in limits prevent memory exhaustion attacks
- 🎨 **Flexible Source Support** - Parse from `string`, `ReadableStream`, or `Response`
- ⚙️ **Advanced Parsing Options** - Customize delimiters, quotation marks, and more
- 💾 **Specialized Binary CSV Parsing** - BOM handling, compression support, charset specification
- 🚀 **Flexible Execution Strategies** - Worker Threads, WebAssembly, or combined (_Experimental_)
- 📦 **Lightweight and Zero Dependencies** - No external dependencies
- 📚 **Fully Typed and Documented** - Complete TypeScript support and [TypeDoc](https://typedoc.org/) documentation

## Quick Start 🚀

### Installation

```bash
# npm
npm install web-csv-toolbox

# yarn
yarn add web-csv-toolbox

# pnpm
pnpm add web-csv-toolbox
```

### Basic Usage

```typescript
import { parse } from 'web-csv-toolbox';

const csv = `name,age,city
Alice,30,New York
Bob,25,San Francisco`;

for await (const record of parse(csv)) {
  console.log(record);
}
// { name: 'Alice', age: '30', city: 'New York' }
// { name: 'Bob', age: '25', city: 'San Francisco' }
```

### Fetch from URL

```typescript
import { parse } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv');

for await (const record of parse(response)) {
  console.log(record);
}
```

### With Worker Threads (Performance)

```typescript
import { parse, EnginePresets } from 'web-csv-toolbox';

// Non-blocking UI, good for large files
for await (const record of parse(csv, {
  engine: EnginePresets.balanced()
})) {
  console.log(record);
  // UI stays responsive!
}
```

### Working with Headerless CSV Files

Some CSV files don't include a header row. You can provide custom headers manually:

```typescript
import { parse } from 'web-csv-toolbox';

// Example: Sensor data without headers
const sensorData = `25.5,60,1024
26.1,58,1020
24.8,62,1025`;

// Provide headers explicitly
for await (const record of parse(sensorData, {
  header: ['temperature', 'humidity', 'pressure']
})) {
  console.log(`Temp: ${record.temperature}°C, Humidity: ${record.humidity}%, Pressure: ${record.pressure} hPa`);
}
// Output:
// Temp: 25.5°C, Humidity: 60%, Pressure: 1024 hPa
// Temp: 26.1°C, Humidity: 58%, Pressure: 1020 hPa
// Temp: 24.8°C, Humidity: 62%, Pressure: 1025 hPa
```

## Documentation 📖

Our documentation follows the [Diátaxis framework](https://diataxis.fr/) to help you find what you need:

### 📚 Tutorials - Learn by doing
Step-by-step guides to get you started:
- **[Getting Started](./docs/tutorials/getting-started.md)** - Your first CSV parser (10 min)
- **[Working with Workers](./docs/tutorials/working-with-workers.md)** - Performance optimization with worker threads (15 min)
- **[Using WebAssembly](./docs/tutorials/using-webassembly.md)** - High-performance parsing with WASM (15 min)

### 🔧 How-To Guides - Solve specific problems
Practical guides for common tasks:
- **[Choosing the Right API](./docs/how-to-guides/choosing-the-right-api.md)** - Select the best API for your use case
- **[Secure CSV Processing](./docs/how-to-guides/secure-csv-processing.md)** - Protect against DoS attacks (⚠️ Critical for production)
- **[Custom CSV Parser](./docs/how-to-guides/custom-csv-parser.md)** - Build custom parsers with low-level APIs
- **[WASM Performance Optimization](./docs/how-to-guides/wasm-performance-optimization.md)** - Maximize WASM parsing performance

### 📖 Reference - Technical information
Detailed API documentation:
- **[Engine Presets](./docs/reference/engine-presets.md)** - Pre-configured engine settings
- **[Engine Configuration](./docs/reference/engine-config.md)** - Complete configuration reference
- **[Supported Environments](./docs/reference/supported-environments.md)** - Runtime and browser compatibility
- **[Versioning Policy](./docs/reference/versioning-policy.md)** - Semantic versioning strategy
- **High-level API Reference:**
  - **[parse()](./docs/reference/api/parse.md)** - Universal CSV parser (beginner-friendly)
- **Low-level API Reference:**
  - **[Lexer](./docs/reference/api/lexer.md)** - Tokenize CSV text
  - **[LexerTransformer](./docs/reference/api/lexer-transformer.md)** - Streaming tokenization
  - **[RecordAssembler](./docs/reference/api/record-assembler.md)** - Convert tokens to records
  - **[RecordAssemblerTransformer](./docs/reference/api/record-assembler-transformer.md)** - Streaming record assembly
  - **[WorkerPool](./docs/reference/api/worker-pool.md)** - Worker pool management API
  - **[WebAssembly](./docs/reference/api/wasm.md)** - WASM API reference
- **[API Documentation](https://kamiazya.github.io/web-csv-toolbox/)** - Full TypeDoc API reference

### 💡 Explanation - Understand the concepts
Deep dives into design and architecture:
- **[Parsing Architecture](./docs/explanation/parsing-architecture.md)** - Understanding the two-stage pipeline
- **[Execution Strategies](./docs/explanation/execution-strategies.md)** - How different strategies work
- **[Worker Pool Architecture](./docs/explanation/worker-pool-architecture.md)** - Understanding worker pool design
- **[WebAssembly Architecture](./docs/explanation/webassembly-architecture.md)** - How WASM achieves high performance
- **[Security Model](./docs/explanation/security-model.md)** - Understanding the security architecture

## Security ⚠️

**Critical:** When processing user-uploaded CSV files, always implement resource limits to prevent DoS attacks.

```typescript
import { WorkerPool, EnginePresets, parseStringStream } from 'web-csv-toolbox';

// Limit concurrent workers to prevent resource exhaustion
const pool = new WorkerPool({ maxWorkers: 4 });

app.post('/validate-csv', async (c) => {
  // Early rejection if pool is saturated
  if (pool.isFull()) {
    return c.json({ error: 'Service busy' }, 503);
  }

  const csvStream = c.req.raw.body?.pipeThrough(new TextDecoderStream());

  for await (const record of parseStringStream(csvStream, {
    engine: EnginePresets.balanced({ workerPool: pool })
  })) {
    // Process securely...
  }
});
```

📖 **See [SECURITY.md](./SECURITY.md) for our security policy and [How-To: Secure CSV Processing](./docs/how-to-guides/secure-csv-processing.md) for implementation details.**

## Supported Runtimes 💻

### Node.js

| Version | Status |
|---------|--------|
| 20.x    | ✅     |
| 22.x    | ✅     |
| 24.x    | ✅     |

### Browsers

| OS      | Chrome | Firefox | Edge | Safari |
|---------|--------|---------|------|--------|
| Windows | ✅     | ✅      | ✅   | -      |
| macOS   | ✅     | ✅      | ✅   | ⬜*    |
| Linux   | ✅     | ✅      | ✅   | -      |

> **\* Safari:** Basic functionality works. Transferable Streams not supported (auto-falls back to message-streaming).

### Others

- **Deno:** ✅ Verified [![Deno CI](https://github.com/kamiazya/web-csv-toolbox/actions/workflows/deno.yaml/badge.svg)](https://github.com/kamiazya/web-csv-toolbox/actions/workflows/deno.yaml)
- **CDN:** ✅ Available via [unpkg.com](https://unpkg.com/web-csv-toolbox)

## APIs 🧑‍💻

### High-level APIs 🚀

These APIs are designed for **Simplicity and Ease of Use**,
providing an intuitive and straightforward experience for users.

- **`function parse(input[, options]): AsyncIterableIterator<CSVRecord>`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parse-1.html)
  - Parses various CSV input formats into an asynchronous iterable of records.
- **`function parse.toArray(input[, options]): Promise<CSVRecord[]>`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parse.toArray.html)
  - Parses CSV input into an array of records, ideal for smaller data sets.

The `input` paramater can be a `string`, a [ReadableStream](https://developer.mozilla.org/docs/Web/API/ReadableStream)
of `string`s or [Uint8Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)s,
or a [Uint8Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array) object,
or a [ArrayBuffer](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) object,
or a [Response](https://developer.mozilla.org/docs/Web/API/Response) object.

### Middle-level APIs 🧱

These APIs are optimized for **Enhanced Performance and Control**,
catering to users who need more detailed and fine-tuned functionality.

- **`function parseString(string[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseString-1.html)
  - Efficient parsing of CSV strings.
- **`function parseBinary(buffer[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseBinary-1.html)
  - Parse CSV Binary of ArrayBuffer or Uint8Array.
- **`function parseResponse(response[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseResponse-1.html)
  - Customized parsing directly from `Response` objects.
- **`function parseStream(stream[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseStream-1.html)
  - Stream-based parsing for larger or continuous data.
- **`function parseStringStream(stream[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseStringStream-1.html)
  - Combines string-based parsing with stream processing.
- **`function parseUint8ArrayStream(stream[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseUint8ArrayStream-1.html)
  - Parses binary streams with precise control over data types.

### Low-level APIs ⚙️

These APIs are built for **Advanced Customization and Pipeline Design**,
ideal for developers looking for in-depth control and flexibility.

- **`class CSVLexerTransformer`**: [📑](https://kamiazya.github.io/web-csv-toolbox/classes/CSVLexerTransformer.html)
  - A TransformStream class for lexical analysis of CSV data.
  - Supports custom queuing strategies for controlling backpressure and memory usage.
- **`class CSVRecordAssemblerTransformer`**: [📑](https://kamiazya.github.io/web-csv-toolbox/classes/CSVRecordAssemblerTransformer.html)
  - Handles the assembly of parsed data into records.
  - Supports custom queuing strategies for controlling backpressure and memory usage.

#### Customizing Queuing Strategies

Both `CSVLexerTransformer` and `CSVRecordAssemblerTransformer` support custom queuing strategies following the Web Streams API pattern. Strategies are passed as constructor arguments with **data-type-aware size counting** and **configurable backpressure handling**.

**Constructor signature:**
```typescript
new CSVLexerTransformer(options?, writableStrategy?, readableStrategy?)
new CSVRecordAssemblerTransformer(options?, writableStrategy?, readableStrategy?)
```

**Default queuing strategies (starting points, not benchmarked):**
```typescript
// CSVLexerTransformer defaults
writableStrategy: {
  highWaterMark: 65536,           // 64KB of characters
  size: (chunk) => chunk.length,  // Count by string length
  checkInterval: 100              // Check backpressure every 100 tokens
}
readableStrategy: {
  highWaterMark: 1024,              // 1024 tokens
  size: (tokens) => tokens.length,  // Count by number of tokens
  checkInterval: 100                // Check backpressure every 100 tokens
}

// CSVRecordAssemblerTransformer defaults
writableStrategy: {
  highWaterMark: 1024,              // 1024 tokens
  size: (tokens) => tokens.length,  // Count by number of tokens
  checkInterval: 10                 // Check backpressure every 10 records
}
readableStrategy: {
  highWaterMark: 256,     // 256 records
  size: () => 1,          // Each record counts as 1
  checkInterval: 10       // Check backpressure every 10 records
}
```

**Key Features:**

🎯 **Smart Size Counting:**
- Character-based counting for string inputs (accurate memory tracking)
- Token-based counting between transformers (smooth pipeline flow)
- Record-based counting for output (intuitive and predictable)

⚡ **Cooperative Backpressure:**
- Monitors `controller.desiredSize` during processing
- Yields to event loop when backpressure detected
- Prevents blocking the main thread
- Critical for browser UI responsiveness

🔧 **Tunable Check Interval:**
- `checkInterval`: How often to check for backpressure
- Lower values (5-25): More responsive, slight overhead
- Higher values (100-500): Less overhead, slower response
- Customize based on downstream consumer speed

> ⚠️ **Important**: These defaults are theoretical starting points based on data flow characteristics, **not empirical benchmarks**. Optimal values vary by runtime (browser/Node.js/Deno), file size, memory constraints, and CPU performance. **Profile your specific use case** to find the best values.

**When to customize:**
- 🚀 **High-throughput servers**: Higher `highWaterMark` (128KB+, 2048+ tokens), higher `checkInterval` (200-500)
- 📱 **Memory-constrained environments**: Lower `highWaterMark` (16KB, 256 tokens), lower `checkInterval` (10-25)
- 🐌 **Slow consumers** (DB writes, API calls): Lower `highWaterMark`, lower `checkInterval` for responsive backpressure
- 🏃 **Fast processing**: Higher values to reduce overhead

**Example - High-throughput server:**
```typescript
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

const response = await fetch('large-dataset.csv');
await response.body
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new CSVLexerTransformer(
    {},
    {
      highWaterMark: 131072,          // 128KB
      size: (chunk) => chunk.length,
      checkInterval: 200              // Less frequent checks
    },
    {
      highWaterMark: 2048,            // 2048 tokens
      size: (tokens) => tokens.length,
      checkInterval: 100
    }
  ))
  .pipeThrough(new CSVRecordAssemblerTransformer(
    {},
    {
      highWaterMark: 2048,            // 2048 tokens
      size: (tokens) => tokens.length,
      checkInterval: 20
    },
    {
      highWaterMark: 512,             // 512 records
      size: () => 1,
      checkInterval: 10
    }
  ))
  .pipeTo(yourRecordProcessor);
```

**Example - Slow consumer (API writes):**
```typescript
await csvStream
  .pipeThrough(new CSVLexerTransformer())  // Use defaults
  .pipeThrough(new CSVRecordAssemblerTransformer(
    {},
    { highWaterMark: 512, size: (t) => t.length, checkInterval: 5 },
    { highWaterMark: 64, size: () => 1, checkInterval: 2 }  // Very responsive
  ))
  .pipeTo(new WritableStream({
    async write(record) {
      await fetch('/api/save', { method: 'POST', body: JSON.stringify(record) });
    }
  }));
```

**Benchmarking:**
Use the provided benchmark tool to find optimal values for your use case:
```bash
pnpm --filter web-csv-toolbox-benchmark queuing-strategy
```

See `benchmark/queuing-strategy.bench.ts` for implementation details.

### Experimental APIs 🧪

These APIs are experimental and may change in the future.

#### Parsing using WebAssembly for high performance.

You can use WebAssembly to parse CSV data for high performance.

- Parsing with WebAssembly is faster than parsing with JavaScript,
but it takes time to load the WebAssembly module.
- Supports only UTF-8 encoding csv data.
- Quotation characters are only `"`. (Double quotation mark)
  - If you pass a different character, it will throw an error.

```ts
import { loadWASM, parseStringWASM } from "web-csv-toolbox";

// load WebAssembly module
await loadWASM();

const csv = "a,b,c\n1,2,3";

// parse CSV string
const result = parseStringToArraySyncWASM(csv);
console.log(result);
// Prints:
// [{ a: "1", b: "2", c: "3" }]
```

- **`function loadWASM(): Promise<void>`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/loadWASM.html)
  - Loads the WebAssembly module.
- **`function parseStringToArraySyncWASM(string[, options]): CSVRecord[]`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseStringToArraySyncWASM.html)
  - Parses CSV strings into an array of records.

## Options Configuration 🛠️

### Common Options ⚙️

| Option           | Description                           | Default      | Notes                                                                              |
| ---------------- | ------------------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `delimiter`      | Character to separate fields          | `,`          |                                                                                    |
| `quotation`      | Character used for quoting fields     | `"`          |                                                                                    |
| `maxBufferSize`  | Maximum internal buffer size (characters)  | `10 * 1024 * 1024`   | Set to `Number.POSITIVE_INFINITY` to disable (not recommended for untrusted input). Measured in UTF-16 code units. |
| `maxFieldCount`  | Maximum fields allowed per record     | `100000`     | Set to `Number.POSITIVE_INFINITY` to disable (not recommended for untrusted input) |
| `headers`        | Custom headers for the parsed records | First row    | If not provided, the first row is used as headers                                  |
| `signal`         | AbortSignal to cancel processing      | `undefined`  | Allows aborting of long-running operations                                         |

### Advanced Options (Binary-Specific) 🧬

| Option                            | Description                                       | Default | Notes                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `charset`                         | Character encoding for binary CSV inputs          | `utf-8` | See [Encoding API Compatibility](https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API/Encodings) for the encoding formats that can be specified. |
| `maxBinarySize`                   | Maximum binary size for ArrayBuffer/Uint8Array inputs (bytes) | `100 * 1024 * 1024` (100MB) | Set to `Number.POSITIVE_INFINITY` to disable (not recommended for untrusted input) |
| `decompression`                   | Decompression algorithm for compressed CSV inputs |         | See [DecompressionStream Compatibility](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream#browser_compatibilit). Supports: gzip, deflate, deflate-raw |
| `ignoreBOM`                       | Whether to ignore Byte Order Mark (BOM)           | `false` | See [TextDecoderOptions.ignoreBOM](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream/ignoreBOM) for more information about the BOM.      |
| `fatal`                           | Throw an error on invalid characters              | `false` | See [TextDecoderOptions.fatal](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream/fatal) for more information.                            |
| `allowExperimentalCompressions`   | Allow experimental/future compression formats     | `false` | When enabled, passes unknown compression formats to runtime. Use cautiously. See example below.                                                           |
>>>>>>> main

## Performance & Best Practices ⚡

### Quick Decision Guide

| File Size | Recommended Config | Reason |
|-----------|-------------------|--------|
| < 1MB | `mainThread` | No overhead needed |
| 1-10MB | `balanced` ⭐ | Good performance + compatibility |
| > 10MB (UTF-8) | `fastest` | Maximum performance with WASM |
| > 10MB (any) | `balanced` | Broad encoding support |

⭐ **`balanced`** is recommended for production applications.

### Memory Characteristics

```typescript
// ✅ Streaming: O(1) memory per record
const response = await fetch('large-data.csv');
for await (const record of parse(response)) {
  console.log(record);  // Constant memory usage
}

// ❌ Array: O(n) memory for entire file
const csv = await fetch('data.csv').then(r => r.text());
const records = await parse.toArray(csv);  // Loads all into memory
```

📖 **See [Execution Strategies](./docs/explanation/execution-strategies.md) for detailed performance analysis.**

## API Overview 🧑‍💻

### High-level APIs

Simple and beginner-friendly:
- **[parse()](./docs/reference/api/parse.md)** - Parse any CSV input (prototyping, learning)

### Middle-level APIs (Production)

Optimized for production use:
- **[parseString()](./docs/reference/api/parseString.md)** - Parse CSV string
- **[parseStringStream()](./docs/reference/api/parseStringStream.md)** - Parse text stream
- **[parseUint8ArrayStream()](./docs/reference/api/parseUint8ArrayStream.md)** - Parse binary stream
- **[parseBinary()](./docs/reference/api/parseBinary.md)** - Parse ArrayBuffer/Uint8Array
- **[parseResponse()](./docs/reference/api/parseResponse.md)** - Parse HTTP response

### Low-level APIs

Maximum customization:
- **[LexerTransformer](./docs/reference/api/lexer-transformer.md)** - Streaming tokenization
- **[RecordAssemblerTransformer](./docs/reference/api/record-assembler-transformer.md)** - Streaming record assembly
- **[Lexer](./docs/reference/api/lexer.md)** - Tokenize CSV text
- **[RecordAssembler](./docs/reference/api/record-assembler.md)** - Convert tokens to records

### Experimental APIs

- **[EnginePresets](./docs/reference/engine-presets.md)** - Pre-configured engine settings
- **[ReusableWorkerPool](./docs/reference/api/worker-pool.md#reusableworkerpool)** - Persistent worker pool for high-throughput scenarios
- **[loadWASM()](./docs/reference/api/wasm.md#loadwasm)** - Load WebAssembly module

📖 **See [API Documentation](https://kamiazya.github.io/web-csv-toolbox/) for complete reference.**

## Contributing 💪

We welcome contributions! Here's how you can help:

### ⭐ Star the Project

The easiest way to contribute is to use the library and star the [repository](https://github.com/kamiazya/web-csv-toolbox/).

### 💭 Ask Questions

Feel free to ask questions on [GitHub Discussions](https://github.com/kamiazya/web-csv-toolbox/discussions).

### 💡 Report Bugs / Request Features

Please create an issue at [GitHub Issues](https://github.com/kamiazya/web-csv-toolbox/issues/new/choose).

### 💸 Financial Support

Support the development via [GitHub Sponsors](https://github.com/sponsors/kamiazya).

> Even a small contribution provides great motivation! 😊

## License ⚖️

MIT License - see [LICENSE](./LICENSE) for details.

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fkamiazya%2Fweb-csv-toolbox.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fkamiazya%2Fweb-csv-toolbox?ref=badge_large)
