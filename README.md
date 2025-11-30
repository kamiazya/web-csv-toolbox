<div align="center">

[![npm version](https://badge.fury.io/js/web-csv-toolbox.svg)](https://badge.fury.io/js/web-csv-toolbox)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
![node version](https://img.shields.io/node/v/web-csv-toolbox)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fkamiazya%2Fweb-csv-toolbox.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fkamiazya%2Fweb-csv-toolbox?ref=badge_shield)

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

- 🌐 **Web Standards first.**
  - Utilizing the Web Standards APIs, such as the [Web Streams API](https://developer.mozilla.org/en/docs/Web/API/Streams_API).
- ❤️ **TypeScript friendly & User friendly.**
  - Fully typed and documented.
- 0️⃣ **Zero dependencies.**
  - Using only Web Standards APIs.
- 💪 **Property-based testing.**
  - Using [fast-check](https://fast-check.dev/) and [vitest](https://vitest.dev).
- ✅ **Cross-platform.**
  - Works on browsers, Node.js, and Deno.

## Key Features 📗

- 🌊 **Efficient CSV Parsing with Streams**
  - 💻 Leveraging the [WHATWG Streams API](https://streams.spec.whatwg.org/) and other Web APIs for seamless and efficient data processing.
- 🛑 **AbortSignal and Timeout Support**: Ensure your CSV processing is cancellable, including support for automatic timeouts.
  - ✋ Integrate with [`AbortController`](https://developer.mozilla.org/docs/Web/API/AbortController) to manually cancel operations as needed.
  - ⏳ Use [`AbortSignal.timeout`](https://developer.mozilla.org/docs/Web/API/AbortSignal/timeout_static) to automatically cancel operations that exceed a specified time limit.
- 🛡️ **Memory Safety Protection**: Built-in limits prevent memory exhaustion attacks.
  - 🔒 Configurable maximum buffer size (default: 10M characters) to prevent DoS attacks via unbounded input.
    - 🚨 Throws `RangeError` when buffer exceeds the limit.
  - 📊 Configurable maximum field count (default: 100,000 fields/record) to prevent excessive column attacks.
    - ⚠️ Throws `RangeError` when field count exceeds the limit.
  - 💾 Configurable maximum binary size (default: 100MB bytes) for BufferSource inputs.
    - 🛑 Throws `RangeError` when binary size exceeds the limit.
  - 📏 Configurable maximum field size (default: 10MB) to prevent memory exhaustion from oversized fields.
    - 🛑 Throws `RangeError` when a single field exceeds the limit.
- 🎨 **Flexible Source Support**
  - 🧩 Parse CSVs directly from `string`s, `ReadableStream`s, `Response` objects, `Blob`/`File` objects, or `Request` objects.
- ⚙️ **Advanced Parsing Options**: Customize your experience with various delimiters and quotation marks.
  - 🔄 Defaults to `,` and `"` respectively.
- 💾 **Specialized Binary CSV Parsing**: Leverage Stream-based processing for versatility and strength.
  - 🔄 Flexible BOM handling.
  - 🗜️ Supports various compression formats.
  - 🔤 Charset specification for diverse encoding.
- 🚀 **Using WebAssembly for High Performance**: WebAssembly is used for high performance parsing. (_Experimental_)
  - 📦 WebAssembly is used for high performance parsing.
  - ⚠️ **Experimental**: WASM automatic initialization (base64-embedded) is experimental and may change in future versions.
- 📦 **Lightweight and Zero Dependencies**: No external dependencies, only Web Standards APIs.
- 📚 **Fully Typed and Documented**: Fully typed and documented with [TypeDoc](https://typedoc.org/).

## Installation 📥

### With Package manager 📦

This package can then be installed using a package manager.

```sh
# Install with npm
$ npm install web-csv-toolbox
# Or Yarn
$ yarn add web-csv-toolbox
# Or pnpm
$ pnpm add web-csv-toolbox
```

### From CDN (unpkg.com) 🌐

```html
<script type="module">
import { parse } from 'https://unpkg.com/web-csv-toolbox';

const csv = `name,age
Alice,42
Bob,69`;

for await (const record of parse(csv)) {
  console.log(record);
}
</script>
```

#### Deno 🦕

You can install and use the package by specifying the following:

```js
import { parse } from "npm:web-csv-toolbox";
```

## Entry Points 🚪

This library provides two entry points to suit different needs:

For a deeper comparison and migration guidance, see:

- docs/explanation/main-vs-slim.md

### `web-csv-toolbox` (Default - Full Features)

**Best for**: Most users who want automatic WASM initialization and all features

```typescript
import { loadWASM, parseString } from 'web-csv-toolbox';

// Optional but recommended: preload to reduce first‑parse latency
await loadWASM();
const records = parseString.toArraySync(csv, { engine: { wasm: true } });
```

**Characteristics:**
- ✅ Full features including synchronous WASM APIs
- ✅ Automatic WASM initialization on first use (not at import time)
- 💡 Call `loadWASM()` at startup to reduce first‑parse latency (optional)
- ⚠️ **Experimental**: WASM auto-init embeds WASM as base64, may change in future
- ⚠️ Larger bundle size (WASM embedded in main bundle)

### `web-csv-toolbox/slim` (Slim Entry - Smaller Bundle)

**Best for**: Bundle size-sensitive applications and production optimization

**Browser (bundlers like Vite):**
```typescript
import { loadWASM, parseString } from 'web-csv-toolbox/slim';
import wasmUrl from 'web-csv-toolbox/csv.wasm?url'; // Vite syntax

// Manual initialization required - wasmUrl is REQUIRED in browser
await loadWASM(wasmUrl);
const records = parseString.toArraySync(csv, { engine: { wasm: true } });
```

**Node.js:**
```typescript
import { loadWASM, parseString } from 'web-csv-toolbox/slim';

// In Node.js, parameter is optional (auto-resolves via package exports)
await loadWASM();
const records = parseString.toArraySync(csv, { engine: { wasm: true } });
```

**Characteristics:**
- ✅ Smaller main bundle (WASM not embedded)
- ✅ External WASM loading for better caching
- ✅ Explicit control over initialization timing
- ❌ **Browser**: Requires `loadWASM(wasmUrl)` with explicit WASM URL
- ❌ **Node.js**: Requires `loadWASM()` call (parameter optional)

**Comparison:**

| Aspect | Main | Slim (Browser) | Slim (Node.js) |
|--------|------|----------------|----------------|
| **Initialization** | Automatic | `loadWASM(wasmUrl)` required | `loadWASM()` required |
| **Bundle Size** | Larger (WASM embedded) | Smaller (WASM external) | Smaller |
| **Caching** | Single bundle | WASM cached separately | N/A |
| **Use Case** | Convenience, prototyping | Production, bundle optimization | Production |

> **Note**: Both entry points export the same full API (feature parity). The only difference is WASM initialization strategy and bundle size.

## Usage 📘

> **Note for Bundler Users**: When using Worker-based execution strategies (e.g., `EnginePresets.responsive()`, `EnginePresets.responsiveFast()`) with bundlers like Vite or Webpack, you must explicitly specify the `workerURL` option. See the [Bundler Integration Guide](./docs/how-to-guides/using-with-bundlers.md) for configuration details.

### Parsing CSV files from strings

```js
import { parse } from 'web-csv-toolbox';

const csv = `name,age
Alice,42
Bob,69`;

for await (const record of parse(csv)) {
  console.log(record);
}
// Prints:
// { name: 'Alice', age: '42' }
// { name: 'Bob', age: '69' }
```

### Parsing CSV files from `ReadableStream`s

```js
import { parse } from 'web-csv-toolbox';

const csv = `name,age
Alice,42
Bob,69`;

const stream = new ReadableStream({
  start(controller) {
    controller.enqueue(csv);
    controller.close();
  },
});

for await (const record of parse(stream)) {
  console.log(record);
}
// Prints:
// { name: 'Alice', age: '42' }
// { name: 'Bob', age: '69' }
```

### Parsing CSV files from `Response` objects

```js
import { parse } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv');

for await (const record of parse(response)) {
  console.log(record);
}
// Prints:
// { name: 'Alice', age: '42' }
// { name: 'Bob', age: '69' }
```

### Parsing CSV files from `Blob` or `File` objects

```js
import { parse } from 'web-csv-toolbox';

// From file input
const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];

  for await (const record of parse(file)) {
    console.log(record);
  }
  // Prints:
  // { name: 'Alice', age: '42' }
  // { name: 'Bob', age: '69' }
});
```

### Parsing CSV files from `Request` objects (Server-side)

```js
import { parse } from 'web-csv-toolbox';

// Cloudflare Workers / Service Workers
export default {
  async fetch(request) {
    if (request.method === 'POST') {
      for await (const record of parse(request)) {
        console.log(record);
      }
      // Prints:
      // { name: 'Alice', age: '42' }
      // { name: 'Bob', age: '69' }

      return new Response('OK', { status: 200 });
    }
  }
};
```

### Parsing CSV files with different delimiters and quotation characters

```js
import { parse } from 'web-csv-toolbox';

const csv = `name\tage
Alice\t42
Bob\t69`;

for await (const record of parse(csv, { delimiter: '\t' })) {
  console.log(record);
}
// Prints:
// { name: 'Alice', age: '42' }
// { name: 'Bob', age: '69' }
```

### Parsing CSV files with headers

```js
import { parse } from 'web-csv-toolbox';

const csv = `Alice,42
Bob,69`;

for await (const record of parse(csv, { header: ['name', 'age'] })) {
  console.log(record);
}
// Prints:
// { name: 'Alice', age: '42' }
// { name: 'Bob', age: '69' }
```

### Working with Headerless CSV Files

Some CSV files don’t include a header row. You can provide custom headers manually:

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

### `AbortSignal` / `AbortController` Support

Support for [`AbortSignal`](https://developer.mozilla.org/docs/Web/API/AbortSignal) / [`AbortController`](https://developer.mozilla.org/docs/Web/API/AbortController), enabling you to cancel ongoing asynchronous CSV processing tasks.

This feature is useful for scenarios where processing needs to be halted, such as when a user navigates away from the page or other conditions that require stopping the task early.

#### Example Use Case: Abort with user action

```js
import { parse } from 'web-csv-toolbox';

const controller = new AbortController();
const csv = "name,age\nAlice,30\nBob,25";

try {
  // Parse the CSV data then pass the AbortSignal to the parse function
  for await (const record of parse(csv, { signal: controller.signal })) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError') {
     // The CSV processing was aborted by the user
    console.log('CSV processing was aborted by the user.');
  } else {
    // An error occurred during CSV processing
    console.error('An error occurred:', error);
  }
}

// Some abort logic, like a cancel button
document.getElementById('cancel-button')
  .addEventListener('click', () => {
    controller.abort();
  });
```

#### Example Use Case: Abort with timeout

```js
import { parse } from 'web-csv-toolbox';

// Set up a timeout of 5 seconds (5000 milliseconds)
const signal = AbortSignal.timeout(5000);

const csv = "name,age\nAlice,30\nBob,25";

try {
  // Pass the AbortSignal to the parse function
  const result = await parse.toArray(csv, { signal });
  console.log(result);
} catch (error) {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    // Handle the case where the processing was aborted due to timeout
    console.log('CSV processing was aborted due to timeout.');
  } else {
    // Handle other errors
    console.error('An error occurred during CSV processing:', error);
  }
}
```

## Supported Runtimes 💻

### Works on Node.js

| Versions | Status |
| -------- | ------ |
| 20.x     | ✅     |
| 22.x     | ✅     |
| 24.x     | ✅     |

> Note: For Node environments, the WASM loader uses `import.meta.resolve`. Node.js 20.6+ is recommended. On older Node versions, pass an explicit URL/Buffer to `loadWASM()`.


### Works on Browser

| OS      | Chrome | Firefox | Default       |
| ------- | ------ | ------- | ------------- |
| Windows | ✅     | ✅      | ✅ (Edge)     |
| macOS   | ✅     | ✅      | ⬜ (Safari *) |
| Linux   | ✅     | ✅      | -             |

> **\* Safari**: Basic functionality is expected to work, but it is not yet automatically tested in our CI environment.

### Others

- Verify that JavaScript is executable on the Deno. [![Deno CI](https://github.com/kamiazya/web-csv-toolbox/actions/workflows/deno.yaml/badge.svg)](https://github.com/kamiazya/web-csv-toolbox/actions/workflows/deno.yaml)

### Platform-Specific Usage Guide 📚

For detailed examples and best practices for your specific runtime environment, see:

**[Platform-Specific Usage Guide](./docs/how-to-guides/platform-usage/)**

This guide covers:
- 🌐 **Browser**: File input, drag-and-drop, Clipboard API, FormData, Fetch API
- 🟢 **Node.js**: Buffer, fs.ReadStream, HTTP requests, stdin/stdout
- 🦕 **Deno**: Deno.readFile, Deno.open, fetch API
- ⚡ **Edge**: Cloudflare Workers, Deno Deploy, Vercel Edge Functions
- 🐰 **Bun**: File API, HTTP server

## APIs 🧑‍💻

### High-level APIs 🚀

These APIs are designed for **Simplicity and Ease of Use**,
providing an intuitive and straightforward experience for users.

- **`function parse(input[, options]): AsyncIterableIterator<CSVRecord>`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parse-1.html)
  - Parses various CSV input formats into an asynchronous iterable of records.
- **`function parse.toArray(input[, options]): Promise<CSVRecord[]>`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parse.toArray.html)
  - Parses CSV input into an array of records, ideal for smaller data sets.

The `input` paramater can be:
- a `string`
- a [ReadableStream](https://developer.mozilla.org/docs/Web/API/ReadableStream) of `string`s or [Uint8Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array)s
- a [BufferSource](https://webidl.spec.whatwg.org/#BufferSource) ([Uint8Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array), [ArrayBuffer](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer), or other [TypedArray](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/TypedArray))
- a [Response](https://developer.mozilla.org/docs/Web/API/Response) object
- a [Blob](https://developer.mozilla.org/docs/Web/API/Blob) or [File](https://developer.mozilla.org/docs/Web/API/File) object
- a [Request](https://developer.mozilla.org/docs/Web/API/Request) object (server-side)

### Middle-level APIs 🧱

These APIs are optimized for **Enhanced Performance and Control**,
catering to users who need more detailed and fine-tuned functionality.

- **`function parseString(string[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseString-1.html)
  - Efficient parsing of CSV strings.
- **`function parseBinary(buffer[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseBinary-1.html)
  - Parse CSV binary data from BufferSource (Uint8Array, ArrayBuffer, or other TypedArray).
- **`function parseResponse(response[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseResponse-1.html)
  - Customized parsing directly from `Response` objects.
- **`function parseRequest(request[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseRequest-1.html)
  - Server-side parsing from `Request` objects (Cloudflare Workers, Service Workers, etc.).
- **`function parseBlob(blob[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseBlob-1.html)
  - Parse CSV data from `Blob` or `File` objects.
- **`function parseFile(file[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseFile-1.html)
  - Parse `File` objects with automatic filename tracking in error messages.
- **`function parseStream(stream[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseStream-1.html)
  - Stream-based parsing for larger or continuous data.
- **`function parseStringStream(stream[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseStringStream-1.html)
  - Combines string-based parsing with stream processing.
- **`function parseBinaryStream(stream[, options])`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/parseBinaryStream-1.html)
  - Parses binary streams with precise control over data types.

### Low-level APIs ⚙️

These APIs are built for **Advanced Customization and Pipeline Design**,
ideal for developers looking for in-depth control and flexibility.

The low-level APIs follow a 3-tier architecture:

#### Parser Models (Tier 1: Simplified Composition)

Combines Lexer and Assembler for streamlined usage without sacrificing flexibility.

- **`function createStringCSVParser(options?)`**
  - Factory function for creating format-specific CSV parsers.
  - Returns `FlexibleStringObjectCSVParser` (default) or `FlexibleStringArrayCSVParser` based on `outputFormat` option.
  - Parses CSV strings by composing `FlexibleStringCSVLexer` and CSV Record Assembler.
  - Stateful parser maintains internal lexer and assembler instances for streaming.
  - Use with `StringCSVParserStream` for streaming workflows.
  - **Low-level API**: Accepts `CSVProcessingOptions` only (no `engine` option).
  - **Streaming mode**: When using `parse(chunk, { stream: true })`, you must call `parse()` without arguments at the end to flush any remaining data.

  ```typescript
  // Object format (default)
  const objectParser = createStringCSVParser({
    header: ['name', 'age'] as const
  });

  // Array format
  const arrayParser = createStringCSVParser({
    header: ['name', 'age'] as const,
    outputFormat: 'array'
  });

  // Process chunks
  const records1 = objectParser.parse('Alice,30\nBob,', { stream: true });
  const records2 = objectParser.parse('25\nCharlie,', { stream: true });

  // Flush remaining data (required!)
  const records3 = objectParser.parse();
  ```

  - **Direct class usage**:
    - `FlexibleStringObjectCSVParser` - Always outputs object records
    - `FlexibleStringArrayCSVParser` - Always outputs array records

- **`function createBinaryCSVParser(options?)`**
  - Factory function for creating format-specific binary CSV parsers.
  - Returns `FlexibleBinaryObjectCSVParser` (default) or `FlexibleBinaryArrayCSVParser` based on `outputFormat` option.
  - Parses binary CSV data (BufferSource: Uint8Array, ArrayBuffer, or other TypedArray) by composing `TextDecoder` with string CSV parser.
  - Uses `TextDecoder` with `stream: true` option for proper multi-byte character handling across chunk boundaries.
  - Supports various character encodings (utf-8, shift_jis, etc.) via `charset` option.
  - BOM handling via `ignoreBOM` option, fatal error mode via `fatal` option.
  - Use with `BinaryCSVParserStream` for streaming workflows.
  - **Low-level API**: Accepts `BinaryCSVProcessingOptions` only (no `engine` option).
  - **Streaming mode**: When using `parse(chunk, { stream: true })`, you must call `parse()` without arguments at the end to flush TextDecoder and parser buffers.

  ```typescript
  // Object format (default)
  const objectParser = createBinaryCSVParser({
    header: ['name', 'age'] as const,
    charset: 'utf-8'
  });

  // Array format
  const arrayParser = createBinaryCSVParser({
    header: ['name', 'age'] as const,
    outputFormat: 'array',
    charset: 'utf-8'
  });

  const encoder = new TextEncoder();

  // Process chunks
  const records1 = objectParser.parse(encoder.encode('Alice,30\nBob,'), { stream: true });
  const records2 = objectParser.parse(encoder.encode('25\n'), { stream: true });

  // Flush remaining data (required!)
  const records3 = objectParser.parse();
  ```

  - **Direct class usage**:
    - `FlexibleBinaryObjectCSVParser` - Always outputs object records
    - `FlexibleBinaryArrayCSVParser` - Always outputs array records

#### Lexer (Tier 2: Stage 1 - Tokenization)

Low-level tokenization with full control over CSV syntax.

- **`function createStringCSVLexer(options?)` / `class FlexibleStringCSVLexer`**
  - Factory helper plus underlying class for the standalone lexer used across the toolkit.
  - Configure delimiters, quotation, buffer limits, and cancellation per stream.
  - Returns tokens (field values, row delimiters, etc.) for manual processing.

#### Assembler (Tier 2: Stage 2 - Record Assembly)

Converts tokens into structured records with flexible formatting.

- **`function createCSVRecordAssembler(options)`**
  - Factory that returns either an object- or array-format assembler based on `outputFormat`.
  - Applies new options like `includeHeader` and `columnCountStrategy` consistently across environments.
- **`class FlexibleCSVObjectRecordAssembler` / `class FlexibleCSVArrayRecordAssembler`**
  - Specialized assemblers when you need full control over object vs tuple output or want to extend behavior.
  - `FlexibleCSVRecordAssembler` remains for backward compatibility but now delegates to these focused implementations.

#### Streaming Transformers (Tier 3: TransformStream Integration)

Web Streams API integration for all processing tiers.

- **`class StringCSVParserStream`**
  - `TransformStream<string, CSVRecord>` for streaming string parsing.
  - Wraps Parser instances (accepts parser in constructor, doesn't construct internally).
  - Configurable backpressure handling via `backpressureCheckInterval` option.
  - Custom queuing strategies support for fine-tuned performance.
- **`class BinaryCSVParserStream`**
  - `TransformStream<BufferSource, CSVRecord>` for streaming binary parsing.
  - Handles UTF-8 multi-byte characters across chunk boundaries.
  - Integration-ready for fetch API and file streaming.
  - Backpressure management with configurable check intervals.
- **`createStringCSVLexerTransformer()`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/createStringCSVLexerTransformer.html)
  - Factory function to create a StringCSVLexerTransformer with customizable queuing strategies.
- **`createCSVRecordAssemblerTransformer()`**: [📑](https://kamiazya.github.io/web-csv-toolbox/functions/createCSVRecordAssemblerTransformer.html)
  - Factory function to create a CSVRecordAssemblerTransformer with cooperative backpressure support.

These factory functions are the recommended way to create transformer instances. They encapsulate internal lexer/assembler initialization and provide sensible defaults, insulating your code from internal implementation changes. Direct class instantiation (`new StringCSVLexerTransformer(customLexer)`) is only needed when injecting a custom lexer implementation—see [Custom Lexer/Assembler](./docs/how-to-guides/custom-csv-parser.md#low-level-custom-lexerassembler) for advanced use cases.

#### Customizing Queuing Strategies

Both `createStringCSVLexerTransformer()` and `createCSVRecordAssemblerTransformer()` support custom queuing strategies following the Web Streams API pattern. Strategies are passed as function arguments with **data-type-aware size counting** and **configurable backpressure handling**.

**Function signature:**
```typescript
createStringCSVLexerTransformer(options?, streamOptions?, writableStrategy?, readableStrategy?)
createCSVRecordAssemblerTransformer(options?, streamOptions?, writableStrategy?, readableStrategy?)
```

**Default queuing strategies (starting points, not benchmarked):**
```typescript
// StringCSVLexerTransformer defaults
createStringCSVLexerTransformer(
  { delimiter: ',' },                  // CSV options
  { backpressureCheckInterval: 100 },  // Check every 100 tokens
  {
    highWaterMark: 65536,              // 64KB of characters
    size: (chunk) => chunk.length,     // Count by string length
  },
  new CountQueuingStrategy({ highWaterMark: 1024 })  // 1024 tokens
)

// CSVRecordAssemblerTransformer defaults
createCSVRecordAssemblerTransformer(
  { header: ['name', 'age'] },         // Assembler options
  { backpressureCheckInterval: 10 },   // Check every 10 records
  new CountQueuingStrategy({ highWaterMark: 1024 }),  // 1024 tokens
  new CountQueuingStrategy({ highWaterMark: 256 })    // 256 records
)
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

🔧 **Tunable Backpressure Check Interval:**
- `backpressureCheckInterval` (in options): How often to check for backpressure (count-based)
- Lower values (5-25): More responsive, slight overhead
- Higher values (100-500): Less overhead, slower response
- Customize based on downstream consumer speed

> ⚠️ **Important**: These defaults are theoretical starting points based on data flow characteristics, **not empirical benchmarks**. Optimal values vary by runtime (browser/Node.js/Deno), file size, memory constraints, and CPU performance. **Profile your specific use case** to find the best values.

**When to customize:**
- 🚀 **High-throughput servers**: Higher `highWaterMark` (128KB+, 2048+ tokens), higher `backpressureCheckInterval` (200-500)
- 📱 **Memory-constrained environments**: Lower `highWaterMark` (16KB, 256 tokens), lower `backpressureCheckInterval` (10-25)
- 🐌 **Slow consumers** (DB writes, API calls): Lower `highWaterMark`, lower `backpressureCheckInterval` for responsive backpressure
- 🏃 **Fast processing**: Higher values to reduce overhead

**Example - High-throughput server:**
```typescript
import {
  createStringCSVLexerTransformer,
  createCSVRecordAssemblerTransformer
} from 'web-csv-toolbox';

const response = await fetch('large-dataset.csv');
await response.body
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(createStringCSVLexerTransformer(
    { delimiter: ',' },
    { backpressureCheckInterval: 200 },  // Less frequent checks
    {
      highWaterMark: 131072,             // 128KB
      size: (chunk) => chunk.length,
    },
    new CountQueuingStrategy({ highWaterMark: 2048 })  // 2048 tokens
  ))
  .pipeThrough(createCSVRecordAssemblerTransformer(
    {},                                  // Use default assembler options
    { backpressureCheckInterval: 20 },   // Less frequent checks
    new CountQueuingStrategy({ highWaterMark: 2048 }),  // 2048 tokens
    new CountQueuingStrategy({ highWaterMark: 512 })    // 512 records
  ))
  .pipeTo(yourRecordProcessor);
```

**Example - Slow consumer (API writes):**
```typescript
import {
  createStringCSVLexerTransformer,
  createCSVRecordAssemblerTransformer
} from 'web-csv-toolbox';

await csvStream
  .pipeThrough(createStringCSVLexerTransformer())  // Use defaults
  .pipeThrough(createCSVRecordAssemblerTransformer(
    {},                                  // Use default assembler options
    { backpressureCheckInterval: 2 },    // Very responsive
    new CountQueuingStrategy({ highWaterMark: 512 }),
    new CountQueuingStrategy({ highWaterMark: 64 })
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

### WebAssembly Acceleration 🚀

Enable WebAssembly for high-performance CSV parsing with `engine: { wasm: true }` or use `EnginePresets.fast()` / `EnginePresets.responsiveFast()`.

#### Quick Start

```ts
import { parse, loadWASM, EnginePresets } from "web-csv-toolbox";

// Optional: Pre-load WASM to reduce first-parse latency
await loadWASM();

const csv = "name,age\nAlice,30\nBob,25";

// Use WASM with streaming API
for await (const record of parse(csv, {
  engine: EnginePresets.fast()  // or { wasm: true }
})) {
  console.log(record);
}
// { name: "Alice", age: "30" }
// { name: "Bob", age: "25" }
```

#### Worker + WASM (Bundler Setup)

For non-blocking UI with WASM performance in browser applications using bundlers (Vite, Webpack, etc.):

**Vite:**

```ts
import { parse, loadWASM, ReusableWorkerPool } from "web-csv-toolbox";
import workerUrl from "web-csv-toolbox/worker?url";
import wasmUrl from "web-csv-toolbox/csv.wasm?url";

// Initialize WASM with external URL (required for slim entry or bundler optimization)
await loadWASM(wasmUrl);

// Create worker pool with custom worker URL
using pool = new ReusableWorkerPool({ workerURL: workerUrl });

const csv = "name,age\nAlice,30\nBob,25";

// Non-blocking parsing with WASM acceleration
for await (const record of parse(csv, {
  engine: { worker: true, wasm: true, workerPool: pool }
})) {
  console.log(record);
}
// Worker is automatically cleaned up when leaving scope
```

**Webpack:**

```ts
import { parse, loadWASM, ReusableWorkerPool } from "web-csv-toolbox";

// Webpack worker URL syntax
const workerUrl = new URL("web-csv-toolbox/worker", import.meta.url);

await loadWASM();

using pool = new ReusableWorkerPool({ workerURL: workerUrl });

for await (const record of parse(csv, {
  engine: { worker: true, wasm: true, workerPool: pool }
})) {
  console.log(record);
}
```

> **Why Worker + WASM?** Worker threads keep the UI responsive while WASM provides fast parsing. `ReusableWorkerPool` manages worker lifecycle with automatic cleanup via `using` syntax.

#### Supported Input Types

| Input Type | API | WASM Streaming |
|------------|-----|----------------|
| `string` | `parseString`, `parse` | ❌ Full buffer (yields after complete parse) |
| `Uint8Array` / `ArrayBuffer` | `parseBinary` | ❌ Full buffer |
| `Response` | `parseResponse` | ✅ True streaming |
| `ReadableStream<Uint8Array>` | `parseBinaryStream` | ✅ True streaming |

#### Entry Points

| Entry | Bundle Size | Initialization | Use Case |
|-------|-------------|----------------|----------|
| `web-csv-toolbox` (Main) | Larger (WASM embedded) | Automatic | Convenience |
| `web-csv-toolbox/slim` | Smaller (WASM external) | Manual `loadWASM()` required | Bundle optimization |

#### WASM Limitations

**Encoding Support:**
- **Binary inputs (Uint8Array, ArrayBuffer)**: UTF-8 only
  - Non-UTF-8 encodings (Shift-JIS, EUC-JP) require JavaScript engine
  - `charset` option is ignored with WASM binary parsing
- **String inputs (JavaScript strings)**: UTF-8 or UTF-16 processing modes
  - UTF-8 mode (default): Encodes string to UTF-8 bytes → WASM processing
  - UTF-16 mode: Direct UTF-16 processing (faster, skips TextEncoder/TextDecoder)
  - Use `charset: 'utf-16'` for optimized Unicode-heavy string processing
- Custom delimiters and quotation characters are fully supported (ASCII only for WASM)

#### Low-level WASM APIs

For advanced use cases, direct access to WASM parser models and stream transformers:

```ts
import {
  WASMStringObjectCSVParser,
  WASMBinaryObjectCSVParser,
  WASMBinaryCSVStreamTransformer,
  loadWASM
} from "web-csv-toolbox";

await loadWASM();

// String parsing
const stringParser = new WASMStringObjectCSVParser();
const records = stringParser.parse("name,age\nAlice,30");

// Binary streaming
const transformer = new WASMBinaryCSVStreamTransformer();
await fetch("large.csv")
  .then(res => res.body)
  .pipeThrough(transformer)
  .pipeTo(new WritableStream({ write: console.log }));
```

#### Synchronous Parsing

```ts
import { parseString } from "web-csv-toolbox";

const result = parseString.toArraySync("a,b,c\n1,2,3", { engine: { wasm: true } });
// [{ a: "1", b: "2", c: "3" }]
```

See [Using WebAssembly Tutorial](https://kamiazya.github.io/web-csv-toolbox/tutorials/using-webassembly.html) for detailed usage.

## Options Configuration 🛠️

### Common Options ⚙️

| Option           | Description                           | Default      | Notes                                                                              |
| ---------------- | ------------------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| `delimiter`      | Character to separate fields          | `,`          |                                                                                    |
| `quotation`      | Character used for quoting fields     | `"`          |                                                                                    |
| `maxBufferSize`  | Maximum internal buffer size (characters)  | `10 * 1024 * 1024`   | Set to `Number.POSITIVE_INFINITY` to disable (not recommended for untrusted input). Measured in UTF-16 code units. |
| `maxFieldCount`  | Maximum fields allowed per record     | `100000`     | Set to `Number.POSITIVE_INFINITY` to disable (not recommended for untrusted input) |
| `maxFieldSize`   | Maximum size of a single field (bytes) | `10485760` (10MB) | Prevents memory exhaustion from oversized fields. Can be increased up to 1GB. Note: [Runtime string limits vary](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/length) (V8: ~512MB, Firefox: ~1GB, Safari: ~2GB). |
| `header`         | Custom headers for the parsed records | First row    | If not provided, the first row is used as headers                                  |
| `outputFormat`   | Record shape (`'object'` or `'array'`) | `'object'`   | `'array'` returns type-safe tuples |
| `includeHeader`  | Emit header row when using array output | `false` | Only valid with `outputFormat: 'array'` — the header becomes the first emitted record |
| `columnCountStrategy` | Handle column-count mismatches when a header is provided | `'keep'` for array format / `'pad'` for object format | Choose between `keep`, `pad`, `strict`, or `truncate` to control how rows align with the header |
| `signal`         | AbortSignal to cancel processing      | `undefined`  | Allows aborting of long-running operations                                         |

#### Record Output Formats

High-level and mid-level parsers now let you choose whether records come back as objects (default) or as tuple-like arrays:

```ts
const header = ["name", "age"] as const;

// Object output (default)
for await (const record of parse(csv, { header })) {
  record.name; // string
}

// Array output with named tuples
const rows = await parse.toArray(csv, {
  header,
  outputFormat: "array",
  includeHeader: true,
  columnCountStrategy: "pad",
});
// rows[0] === ['name', 'age'] (header row)
// rows[1] has type readonly [name: string, age: string]
```

- `outputFormat: 'object'` (default) returns familiar `{ column: value }` objects.
- `outputFormat: 'array'` returns readonly tuples whose indices inherit names from the header for stronger TypeScript inference.
- `includeHeader: true` prepends the header row when you also set `outputFormat: 'array'`.
- `columnCountStrategy` controls how rows with too many or too few columns are treated when a header is present:
  - `keep`: emit rows exactly as they appear (default for array output with inferred headers)
  - `pad`: fill short rows with `undefined` and truncate long rows (default for object output)
  - `strict`: throw if the row length differs from the header
  - `truncate`: discard columns beyond the header length without padding short rows

### Advanced Options (Binary-Specific) 🧬

| Option                            | Description                                       | Default | Notes                                                                                                                                                     |
| --------------------------------- | ------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `charset`                         | Character encoding for binary CSV inputs          | `utf-8` | See [Encoding API Compatibility](https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API/Encodings) for the encoding formats that can be specified. |
| `maxBinarySize`                   | Maximum binary size for BufferSource inputs (bytes) | `100 * 1024 * 1024` (100MB) | Set to `Number.POSITIVE_INFINITY` to disable (not recommended for untrusted input) |
| `decompression`                   | Decompression algorithm for compressed CSV inputs |         | See [DecompressionStream Compatibility](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream#browser_compatibility). Default support: gzip, deflate. deflate-raw is runtime-dependent and experimental (requires `allowExperimentalCompressions: true` for Response/Request inputs). |
| `ignoreBOM`                       | Whether to ignore Byte Order Mark (BOM)           | `false` | See [TextDecoderOptions.ignoreBOM](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream/ignoreBOM) for more information about the BOM.      |
| `fatal`                           | Throw an error on invalid characters              | `false` | See [TextDecoderOptions.fatal](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoderStream/fatal) for more information.                            |
| `allowExperimentalCompressions`   | Allow experimental/future compression formats     | `false` | When enabled, passes unknown compression formats to runtime. Use cautiously. See example below.                                                           |

## Performance & Best Practices ⚡

### Memory Characteristics

web-csv-toolbox uses different memory patterns depending on the API you choose:

#### 🌊 Streaming APIs (Memory Efficient)

##### Recommended for large files (> 10MB)

```js
import { parse } from 'web-csv-toolbox';

// ✅ Memory efficient: processes one record at a time
const response = await fetch('https://example.com/large-data.csv');
for await (const record of parse(response)) {
  console.log(record);
  // Memory footprint: ~few KB per iteration
}
```

- **Memory usage**: O(1) - constant per record
- **Suitable for**: Files of any size, browser environments
- **Max file size**: Limited only by available storage/network

#### 📦 Array-Based APIs (Memory Intensive)

##### Recommended for small files (< 1MB)

```js
import { parse } from 'web-csv-toolbox';

// ⚠️ Loads entire result into memory
const csv = await fetch('data.csv').then(r => r.text());
const records = await parse.toArray(csv);
// Memory footprint: entire file + parsed array
```

- **Memory usage**: O(n) - proportional to file size
- **Suitable for**: Small datasets, quick prototyping
- **Recommended max**: ~10MB (browser), ~100MB (Node.js)

### Platform-Specific Considerations

| Platform | Streaming | Array-Based | Notes |
|----------|-----------|-------------|-------|
| **Browser** | Any size | < 10MB | Browser heap limits apply (~100MB-4GB depending on browser) |
| **Node.js** | Any size | < 100MB | Use `--max-old-space-size` flag for larger heaps |
| **Deno** | Any size | < 100MB | Similar to Node.js |

### Performance Tips

#### 1. Use streaming for large files

```js
import { parse } from 'web-csv-toolbox';

const response = await fetch('https://example.com/large-data.csv');

// ✅ Good: Streaming approach (constant memory usage)
for await (const record of parse(response)) {
  // Process each record immediately
  console.log(record);
  // Memory footprint: O(1) - only one record in memory at a time
}

// ❌ Avoid: Loading entire file into memory first
const response2 = await fetch('https://example.com/large-data.csv');
const text = await response2.text(); // Loads entire file into memory
const records = await parse.toArray(text); // Loads all records into memory
for (const record of records) {
  console.log(record);
  // Memory footprint: O(n) - entire file + all records in memory
}
```

#### 2. Enable AbortSignal for timeout protection

```js
import { parse } from 'web-csv-toolbox';

// Set up a timeout of 30 seconds (30000 milliseconds)
const signal = AbortSignal.timeout(30000);

const response = await fetch('https://example.com/large-data.csv');

try {
  for await (const record of parse(response, { signal })) {
    // Process each record
    console.log(record);
  }
} catch (error) {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    // Handle timeout
    console.log('CSV processing was aborted due to timeout.');
  } else {
    // Handle other errors
    console.error('An error occurred during CSV processing:', error);
  }
}
```

#### 3. Use WebAssembly parser for CPU-intensive workloads (Experimental)

```js
import { parseString, parseBinary } from 'web-csv-toolbox';

// String input: UTF-8 or UTF-16 processing modes
// For Unicode-heavy strings, use charset: 'utf-16' to skip TextEncoder/TextDecoder
const records = parseString.toArraySync(csvString, {
  engine: { wasm: true },
  charset: 'utf-16'  // Optimized for JavaScript strings
});

// Binary input: UTF-8 only (charset option ignored by WASM)
const binaryRecords = parseBinary.toArraySync(utf8Binary, {
  engine: { wasm: true }
});
```

### Known Limitations

- **Delimiter/Quotation**: JavaScript parser supports any character; WASM parser requires single-byte ASCII only
- **WASM Parser Encoding**:
  - Binary inputs: UTF-8 only (Shift-JIS, EUC-JP not supported)
  - String inputs: UTF-8/UTF-16 processing modes
  - Delimiters/quotation: Single-byte ASCII only (multi-byte UTF-8 characters not supported)
- **Streaming**: Best performance with chunk sizes > 1KB

### Security Considerations

For production use with untrusted input, consider:
- Setting timeouts using `AbortSignal.timeout()` to prevent resource exhaustion
- Using `maxBinarySize` option to limit BufferSource inputs (default: 100MB bytes)
- Using `maxBufferSize` option to limit internal buffer size (default: 10M characters)
- Using `maxFieldCount` option to limit fields per record (default: 100,000)
- Using `maxFieldSize` option to limit individual field size (default: 10MB)
- Implementing additional file size limits at the application level
- Validating parsed data before use

#### Implementing Size Limits for Untrusted Sources

When processing CSV files from untrusted sources (especially compressed files), you can implement size limits using a custom TransformStream:

```js
import { parse } from 'web-csv-toolbox';

// Create a size-limiting TransformStream
class SizeLimitStream extends TransformStream {
  constructor(maxBytes) {
    let bytesRead = 0;
    super({
      transform(chunk, controller) {
        bytesRead += chunk.length;
        if (bytesRead > maxBytes) {
          controller.error(new Error(`Size limit exceeded: ${maxBytes} bytes`));
        } else {
          controller.enqueue(chunk);
        }
      }
    });
  }
}

// Example: Limit decompressed data to 10MB
const response = await fetch('https://untrusted-source.com/data.csv.gz');
const limitedStream = response.body
  .pipeThrough(new DecompressionStream('gzip'))
  .pipeThrough(new SizeLimitStream(10 * 1024 * 1024)); // 10MB limit

try {
  for await (const record of parse(limitedStream)) {
    console.log(record);
  }
} catch (error) {
  if (error.message.includes('Size limit exceeded')) {
    console.error('File too large - possible compression bomb attack');
  }
}
```

**Note**: The library automatically validates Content-Encoding headers when parsing Response objects, rejecting unsupported compression formats.

#### Using Experimental Compression Formats

By default, the library only supports well-tested compression formats: `gzip` and `deflate`. Some runtimes may support additional formats like `deflate-raw` or Brotli, but these are runtime-dependent and not guaranteed. If you need to use these formats, you can enable experimental mode:

```js
import { parse } from 'web-csv-toolbox';

// ✅ Default behavior: Only known formats
const response = await fetch('data.csv.gz');
await parse(response); // Works

// ⚠️ Experimental: Allow future formats
const response2 = await fetch('data.csv.br'); // Brotli compression
try {
  await parse(response2, { allowExperimentalCompressions: true });
  // Works if runtime supports Brotli
} catch (error) {
  // Runtime will throw if format is unsupported
  console.error('Runtime does not support this compression format');
}
```

**When to use this:**
- Your runtime supports a newer compression format (e.g., Brotli in modern browsers)
- You want to use the format before this library explicitly supports it
- You trust the compression format source

**Cautions:**
- Error messages will come from the runtime, not this library
- No library-level validation for unknown formats
- You must verify your runtime supports the format

## How to Contribute 💪

## Star ⭐

The easiest way to contribute is to use the library and star the [repository](https://github.com/kamiazya/web-csv-toolbox/).

### Questions 💭

Feel free to ask questions on [GitHub Discussions](https://github.com/kamiazya/web-csv-toolbox/discussions).

### Report bugs / request additional features 💡

Please create an issue at [GitHub Issues](https://github.com/kamiazya/web-csv-toolbox/issues/new/choose).

### Financial Support 💸

Please support [kamiazya](https://github.com/sponsors/kamiazya).

> Even just a dollar is enough motivation to develop 😊

## License ⚖️

This software is released under the MIT License, see [LICENSE](https://github.com/kamiazya/web-csv-toolbox/blob/main/LICENSE).


[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fkamiazya%2Fweb-csv-toolbox.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fkamiazya%2Fweb-csv-toolbox?ref=badge_large)
