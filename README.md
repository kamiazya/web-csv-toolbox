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

- **Deno:** ✅ Verified ([CI](https://github.com/kamiazya/web-csv-toolbox/actions/workflows/deno.yaml))
- **CDN:** ✅ Available via [unpkg.com](https://unpkg.com/web-csv-toolbox)

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
