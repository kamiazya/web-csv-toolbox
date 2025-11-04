# web-csv-toolbox

## 0.13.0

### Minor Changes

- [#545](https://github.com/kamiazya/web-csv-toolbox/pull/545) [`43a6812`](https://github.com/kamiazya/web-csv-toolbox/commit/43a68127cfe4433ac3c4542933b22f7acbcd93be) Thanks [@kamiazya](https://github.com/kamiazya)! - Add comprehensive memory protection to prevent memory exhaustion attacks

  This release introduces new security features to prevent unbounded memory growth during CSV parsing. The parser now enforces configurable limits on both buffer size and field count to protect against denial-of-service attacks via malformed or malicious CSV data.

  **New Features:**

  - Added `maxBufferSize` option to `CommonOptions` (default: `10 * 1024 * 1024` characters)
  - Added `maxFieldCount` option to `RecordAssemblerOptions` (default: 100,000 fields)
  - Throws `RangeError` when buffer exceeds size limit
  - Throws `RangeError` when field count exceeds limit
  - Comprehensive memory safety protection against DoS attacks

  **Note:** `maxBufferSize` is measured in UTF-16 code units (JavaScript string length), not bytes. This is approximately 10MB for ASCII text, but may vary for non-ASCII characters.

  **Breaking Changes:**
  None. This is a backward-compatible enhancement with sensible defaults.

  **Security:**
  This change addresses three potential security vulnerabilities:

  1. **Unbounded buffer growth via streaming input**: Attackers could exhaust system memory by streaming large amounts of malformed CSV data that cannot be tokenized. The `maxBufferSize` limit prevents this by throwing `RangeError` when the internal buffer exceeds `10 * 1024 * 1024` characters (approximately 10MB for ASCII).

  2. **Quoted field parsing memory exhaustion**: Attackers could exploit the quoted field parsing logic by sending strategically crafted CSV with unclosed quotes or excessive escaped quotes, causing the parser to accumulate unbounded data in the buffer. The `maxBufferSize` limit protects against this attack vector.

  3. **Excessive column count attacks**: Attackers could send CSV files with an enormous number of columns to exhaust memory during header parsing and record assembly. The `maxFieldCount` limit (default: 100,000 fields per record) prevents this by throwing `RangeError` when exceeded.

  Users processing untrusted CSV input are encouraged to use the default limits or configure appropriate `maxBufferSize` and `maxFieldCount` values for their use case.

- [#546](https://github.com/kamiazya/web-csv-toolbox/pull/546) [`76eec90`](https://github.com/kamiazya/web-csv-toolbox/commit/76eec9027400dc77264be2be8a252d284f00dc6a) Thanks [@kamiazya](https://github.com/kamiazya)! - **BREAKING CHANGE**: Change error types from RangeError to TypeError for consistency with Web Standards

  - Change all `RangeError` to `TypeError` for consistency
  - This affects error handling in:
    - `getOptionsFromResponse()`: Invalid MIME type, unsupported/multiple content-encodings
    - `parseResponse()`: Null response body
    - `parseResponseToStream()`: Null response body
  - Aligns with Web Standard APIs behavior (DecompressionStream throws TypeError)
  - Improves consistency for error handling with `catch (error instanceof TypeError)`

  **Migration guide:**
  If you were catching `RangeError` from `getOptionsFromResponse()`, update to catch `TypeError` instead:

  ```diff
  - } catch (error) {
  -   if (error instanceof RangeError) {
  + } catch (error) {
  +   if (error instanceof TypeError) {
        // Handle invalid content type or encoding
      }
    }
  ```

  ### New feature: Experimental compression format support

  - Add `allowExperimentalCompressions` option to enable experimental/non-standard compression formats
  - **Browsers**: By default, only `gzip` and `deflate` are supported (cross-browser compatible)
  - **Node.js**: By default, `gzip`, `deflate`, and `br` (Brotli) are supported
  - When enabled, allows platform-specific formats like `deflate-raw` (Chrome/Edge only)
  - Provides flexibility for environment-specific compression formats
  - See documentation for browser compatibility details and usage examples

  **Other improvements in this release:**

  - Add Content-Encoding header validation with RFC 7231 compliance
  - Normalize Content-Encoding header: convert to lowercase, trim whitespace
  - Ignore empty or whitespace-only Content-Encoding headers
  - Add comprehensive tests for Content-Encoding validation (23 tests)
  - Add security documentation with TransformStream size limit example
  - Error messages now guide users to `allowExperimentalCompressions` option when needed

- [#551](https://github.com/kamiazya/web-csv-toolbox/pull/551) [`b21b6d8`](https://github.com/kamiazya/web-csv-toolbox/commit/b21b6d89a7a3f18dcbf79ec04ffefde0d7ff4c4c) Thanks [@kamiazya](https://github.com/kamiazya)! - Add comprehensive documentation for supported environments and versioning policy

  This release adds two new reference documents to clarify the library's support policies and version management strategy.

  **New Documentation:**

  - **[Supported Environments](./docs/reference/supported-environments.md)**: Comprehensive documentation of runtime environment support tiers
  - **[Versioning Policy](./docs/reference/versioning-policy.md)**: Detailed versioning strategy and semantic versioning rules

- [#551](https://github.com/kamiazya/web-csv-toolbox/pull/551) [`b21b6d8`](https://github.com/kamiazya/web-csv-toolbox/commit/b21b6d89a7a3f18dcbf79ec04ffefde0d7ff4c4c) Thanks [@kamiazya](https://github.com/kamiazya)! - Add environment-specific compression format support for better cross-browser and Node.js compatibility

  This release adjusts the supported compression formats based on the runtime environment to ensure reliability and prevent errors across different browsers and Node.js versions.

  **Changes:**

  - **Browser environments**: Support `gzip` and `deflate` only (universal cross-browser support)
  - **Node.js 20+ environments**: Support `gzip`, `deflate`, and `br` (Brotli)

  **Rationale:**

  Previously, browser builds included `deflate-raw` in the default supported formats. However, `deflate-raw` is only supported in Chromium-based browsers (Chrome, Edge) and not in Firefox or Safari. To ensure the library works reliably across all modern browsers by default, we now only include universally supported formats.

  **Browser Compatibility:**

  | Format        | Chrome/Edge | Firefox | Safari | Included by Default  |
  | ------------- | ----------- | ------- | ------ | -------------------- |
  | `gzip`        | ✅          | ✅      | ✅     | ✅ Yes               |
  | `deflate`     | ✅          | ✅      | ✅     | ✅ Yes               |
  | `deflate-raw` | ✅          | ❌      | ❌     | ❌ No (experimental) |

  **Using Experimental Compressions:**

  If you need to use `deflate-raw` or other non-standard compression formats in Chromium-based browsers, you can enable them with the `allowExperimentalCompressions` option:

  ```typescript
  // Use deflate-raw in Chrome/Edge (may fail in Firefox/Safari)
  const response = await fetch("data.csv"); // Content-Encoding: deflate-raw
  await parseResponse(response, {
    allowExperimentalCompressions: true,
  });
  ```

  You can also detect browser support at runtime:

  ```typescript
  // Browser-aware usage
  const isChromium = navigator.userAgent.includes("Chrome");
  await parseResponse(response, {
    allowExperimentalCompressions: isChromium,
  });
  ```

  **Migration Guide:**

  For users who were relying on `deflate-raw` in browser environments:

  1. **Option 1**: Use `gzip` or `deflate` compression instead (recommended for cross-browser compatibility)

     ```typescript
     // Server-side: Use gzip instead of deflate-raw
     response.headers.set("content-encoding", "gzip");
     ```

  2. **Option 2**: Enable experimental compressions for Chromium-only deployments

     ```typescript
     await parseResponse(response, {
       allowExperimentalCompressions: true,
     });
     // Works in Chrome/Edge, may fail in Firefox/Safari
     ```

  3. **Option 3**: Detect browser support and handle fallbacks
     ```typescript
     try {
       await parseResponse(response, {
         allowExperimentalCompressions: true,
       });
     } catch (error) {
       // Fallback for browsers that don't support the format
       console.warn("Compression format not supported, using uncompressed");
     }
     ```

  **Implementation:**

  The supported compressions are now determined at build time using package.json `imports` field:

  - Browser/Web builds use `getOptionsFromResponse.constants.web.js`
  - Node.js builds use `getOptionsFromResponse.constants.node.js`

  This ensures type-safe, environment-appropriate compression support.

  **No changes required** for users already using `gzip` or `deflate` compression in browsers, or `gzip`, `deflate`, or `br` in Node.js.

- [#563](https://github.com/kamiazya/web-csv-toolbox/pull/563) [`7d51d52`](https://github.com/kamiazya/web-csv-toolbox/commit/7d51d5285be9cffa5103de58469d8de0c98959d7) Thanks [@kamiazya](https://github.com/kamiazya)! - Optimize streaming API design for better performance and consistency

  ## Breaking Changes

  ### Token Stream Output Changed from Batch to Individual

  `CSVLexerTransformer` and `CSVRecordAssemblerTransformer` now emit/accept individual tokens instead of token arrays for improved streaming performance and API consistency.

  **Before:**

  ```typescript
  CSVLexerTransformer: TransformStream<string, Token[]>;
  CSVRecordAssemblerTransformer: TransformStream<Token[], CSVRecord>;
  ```

  **After:**

  ```typescript
  CSVLexerTransformer: TransformStream<string, Token>;
  CSVRecordAssemblerTransformer: TransformStream<Token, CSVRecord>;
  ```

  ### Why This Change?

  1. **Consistent API Design**: RecordAssembler already emits individual records. Lexer now matches this pattern.
  2. **Better Backpressure**: Fine-grained token-by-token flow control instead of batch-based.
  3. **Memory Efficiency**: Eliminates temporary token array allocation.
  4. **Simpler Queuing Strategy**: Uniform `size: () => 1` across the pipeline.

  ### Migration Guide

  **For Low-Level API Users:**

  If you directly use `CSVLexerTransformer` or `CSVRecordAssemblerTransformer`:

  ```typescript
  // Before: Process token arrays
  stream.pipeThrough(new CSVLexerTransformer()).pipeTo(
    new WritableStream({
      write(tokens) {
        // tokens is Token[]
        for (const token of tokens) {
          console.log(token);
        }
      },
    })
  );

  // After: Process individual tokens
  stream.pipeThrough(new CSVLexerTransformer()).pipeTo(
    new WritableStream({
      write(token) {
        // token is Token
        console.log(token);
      },
    })
  );
  ```

  **For High-Level API Users:**

  No changes required. Functions like `parseString()`, `parseStringStream()`, etc. continue to work without modification.

  ## Performance Improvements

  ### CSVRecordAssembler Now Accepts Single Tokens

  `CSVRecordAssembler.assemble()` has been optimized to accept both single `Token` and `Iterable<Token>`, eliminating unnecessary array allocation in streaming scenarios.

  **Before:**

  ```typescript
  // Had to wrap single tokens in an array
  for (const token of tokens) {
    const records = assembler.assemble([token], { stream: true }); // Array allocation
  }
  ```

  **After:**

  ```typescript
  // Pass single tokens directly (backward compatible)
  for (const token of tokens) {
    const records = assembler.assemble(token, { stream: true }); // No array allocation
  }

  // Iterable still works
  const records = assembler.assemble(tokens, { stream: true });
  ```

  **Benefits:**

  - Zero-allocation token processing in streaming mode
  - Better memory efficiency for large CSV files
  - Backward compatible - existing code continues to work
  - Aligns with Web Standards (TextDecoder pattern)

  **Implementation Details:**

  - Uses lightweight `Symbol.iterator` check to detect iterables
  - Internal refactoring with private `#processToken()` and `#flush()` methods
  - Maintains single public method (`assemble`) following TextDecoder pattern

  ## New Feature: Configurable Queuing Strategies

  Both `CSVLexerTransformer` and `CSVRecordAssemblerTransformer` now support custom queuing strategies following the Web Streams API pattern. Strategies are passed as constructor arguments, similar to the standard `TransformStream`.

  ## API Changes

  ### Constructor Signature

  Queuing strategies are now passed as separate constructor arguments:

  ```typescript
  // Before (if this was previously supported - this is a new feature)
  new CSVLexerTransformer(options)

  // After
  new CSVLexerTransformer(options?, writableStrategy?, readableStrategy?)
  new CSVRecordAssemblerTransformer(options?, writableStrategy?, readableStrategy?)
  ```

  ### CSVLexerTransformer

  - **Parameter 1** `options`: CSV-specific options (delimiter, quotation, etc.)
  - **Parameter 2** `writableStrategy`: Controls buffering for incoming string chunks
    - Default: `{ highWaterMark: 65536, size: (chunk) => chunk.length }`
    - Counts by **character count** (string length)
    - Default allows ~64KB of characters
  - **Parameter 3** `readableStrategy`: Controls buffering for outgoing tokens
    - Default: `{ highWaterMark: 1024, size: () => 1 }`
    - Counts each **token as 1**
    - Default allows 1024 tokens

  ### CSVRecordAssemblerTransformer

  - **Parameter 1** `options`: CSV-specific options (header, maxFieldCount, etc.)
  - **Parameter 2** `writableStrategy`: Controls buffering for incoming tokens
    - Default: `{ highWaterMark: 1024, size: () => 1 }`
    - Counts each **token as 1**
    - Default allows 1024 tokens
  - **Parameter 3** `readableStrategy`: Controls buffering for outgoing CSV records
    - Default: `{ highWaterMark: 256, size: () => 1 }`
    - Counts each **record as 1**
    - Default allows 256 records

  ## Default Values Rationale

  **Important**: The default values are **theoretical starting points** based on data flow characteristics, **not empirical benchmarks**.

  ### Size Counting Strategy

  Each transformer uses a **simple and consistent size algorithm**:

  - **CSVLexerTransformer writable**: Counts by **string length** (characters). This provides accurate backpressure based on actual data volume.
  - **CSVLexerTransformer readable**: Counts **each token as 1**. Simple and consistent with downstream.
  - **CSVRecordAssemblerTransformer writable**: Counts **each token as 1**. Matches the lexer's readable side for smooth pipeline flow.
  - **CSVRecordAssemblerTransformer readable**: Counts **each record as 1**. Simple and effective for record-based backpressure.

  ### Why These Defaults?

  - **Uniform counting**: Token and record stages all use `size: () => 1` for simplicity
  - **Character-based input**: Only the initial string input uses character counting for predictable memory usage
  - **Predictable pipeline**: Consistent token-by-token and record-by-record flow throughout
  - **Natural backpressure**: Fine-grained control allows responsive backpressure handling

  ### Backpressure Handling

  Both transformers implement **cooperative backpressure handling** with configurable check intervals:

  - Periodically checks `controller.desiredSize` during processing
  - When backpressure is detected (`desiredSize ≤ 0`), yields to the event loop via `setTimeout(0)`
  - Prevents blocking the main thread during heavy CSV processing
  - Allows downstream consumers to catch up, avoiding memory buildup

  **Configurable Check Interval:**

  - Set via `checkInterval` property in `ExtendedQueuingStrategy`
  - Lower values = more responsive but slight overhead
  - Higher values = less overhead but slower response
  - Defaults: 100 tokens (lexer), 10 records (assembler)

  This is especially important for:

  - Large CSV files that generate many tokens/records
  - Slow downstream consumers (e.g., database writes, API calls)
  - Browser environments where UI responsiveness is critical

  Optimal values depend on your runtime environment (browser/Node.js/Deno), data size, memory constraints, and CPU performance. **You should profile your specific use case** to find the best values.

  ## Benchmarking Tool

  A benchmark tool is provided to help you find optimal values for your use case:

  ```bash
  pnpm --filter web-csv-toolbox-benchmark queuing-strategy
  ```

  See `benchmark/queuing-strategy.bench.ts` for details.

  ## Usage Examples

  ```typescript
  import {
    CSVLexerTransformer,
    CSVRecordAssemblerTransformer,
  } from "web-csv-toolbox";

  // Basic usage (with defaults)
  const lexer = new CSVLexerTransformer();

  // Custom strategies based on YOUR profiling results
  const lexer = new CSVLexerTransformer(
    { delimiter: "," },
    {
      highWaterMark: 131072, // 128KB of characters
      size: (chunk) => chunk.length, // Count by character length
      checkInterval: 200, // Check backpressure every 200 tokens
    },
    {
      highWaterMark: 2048, // 2048 tokens
      size: () => 1, // Each token counts as 1
      checkInterval: 50, // Check backpressure every 50 tokens
    }
  );

  const assembler = new CSVRecordAssemblerTransformer(
    {},
    {
      highWaterMark: 2048, // 2048 tokens
      size: () => 1, // Each token counts as 1
      checkInterval: 20, // Check backpressure every 20 records
    },
    {
      highWaterMark: 512, // 512 records
      size: () => 1, // Each record counts as 1
      checkInterval: 5, // Check backpressure every 5 records
    }
  );
  ```

  ## When to Customize

  - **High-throughput servers**: Try higher values (e.g., 32-64) and benchmark
  - **Memory-constrained environments** (browsers, edge functions): Try lower values (e.g., 1-4) and monitor memory
  - **Custom pipelines**: Profile with representative data and iterate

  ## Web Standards Compliance

  This API follows the Web Streams API pattern where `TransformStream` accepts queuing strategies as constructor arguments, making it consistent with standard web platform APIs.

- [#562](https://github.com/kamiazya/web-csv-toolbox/pull/562) [`bd865d6`](https://github.com/kamiazya/web-csv-toolbox/commit/bd865d6ddb1cf9691d7b9a83d0790651f074dd47) Thanks [@kamiazya](https://github.com/kamiazya)! - **BREAKING CHANGE**: Refactor low-level API to align with Web Standards (TextDecoder pattern)

  This release introduces breaking changes to make the API more consistent with Web Standard APIs like `TextDecoder`.

  ## Class Renames

  All core classes have been renamed with `CSV` prefix for clarity:

  - `Lexer` → `CSVLexer`
  - `RecordAssembler` → `CSVRecordAssembler`
  - `LexerTransformer` → `CSVLexerTransformer`
  - `RecordAssemblerTransformer` → `CSVRecordAssemblerTransformer`

  ## API Changes

  The streaming API now follows the `TextDecoder` pattern using `options.stream` instead of positional boolean parameters:

  ### CSVLexer

  ```ts
  // Before
  lexer.lex(chunk, true); // buffering mode
  lexer.flush(); // flush remaining data

  // After
  lexer.lex(chunk, { stream: true }); // streaming mode
  lexer.lex(); // flush remaining data
  ```

  ### CSVRecordAssembler

  ```ts
  // Before
  assembler.assemble(tokens, false); // don't flush
  assembler.flush(); // flush remaining data

  // After
  assembler.assemble(tokens, { stream: true }); // streaming mode
  assembler.assemble(); // flush remaining data
  ```

  ## Removed Methods

  - `CSVLexer.flush()` - Use `lex()` without arguments instead
  - `CSVRecordAssembler.flush()` - Use `assemble()` without arguments instead

  ## Migration Guide

  1. Update class names: Add `CSV` prefix to `Lexer`, `RecordAssembler`, `LexerTransformer`, and `RecordAssemblerTransformer`
  2. Replace `lex(chunk, buffering)` with `lex(chunk, { stream: !buffering })`
  3. Replace `assemble(tokens, flush)` with `assemble(tokens, { stream: !flush })`
  4. Replace `flush()` calls with parameter-less `lex()` or `assemble()` calls

- [#551](https://github.com/kamiazya/web-csv-toolbox/pull/551) [`b21b6d8`](https://github.com/kamiazya/web-csv-toolbox/commit/b21b6d89a7a3f18dcbf79ec04ffefde0d7ff4c4c) Thanks [@kamiazya](https://github.com/kamiazya)! - Add experimental worker thread execution support for CSV parsing

  This release introduces experimental worker thread execution support, enabling CSV parsing to be offloaded to a separate thread. This keeps the main thread responsive, particularly beneficial for large CSV files in browser environments.

  **New Features:**

  - Added `engine` configuration object to all parsing functions (`parseString`, `parseBinary`, `parseStringStream`, `parseUint8ArrayStream`, `parseResponse`)
  - Support for `engine: { worker: true }` to run parsing in a Web Worker (browser) or Worker Thread (Node.js)
  - Support for `engine: { wasm: true }` to use WebAssembly for high-performance parsing
  - Support for `engine: { worker: true, wasm: true }` to combine both strategies
  - Cross-platform worker support for browsers, Node.js (20+), and Deno
  - Automatic worker strategy selection: Transferable Streams (Chrome/Firefox/Edge) or Message Streaming (Safari/fallback)
  - Concurrent request handling: WorkerPool manages multiple CSV parsing requests efficiently

  **Implementation Details:**

  - **Execution Routing Layer**: Dynamic imports route parsing to appropriate execution strategy (main thread, worker, or WASM)
  - **Cross-Platform Compatibility**:
    - Browsers: Web Workers with Transferable Streams (zero-copy)
    - Node.js: Worker Threads with message passing
    - Deno: Web Workers API
  - **Worker Context Abstraction**: Unified message handling across `self` (Web Workers) and `parentPort` (Node.js Worker Threads)
  - **Smart Stream Handling**:
    - Browser: Transfer ReadableStream directly to worker
    - Node.js: Collect stream data first, then transfer to worker

  **API Usage:**

  ```typescript
  import { parseString } from "web-csv-toolbox";

  // Parse in main thread (default)
  for await (const record of parseString(csv)) {
    console.log(record);
  }

  // Parse in worker thread (experimental)
  for await (const record of parseString(csv, { engine: { worker: true } })) {
    console.log(record);
  }

  // Parse with WASM (experimental)
  for await (const record of parseString(csv, { engine: { wasm: true } })) {
    console.log(record);
  }

  // Parse with both Worker and WASM (experimental)
  for await (const record of parseString(csv, {
    engine: { worker: true, wasm: true },
  })) {
    console.log(record);
  }
  ```

  **Performance Considerations:**

  - Worker initialization has overhead (~5-20ms depending on environment)
  - Best suited for:
    - Large CSV files (>1000 rows)
    - Maintaining UI responsiveness during parsing
    - Processing multiple CSVs concurrently
  - For small CSV files (<100 rows), main thread execution is typically faster

  **Known Limitations:**

  - Engine configuration is experimental and subject to change
  - Safari does not support Transferable Streams (automatically falls back to Message Streaming)
  - WASM only supports UTF-8 encoding and double-quote (`"`) as quotation character

  **Breaking Changes:**

  None. This is a backward-compatible addition. Existing code continues to work without changes.

  **Migration Guide:**

  No migration required. To use worker execution, simply add the `engine` option:

  ```typescript
  // Before (still works)
  parseString(csv);

  // After (with worker)
  parseString(csv, { engine: { worker: true } });

  // With WASM
  parseString(csv, { engine: { wasm: true } });

  // With both
  parseString(csv, { engine: { worker: true, wasm: true } });
  ```

  **Security Considerations:**

  - **Resource Protection**: When deploying applications that accept user-uploaded CSV files, it is strongly recommended to use `WorkerPool` with a limited `maxWorkers` setting to prevent resource exhaustion attacks
  - Malicious users could attempt to overwhelm the application by uploading multiple large CSV files simultaneously
  - Setting a reasonable `maxWorkers` limit (e.g., 2-4) helps protect against such attacks while maintaining good performance
  - Example secure configuration:

    ```typescript
    // Recommended: Limit concurrent workers to protect against attacks
    using pool = new WorkerPool({ maxWorkers: 4 });

    for await (const record of parseString(userUploadedCSV, {
      engine: { worker: true, workerPool: pool }
    })) {
      // Process records safely
    }
    ```

### Patch Changes

- [#547](https://github.com/kamiazya/web-csv-toolbox/pull/547) [`cec6905`](https://github.com/kamiazya/web-csv-toolbox/commit/cec6905200814e21efa17adbb4a6652519dd1e74) Thanks [@kamiazya](https://github.com/kamiazya)! - Fix AbortSignal propagation in Transform Stream components

  This release fixes a security vulnerability where AbortSignal was not properly propagated through the Transform Stream pipeline, allowing processing to continue even after abort requests.

  **Fixed Issues:**

  - Fixed `LexerTransformer` to accept and propagate `AbortSignal` to internal `Lexer` instance
  - Fixed `RecordAssemblerTransformer` to properly propagate `AbortSignal` to internal `RecordAssembler` instance
  - Added comprehensive tests for AbortSignal propagation in Transform Stream components
  - Added `waitAbort` helper function to handle race conditions in AbortSignal tests
  - Improved constructor initialization order in both Transformer classes for better code clarity

  **Code Quality Improvements:**

  - Added `LexerTransformerOptions` type definition for better type consistency across Transformer classes
  - Refactored constructors to initialize local variables before `super()` calls, improving code readability
  - Removed redundant type intersections in `RecordAssemblerTransformer`
  - Eliminated code duplication by moving test helpers to shared location

  **Security Impact:**

  This fix addresses a medium-severity security issue where attackers could bypass abort signals in streaming CSV processing. Without this fix, malicious actors could send large CSV payloads and continue consuming system resources (CPU, memory) even after cancellation attempts, potentially causing service degradation or temporary resource exhaustion.

  **Before this fix:**

  ```ts
  const controller = new AbortController();
  const stream = largeCSVStream
    .pipeThrough(new LexerTransformer({ signal: controller.signal }))
    .pipeThrough(new RecordAssemblerTransformer({ signal: controller.signal }));

  controller.abort(); // Signal was ignored - processing continued!
  ```

  **After this fix:**

  ```ts
  const controller = new AbortController();
  const stream = largeCSVStream
    .pipeThrough(new LexerTransformer({ signal: controller.signal }))
    .pipeThrough(new RecordAssemblerTransformer({ signal: controller.signal }));

  controller.abort(); // Processing stops immediately with AbortError
  ```

  Users processing untrusted CSV streams should ensure they implement proper timeout and abort signal handling to prevent resource exhaustion.

- [#548](https://github.com/kamiazya/web-csv-toolbox/pull/548) [`3946273`](https://github.com/kamiazya/web-csv-toolbox/commit/3946273aa1c59a7b4a9fae6c2dbfae0d80999761) Thanks [@kamiazya](https://github.com/kamiazya)! - Add binary size limit protection to prevent memory exhaustion attacks

  - Add `maxBinarySize` option (default: 100MB) for ArrayBuffer/Uint8Array inputs
  - Throw `RangeError` when binary size exceeds the limit
  - Update documentation with security considerations for large file handling
  - Add comprehensive tests for binary size validation

- [#550](https://github.com/kamiazya/web-csv-toolbox/pull/550) [`7565212`](https://github.com/kamiazya/web-csv-toolbox/commit/756521231cde231531fdb74f1a3eeee8400b17f8) Thanks [@VaishnaviOnPC](https://github.com/VaishnaviOnPC)! - docs: Add headerless csv example

- [#566](https://github.com/kamiazya/web-csv-toolbox/pull/566) [`9da8ea2`](https://github.com/kamiazya/web-csv-toolbox/commit/9da8ea20512f2a1e07c4d78092cecedb63cd5455) Thanks [@kamiazya](https://github.com/kamiazya)! - Fix header index mismatch when filtering empty header fields

  Fixed a critical bug in `CSVRecordAssembler` where empty header fields caused incorrect mapping of row values to headers during record assembly.

  ## The Bug

  When CSV headers contained empty fields (e.g., from trailing or leading commas), the record assembler would incorrectly map row values to header fields. This affected both the `#processToken()` method (for records with `RecordDelimiter`) and the `#flush()` method (for incomplete records at the end of streaming).

  **Example:**

  ```typescript
  // CSV with empty first header field:
  // ,name,age
  // skip,Alice,30

  // Before (incorrect):
  { name: 'skip', age: 'Alice' }

  // After (correct):
  { name: 'Alice', age: '30' }
  ```

  ## Root Cause

  The implementation filtered out empty headers first, then used the filtered array's indices to access `this.#row` values:

  ```typescript
  // Buggy code
  this.#header
    .filter((v) => v) // Filter creates new array with new indices
    .map((header, index) => [
      // 'index' is wrong - it's the filtered index
      header,
      this.#row.at(index), // Accesses wrong position in original row
    ]);
  ```

  ## The Fix

  Changed to preserve original indices before filtering:

  ```typescript
  // Fixed code
  this.#header
    .map((header, index) => [header, index] as const) // Capture original index
    .filter(([header]) => header) // Filter with index preserved
    .map(([header, index]) => [header, this.#row.at(index)]); // Use original index
  ```

  This fix is applied to both:

  - `#processToken()` - for records ending with `RecordDelimiter`
  - `#flush()` - for incomplete records at end of stream

  ## Impact

  This bug affected any CSV with empty header fields, which can occur from:

  - Trailing commas in headers: `name,age,`
  - Leading commas in headers: `,name,age`
  - Multiple consecutive commas: `name,,age`

  All such cases now correctly map row values to their corresponding headers.

- [#542](https://github.com/kamiazya/web-csv-toolbox/pull/542) [`b317547`](https://github.com/kamiazya/web-csv-toolbox/commit/b317547d6764b326a27bccaf7719abab968317bd) Thanks [@kamiazya](https://github.com/kamiazya)! - Add GMO Security Program badge to README.md

- [#560](https://github.com/kamiazya/web-csv-toolbox/pull/560) [`a520d54`](https://github.com/kamiazya/web-csv-toolbox/commit/a520d54311834d80163dfd1b4be0162ac4d22908) Thanks [@VaishnaviOnPC](https://github.com/VaishnaviOnPC)! - Add skipEmptyLines option to ParseOptions and parsing functions.

- [#561](https://github.com/kamiazya/web-csv-toolbox/pull/561) [`c3f786a`](https://github.com/kamiazya/web-csv-toolbox/commit/c3f786a4e480ec1609f1e5d305b955e18f6a1ac4) Thanks [@kamiazya](https://github.com/kamiazya)! - Improve ReadableStream to AsyncIterableIterator conversion with native async iteration support

  **Performance Improvements:**

  - `convertStreamToAsyncIterableIterator` now preferentially uses native `Symbol.asyncIterator` when available
  - Provides better performance in modern browsers and runtimes
  - Falls back to manual reader-based iteration for Safari and older environments
  - Improved condition check to verify async iterator is actually callable

  **Resource Management Improvements:**

  - Added proper error handling with `reader.cancel(error)` to release underlying resources on error
  - Cancel errors are gracefully ignored when already in error state
  - `reader.releaseLock()` is always called in `finally` block for reliable cleanup
  - Prevents potential memory leaks from unreleased stream locks

## 0.12.0

### Minor Changes

- [#533](https://github.com/kamiazya/web-csv-toolbox/pull/533) [`b221fc7`](https://github.com/kamiazya/web-csv-toolbox/commit/b221fc714faa4b33d33a3349982a1608d8a19b2f) Thanks [@kamiazya](https://github.com/kamiazya)! - Migrate to ESM-only distribution

  This release removes CommonJS (CJS) and UMD build outputs, distributing only ES modules (ESM). All build artifacts are now placed directly in the `dist/` directory for a simpler and cleaner structure.

  ### Breaking Changes

  - **Removed CommonJS support**: The package no longer provides `.cjs` files. Node.js projects must use ES modules.
  - **Removed UMD bundle**: The UMD build (`dist/web-csv-toolbox.umd.js`) has been removed. For CDN usage, use ESM via `<script type="module">`.
  - **Changed distribution structure**: Build outputs moved from `dist/es/`, `dist/cjs/`, and `dist/types/` to `dist/` root directory.
  - **Removed `build:browser` command**: The separate UMD build step is no longer needed.

  ### Migration Guide

  **For Node.js users:**

  - Ensure your project uses `"type": "module"` in `package.json`, or use `.mjs` file extensions
  - Update any CommonJS `require()` calls to ESM `import` statements
  - Node.js 20.x or later is required (already the minimum supported version)

  **For CDN users:**
  Before:

  ```html
  <script src="https://unpkg.com/web-csv-toolbox"></script>
  ```

  After:

  ```html
  <script type="module">
    import { parse } from "https://unpkg.com/web-csv-toolbox";
  </script>
  ```

  **For bundler users:**
  No changes required - modern bundlers handle ESM correctly.

  ### Benefits

  - Simpler build configuration and faster build times
  - Smaller package size
  - Cleaner distribution structure
  - Alignment with modern JavaScript ecosystem standards

- [#476](https://github.com/kamiazya/web-csv-toolbox/pull/476) [`ae54611`](https://github.com/kamiazya/web-csv-toolbox/commit/ae54611c2b5801dc7027e1c7d2d89cca51e6dd5f) Thanks [@kamiazya](https://github.com/kamiazya)! - Drop support Node.js v18 and Add test on Node.js v24

### Patch Changes

- [#535](https://github.com/kamiazya/web-csv-toolbox/pull/535) [`009c762`](https://github.com/kamiazya/web-csv-toolbox/commit/009c762a8c080242913ba7bf698f66c645d5eff8) Thanks [@egoitz-ehu](https://github.com/egoitz-ehu)! - Close issue #524

- [#532](https://github.com/kamiazya/web-csv-toolbox/pull/532) [`fc4fc57`](https://github.com/kamiazya/web-csv-toolbox/commit/fc4fc577fe49e68164909f314c7d5ec6b4e82a46) Thanks [@sshekhar563](https://github.com/sshekhar563)! - fix(docs): correct typo 'Lexter' → 'Lexer' in Lexer.ts JSDoc

- [#529](https://github.com/kamiazya/web-csv-toolbox/pull/529) [`76df785`](https://github.com/kamiazya/web-csv-toolbox/commit/76df7852502cd365d12f63500bbbb1fb45f3485c) Thanks [@kamiazya](https://github.com/kamiazya)! - Migrate npm package publishing to OIDC trusted publishing for enhanced security

- [#531](https://github.com/kamiazya/web-csv-toolbox/pull/531) [`a273b9d`](https://github.com/kamiazya/web-csv-toolbox/commit/a273b9da8477ad58f50239be69229ab3bf519551) Thanks [@VaishnaviOnPC](https://github.com/VaishnaviOnPC)! - fix: correct typo in escapeField.ts comment ('ASSTPTED' → 'ASSERTED')

## 0.11.2

### Patch Changes

- [#474](https://github.com/kamiazya/web-csv-toolbox/pull/474) [`21a3e4e`](https://github.com/kamiazya/web-csv-toolbox/commit/21a3e4ed39573526303b3caa93747bf0ac1b83f7) Thanks [@kamiazya](https://github.com/kamiazya)! - Fix and refactor documentation deploy workflow

## 0.11.1

### Patch Changes

- [#471](https://github.com/kamiazya/web-csv-toolbox/pull/471) [`ff5534e`](https://github.com/kamiazya/web-csv-toolbox/commit/ff5534eaed8b774c50297cbf783dde2853663b42) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump serde_json from 1.0.125 to 1.0.140 in /web-csv-toolbox-wasm

- [#471](https://github.com/kamiazya/web-csv-toolbox/pull/471) [`ff5534e`](https://github.com/kamiazya/web-csv-toolbox/commit/ff5534eaed8b774c50297cbf783dde2853663b42) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump csv from 1.3.0 to 1.3.1 in /web-csv-toolbox-wasm

- [#472](https://github.com/kamiazya/web-csv-toolbox/pull/472) [`96582d0`](https://github.com/kamiazya/web-csv-toolbox/commit/96582d0588a88a6c5dbb592a2ca1f3369118ea94) Thanks [@kamiazya](https://github.com/kamiazya)! - Upgrade dev dependencies

  - Add wasm-pack to 0.13
  - Updated biome to 1.9
  - Updated typedoc to 0.28
  - Updated TypeScript to 5.8
  - Updated Vite to 6.3
  - Updated vite-plugin-dts to 4.5
  - Updated vitest to 3.2
  - Updated webdriverio to 9.15

  ## Summary of Changes

  - Added `hexa` function for generating hexadecimal strings.
  - Introduced `unicode` and `unicodeMapper` functions for better Unicode string handling.
  - Updated `text` function to utilize new string generation methods for "hexa", "unicode", and "string16bits".
  - Cleaned up snapshot tests in `parseResponse.spec.ts` and `parseResponseToStream.spec.ts` by removing unnecessary comments.
  - Created a new declaration file for the `web-csv-toolbox-wasm` module to improve type safety.
  - Modified `tsconfig.json` to exclude all test files from compilation, improving build performance.

- [#471](https://github.com/kamiazya/web-csv-toolbox/pull/471) [`ff5534e`](https://github.com/kamiazya/web-csv-toolbox/commit/ff5534eaed8b774c50297cbf783dde2853663b42) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump compiler_builtins from 0.1.119 to 0.1.158 in /web-csv-toolbox-wasm

- [#471](https://github.com/kamiazya/web-csv-toolbox/pull/471) [`ff5534e`](https://github.com/kamiazya/web-csv-toolbox/commit/ff5534eaed8b774c50297cbf783dde2853663b42) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.2.4 to 4.0.15

- [#471](https://github.com/kamiazya/web-csv-toolbox/pull/471) [`ff5534e`](https://github.com/kamiazya/web-csv-toolbox/commit/ff5534eaed8b774c50297cbf783dde2853663b42) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps-dev): bump @changesets/cli from 2.27.6 to 2.29.3

- [#471](https://github.com/kamiazya/web-csv-toolbox/pull/471) [`ff5534e`](https://github.com/kamiazya/web-csv-toolbox/commit/ff5534eaed8b774c50297cbf783dde2853663b42) Thanks [@kamiazya](https://github.com/kamiazya)! - Use fast-check instead of @fast-check/vitest in test files

- [#471](https://github.com/kamiazya/web-csv-toolbox/pull/471) [`ff5534e`](https://github.com/kamiazya/web-csv-toolbox/commit/ff5534eaed8b774c50297cbf783dde2853663b42) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump the cargo group in /web-csv-toolbox-wasm with 2 updates

## 0.11.0

### Minor Changes

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - Dynamic Type Inference and User-Defined Types from CSV Headers

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - Remove InvalidOptionError class

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - Support AbortSignal

### Patch Changes

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps-dev): bump typedoc from 0.25.13 to 0.26.6

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps-dev): bump fast-check from 3.19.0 to 3.21.0

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps): bump wasm-pack from 0.12.1 to 0.13.0 in /web-csv-toolbox-wasm

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - Remove unnecessary processes for convertIterableIteratorToAsync function

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps): bump serde_json from 1.0.117 to 1.0.125 in /web-csv-toolbox-wasm

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps): bump serde from 1.0.203 to 1.0.208 in /web-csv-toolbox-wasm

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.2.1 to 3.2.4

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - Update concurrency configuration in main Workflow

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps): bump cxx-build from 1.0.124 to 1.0.126 in /web-csv-toolbox-wasm

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps): bump compiler_builtins from 0.1.112 to 0.1.119 in /web-csv-toolbox-wasm

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps-dev): bump vite from 5.3.1 to 5.4.2

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - Refactor CI/CD workflow

- [#343](https://github.com/kamiazya/web-csv-toolbox/pull/343) [`139f3c2`](https://github.com/kamiazya/web-csv-toolbox/commit/139f3c2e7e2dd12605b98fb10f885ed47e154f47) Thanks [@nagasawaryoya](https://github.com/nagasawaryoya)! - build(deps-dev): bump @biomejs/biome from 1.8.2 to 1.8.3

## 0.10.2

### Patch Changes

- [#269](https://github.com/kamiazya/web-csv-toolbox/pull/269) [`7b84c8c`](https://github.com/kamiazya/web-csv-toolbox/commit/7b84c8c8f6979cc45508bd1c3e1daeca8fe0a00a) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump cxx-build from 1.0.123 to 1.0.124 in /web-csv-toolbox-wasm

- [#272](https://github.com/kamiazya/web-csv-toolbox/pull/272) [`574bee2`](https://github.com/kamiazya/web-csv-toolbox/commit/574bee290399ac05fcd73c60c757421d23b317de) Thanks [@kamiazya](https://github.com/kamiazya)! - Update Snapshot release configuration

- [#274](https://github.com/kamiazya/web-csv-toolbox/pull/274) [`a163f35`](https://github.com/kamiazya/web-csv-toolbox/commit/a163f35fa08c92a57e24891740b488c906cf4dac) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.1.29 to 3.2.1

- [#276](https://github.com/kamiazya/web-csv-toolbox/pull/276) [`5daa58b`](https://github.com/kamiazya/web-csv-toolbox/commit/5daa58b5ed03fb78bf51f31ee26f3d680fac7ee4) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @biomejs/biome from 1.7.3 to 1.8.2

- [#266](https://github.com/kamiazya/web-csv-toolbox/pull/266) [`2c1e872`](https://github.com/kamiazya/web-csv-toolbox/commit/2c1e87207af2448180a6dc07be5290ab3744f005) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump terser from 5.31.0 to 5.31.1

- [#275](https://github.com/kamiazya/web-csv-toolbox/pull/275) [`2aa667c`](https://github.com/kamiazya/web-csv-toolbox/commit/2aa667c478c23d1aa9427e4c2a1c6c1aeb447b12) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @changesets/cli from 2.27.1 to 2.27.6

- [#267](https://github.com/kamiazya/web-csv-toolbox/pull/267) [`b6db634`](https://github.com/kamiazya/web-csv-toolbox/commit/b6db634668df4e5f15ea388eef66b2420a11ea42) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vite from 5.2.13 to 5.3.1

## 0.10.1

### Patch Changes

- [#253](https://github.com/kamiazya/web-csv-toolbox/pull/253) [`044b0e6`](https://github.com/kamiazya/web-csv-toolbox/commit/044b0e63da3c583aaf2e04c301eeb56e0ff2ed2d) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc from 0.25.12 to 0.25.13

- [#257](https://github.com/kamiazya/web-csv-toolbox/pull/257) [`926244a`](https://github.com/kamiazya/web-csv-toolbox/commit/926244a20b763d94f0956d5b1363c71fb3af7209) Thanks [@kamiazya](https://github.com/kamiazya)! - Remove lefthook configuration file

- [#259](https://github.com/kamiazya/web-csv-toolbox/pull/259) [`f4dd3d8`](https://github.com/kamiazya/web-csv-toolbox/commit/f4dd3d82c8f9921973463e2e0e001deccec262ca) Thanks [@kamiazya](https://github.com/kamiazya)! - Add .node-version file and update Node.js setup in GitHub workflows

- [#256](https://github.com/kamiazya/web-csv-toolbox/pull/256) [`a6b22e9`](https://github.com/kamiazya/web-csv-toolbox/commit/a6b22e993a1eeb93ddd177963afc8132852ea15b) Thanks [@kamiazya](https://github.com/kamiazya)! - Export errors classes

- [#250](https://github.com/kamiazya/web-csv-toolbox/pull/250) [`cbdb5cb`](https://github.com/kamiazya/web-csv-toolbox/commit/cbdb5cb45b90d6e174d96808ac576338993a9794) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vite-plugin-dts from 3.7.3 to 3.9.1

- [#255](https://github.com/kamiazya/web-csv-toolbox/pull/255) [`49af679`](https://github.com/kamiazya/web-csv-toolbox/commit/49af67945b5589d83ac00d2be4b83feb5e4a3859) Thanks [@kamiazya](https://github.com/kamiazya)! - Refactor ParseError class to extend SyntaxError

- [#251](https://github.com/kamiazya/web-csv-toolbox/pull/251) [`65db459`](https://github.com/kamiazya/web-csv-toolbox/commit/65db45913456c3df355c75afd1120f791bec79fa) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @fast-check/vitest from 0.1.0 to 0.1.1

- [#260](https://github.com/kamiazya/web-csv-toolbox/pull/260) [`6047e50`](https://github.com/kamiazya/web-csv-toolbox/commit/6047e50c151c93994aca59fac9d29ecb33d8a015) Thanks [@kamiazya](https://github.com/kamiazya)! - Add test on Node.js 22

- [#258](https://github.com/kamiazya/web-csv-toolbox/pull/258) [`824ef20`](https://github.com/kamiazya/web-csv-toolbox/commit/824ef201be688a22e699259f86d8cb9a5ebf734f) Thanks [@kamiazya](https://github.com/kamiazya)! - Update package manager to pnpm@9.3.0

- [#252](https://github.com/kamiazya/web-csv-toolbox/pull/252) [`1ebbdb4`](https://github.com/kamiazya/web-csv-toolbox/commit/1ebbdb43e954a236b889a0ca166386c836cc7e36) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.1.18 to 3.1.29

- [#239](https://github.com/kamiazya/web-csv-toolbox/pull/239) [`88fbef6`](https://github.com/kamiazya/web-csv-toolbox/commit/88fbef62cd710ad7fb85123276cb560634692d31) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump webdriverio from 8.34.1 to 8.38.2

## 0.10.0

### Minor Changes

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - Refactor error handling and add new error classes

### Patch Changes

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump cxx-build from 1.0.119 to 1.0.123 in /web-csv-toolbox-wasm

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump moonrepo/setup-rust from 1.1.0 to 1.2.0

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps-dev): bump vite from 5.1.7 to 5.2.13

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump compiler_builtins from 0.1.108 to 0.1.112 in /web-csv-toolbox-wasm

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump serde_json from 1.0.114 to 1.0.117 in /web-csv-toolbox-wasm

- [#185](https://github.com/kamiazya/web-csv-toolbox/pull/185) [`2b4aa28`](https://github.com/kamiazya/web-csv-toolbox/commit/2b4aa28e9d6147a7ffc0a5240742bf8c19d8cd2d) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump wasm-opt from 0.116.0 to 0.116.1 in /web-csv-toolbox-wasm

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps-dev): bump fast-check from 3.15.1 to 3.19.0

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - build(deps): bump serde from 1.0.197 to 1.0.203 in /web-csv-toolbox-wasm

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - Disable macos FireFox browser testing on CI

- [#249](https://github.com/kamiazya/web-csv-toolbox/pull/249) [`d05beb2`](https://github.com/kamiazya/web-csv-toolbox/commit/d05beb2a17f471d0ffd7deaa6471e788bc55ca4f) Thanks [@kamiazya](https://github.com/kamiazya)! - Add type check script and update CI workflow

## 0.9.0

### Minor Changes

- [`d8ad2f7`](https://github.com/kamiazya/web-csv-toolbox/commit/d8ad2f75267e78a1e30a0cb6f2c596925cf60c96) Thanks [@kamiazya](https://github.com/kamiazya)! - Add detailed position tracking for tokens

### Patch Changes

- [#208](https://github.com/kamiazya/web-csv-toolbox/pull/208) [`35997de`](https://github.com/kamiazya/web-csv-toolbox/commit/35997de35b4b06e1993bedc5986400a669e0adc9) Thanks [@kamiazya](https://github.com/kamiazya)! - Create tea.yaml

- [#233](https://github.com/kamiazya/web-csv-toolbox/pull/233) [`4d3e09f`](https://github.com/kamiazya/web-csv-toolbox/commit/4d3e09f95735559101993f23a01c27bc6f93409e) Thanks [@kamiazya](https://github.com/kamiazya)! - Refactor test CSV generation code around BOM

- [#175](https://github.com/kamiazya/web-csv-toolbox/pull/175) [`f3234a7`](https://github.com/kamiazya/web-csv-toolbox/commit/f3234a74c91369ad03b51d41967bb9ea968f5550) Thanks [@kamiazya](https://github.com/kamiazya)! - Refactor Lexer for performance improvement

- [#182](https://github.com/kamiazya/web-csv-toolbox/pull/182) [`cb649b3`](https://github.com/kamiazya/web-csv-toolbox/commit/cb649b357585e2947345f836ab19410fb95715f8) Thanks [@kamiazya](https://github.com/kamiazya)! - Update benchmark iterations

- [#240](https://github.com/kamiazya/web-csv-toolbox/pull/240) [`cdfa359`](https://github.com/kamiazya/web-csv-toolbox/commit/cdfa359c8c68bba94a65d312c78e311bcdb02a64) Thanks [@kamiazya](https://github.com/kamiazya)! - Improve CSV token handling

- [#175](https://github.com/kamiazya/web-csv-toolbox/pull/175) [`f3234a7`](https://github.com/kamiazya/web-csv-toolbox/commit/f3234a74c91369ad03b51d41967bb9ea968f5550) Thanks [@kamiazya](https://github.com/kamiazya)! - Improve Lexer internal operation

- [#236](https://github.com/kamiazya/web-csv-toolbox/pull/236) [`129235a`](https://github.com/kamiazya/web-csv-toolbox/commit/129235a851281b4f225cfece23c63645ad22b031) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump terser from 5.29.2 to 5.31.0

- [#217](https://github.com/kamiazya/web-csv-toolbox/pull/217) [`ac010a7`](https://github.com/kamiazya/web-csv-toolbox/commit/ac010a7748aa90aa6cb7fc67d844528af748fde4) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @biomejs/biome from 1.6.1 to 1.7.3

## 0.8.0

### Minor Changes

- [#168](https://github.com/kamiazya/web-csv-toolbox/pull/168) [`7fad0d1`](https://github.com/kamiazya/web-csv-toolbox/commit/7fad0d16446181bcc65d59c6f3298e7a106f3203) Thanks [@kamiazya](https://github.com/kamiazya)! - Refactor CSV parsing options and assertions

### Patch Changes

- [`4a0077c`](https://github.com/kamiazya/web-csv-toolbox/commit/4a0077c2e8d708a21b31042df80f979b82ff503c) Thanks [@kamiazya](https://github.com/kamiazya)! - Add vitest benchmark test and codspeed intagration

## 0.7.5

### Patch Changes

- [#151](https://github.com/kamiazya/web-csv-toolbox/pull/151) [`0435339`](https://github.com/kamiazya/web-csv-toolbox/commit/0435339706a973909c58e58a36472c6ac9ff62d9) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump serde from 1.0.196 to 1.0.197 in /web-csv-toolbox-wasm

- [#152](https://github.com/kamiazya/web-csv-toolbox/pull/152) [`2a39563`](https://github.com/kamiazya/web-csv-toolbox/commit/2a39563cc7e015a220a56b311edba5b731f7c61c) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump cxx-build from 1.0.116 to 1.0.119 in /web-csv-toolbox-wasm

- [#153](https://github.com/kamiazya/web-csv-toolbox/pull/153) [`0025866`](https://github.com/kamiazya/web-csv-toolbox/commit/0025866f1c5df2bbc110d92b6fadaa6b55caac30) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump codecov/codecov-action from 4.0.2 to 4.1.0

- [#154](https://github.com/kamiazya/web-csv-toolbox/pull/154) [`65c6413`](https://github.com/kamiazya/web-csv-toolbox/commit/65c6413a63db50fa825a3630d362e1cb26fb81eb) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump terser from 5.27.0 to 5.29.2

- [#155](https://github.com/kamiazya/web-csv-toolbox/pull/155) [`d7dcec4`](https://github.com/kamiazya/web-csv-toolbox/commit/d7dcec41bc17b0dd7ad84c08358c9d5f4784edd3) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump web-sys from 0.3.68 to 0.3.69 in /web-csv-toolbox-wasm

- [#157](https://github.com/kamiazya/web-csv-toolbox/pull/157) [`aea3d17`](https://github.com/kamiazya/web-csv-toolbox/commit/aea3d173bbd6c0b4e2c3a1917354d9d98345bd24) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump wasm-bindgen from 0.2.91 to 0.2.92 in /web-csv-toolbox-wasm

- [#161](https://github.com/kamiazya/web-csv-toolbox/pull/161) [`e61b090`](https://github.com/kamiazya/web-csv-toolbox/commit/e61b0909d4f6b66acc5a1f0e69482687ca21198f) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @biomejs/biome from 1.5.3 to 1.6.1

- [#162](https://github.com/kamiazya/web-csv-toolbox/pull/162) [`05bde86`](https://github.com/kamiazya/web-csv-toolbox/commit/05bde864ff2d3bb2ffc603c4ecade3cfbf2e5787) Thanks [@kamiazya](https://github.com/kamiazya)! - Update import statements to use type imports

## 0.7.4

### Patch Changes

- [#118](https://github.com/kamiazya/web-csv-toolbox/pull/118) [`3df7386`](https://github.com/kamiazya/web-csv-toolbox/commit/3df73863ed20794985a038f982a6b8ea9f8194cf) Thanks [@kamiazya](https://github.com/kamiazya)! - Create update-license-year.yaml

- [#108](https://github.com/kamiazya/web-csv-toolbox/pull/108) [`bcd6490`](https://github.com/kamiazya/web-csv-toolbox/commit/bcd64903a19c363a289193a65470a8c38b52e94e) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/configure-pages from 3.0.7 to 4.0.0

- [#109](https://github.com/kamiazya/web-csv-toolbox/pull/109) [`401cb18`](https://github.com/kamiazya/web-csv-toolbox/commit/401cb1873ee09dc9deef14488c36272e21421094) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump codecov/codecov-action from 3.1.6 to 4.0.1

- [#110](https://github.com/kamiazya/web-csv-toolbox/pull/110) [`9a030a2`](https://github.com/kamiazya/web-csv-toolbox/commit/9a030a2a60854c2bc5125e99e3835fc3fc75158d) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/github-script from 6.4.1 to 7.0.1

- [#111](https://github.com/kamiazya/web-csv-toolbox/pull/111) [`6a92edd`](https://github.com/kamiazya/web-csv-toolbox/commit/6a92eddc54f673d7765966c6648a88ec3d0184fe) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump denoland/setup-deno from 1.1.3 to 1.1.4

- [#112](https://github.com/kamiazya/web-csv-toolbox/pull/112) [`60d90da`](https://github.com/kamiazya/web-csv-toolbox/commit/60d90da0b0fd271198e4e95e3967c154b15950a9) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/setup-python from 4.7.1 to 5.0.0

- [#113](https://github.com/kamiazya/web-csv-toolbox/pull/113) [`859b0ed`](https://github.com/kamiazya/web-csv-toolbox/commit/859b0edbbee8054dc934f9e9f4d73fc936875854) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.1.14 to 3.1.15

- [#114](https://github.com/kamiazya/web-csv-toolbox/pull/114) [`46faf64`](https://github.com/kamiazya/web-csv-toolbox/commit/46faf644b63efaae56f63f844189681a82c5eb63) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump husky from 9.0.7 to 9.0.10

- [#124](https://github.com/kamiazya/web-csv-toolbox/pull/124) [`24e3e4b`](https://github.com/kamiazya/web-csv-toolbox/commit/24e3e4b9166e8f141aa65f051ffcf4f5391d051a) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/setup-node from 4.0.1 to 4.0.2

- [#125](https://github.com/kamiazya/web-csv-toolbox/pull/125) [`63fd59c`](https://github.com/kamiazya/web-csv-toolbox/commit/63fd59ca2a76f70a7d92d3718659b4b5131bf663) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/upload-pages-artifact from 3.0.0 to 3.0.1

- [#127](https://github.com/kamiazya/web-csv-toolbox/pull/127) [`268018d`](https://github.com/kamiazya/web-csv-toolbox/commit/268018d07ebed3bafc4be794a43020d6d39b471c) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump webdriverio from 8.29.7 to 8.31.0

- [#128](https://github.com/kamiazya/web-csv-toolbox/pull/128) [`95a7d09`](https://github.com/kamiazya/web-csv-toolbox/commit/95a7d0969cc434eb5c8831dced5a155e6cf91bef) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/deploy-pages from 4.0.3 to 4.0.4

- [#129](https://github.com/kamiazya/web-csv-toolbox/pull/129) [`da273c8`](https://github.com/kamiazya/web-csv-toolbox/commit/da273c89927e1627233d6de426e7aad09a58efb0) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump web-sys from 0.3.67 to 0.3.68 in /web-csv-toolbox-wasm

- [#130](https://github.com/kamiazya/web-csv-toolbox/pull/130) [`e66e8ad`](https://github.com/kamiazya/web-csv-toolbox/commit/e66e8ad0572e56c3ac8e67211e9481075aa5cb7a) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/upload-artifact from 4.3.0 to 4.3.1

- [#131](https://github.com/kamiazya/web-csv-toolbox/pull/131) [`8bc8c19`](https://github.com/kamiazya/web-csv-toolbox/commit/8bc8c19e0c694819e3b2e5d40ff1e3f742ea3a5f) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump wasm-bindgen from 0.2.90 to 0.2.91 in /web-csv-toolbox-wasm

- [#132](https://github.com/kamiazya/web-csv-toolbox/pull/132) [`73c1409`](https://github.com/kamiazya/web-csv-toolbox/commit/73c1409debefd3a71008978f2074f2e7263b1e15) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump lint-staged from 15.2.1 to 15.2.2

- [#133](https://github.com/kamiazya/web-csv-toolbox/pull/133) [`c1d593b`](https://github.com/kamiazya/web-csv-toolbox/commit/c1d593b93ecdab954958456e7eb3b6710cbb223e) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump compiler_builtins from 0.1.107 to 0.1.108 in /web-csv-toolbox-wasm

- [#136](https://github.com/kamiazya/web-csv-toolbox/pull/136) [`2f60c6f`](https://github.com/kamiazya/web-csv-toolbox/commit/2f60c6f5ab8b1caa39bb89a5442d64600e9f1670) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/download-artifact from 4.1.1 to 4.1.2

- [#137](https://github.com/kamiazya/web-csv-toolbox/pull/137) [`a9d864f`](https://github.com/kamiazya/web-csv-toolbox/commit/a9d864fee5c034d9731a61b49c75dcc0c4d36edd) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump pnpm/action-setup from 2.4.0 to 3.0.0

- [#139](https://github.com/kamiazya/web-csv-toolbox/pull/139) [`88590c2`](https://github.com/kamiazya/web-csv-toolbox/commit/88590c270be142a0923b0f1f3682271924ea6365) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vite from 5.0.12 to 5.1.1

- [#140](https://github.com/kamiazya/web-csv-toolbox/pull/140) [`dead424`](https://github.com/kamiazya/web-csv-toolbox/commit/dead4246dbe1ba8ad2c9d2b3413f5d4f7f283fab) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump webdriverio from 8.31.0 to 8.31.1

- [#141](https://github.com/kamiazya/web-csv-toolbox/pull/141) [`4710eec`](https://github.com/kamiazya/web-csv-toolbox/commit/4710eec87cb715989801a4ee3cec37f4fb9444e7) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.1.15 to 3.1.16

- [#142](https://github.com/kamiazya/web-csv-toolbox/pull/142) [`3a8fc90`](https://github.com/kamiazya/web-csv-toolbox/commit/3a8fc9098648c3d9d5c5327f23f988ed8441f615) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump cxx-build from 1.0.115 to 1.0.116 in /web-csv-toolbox-wasm

- [#143](https://github.com/kamiazya/web-csv-toolbox/pull/143) [`952b6b6`](https://github.com/kamiazya/web-csv-toolbox/commit/952b6b60f3fdd7dc3d7200fcbd164fea212325c6) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump husky from 9.0.10 to 9.0.11

- [#144](https://github.com/kamiazya/web-csv-toolbox/pull/144) [`58bf707`](https://github.com/kamiazya/web-csv-toolbox/commit/58bf70782a7b6bc6a3bb70a16d2677f62587895c) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump changesets/action from 1.4.5 to 1.4.6

- [#145](https://github.com/kamiazya/web-csv-toolbox/pull/145) [`5d839be`](https://github.com/kamiazya/web-csv-toolbox/commit/5d839be594804613929e236086d9fa862ccce4bf) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump thollander/actions-comment-pull-request from 2.4.3 to 2.5.0

- [#146](https://github.com/kamiazya/web-csv-toolbox/pull/146) [`15f972e`](https://github.com/kamiazya/web-csv-toolbox/commit/15f972e69227e496d59cdf9d373c7b76132d4562) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump the npm_and_yarn group across 1 directories with 1 update

- [#147](https://github.com/kamiazya/web-csv-toolbox/pull/147) [`0a9d60c`](https://github.com/kamiazya/web-csv-toolbox/commit/0a9d60cae8d547f0d2f13186f0f02c1c12aa37dc) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump serde_json from 1.0.113 to 1.0.114 in /web-csv-toolbox-wasm

- [#148](https://github.com/kamiazya/web-csv-toolbox/pull/148) [`a4031f5`](https://github.com/kamiazya/web-csv-toolbox/commit/a4031f521043d180f9154e21763ce75620bb6d22) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump codecov/codecov-action from 4.0.1 to 4.0.2

- [#149](https://github.com/kamiazya/web-csv-toolbox/pull/149) [`c7fbb8a`](https://github.com/kamiazya/web-csv-toolbox/commit/c7fbb8ad37262c8a4d3842f6a6e58749b34a7cbd) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump actions/download-artifact from 4.1.2 to 4.1.4

- [#150](https://github.com/kamiazya/web-csv-toolbox/pull/150) [`d2bebfc`](https://github.com/kamiazya/web-csv-toolbox/commit/d2bebfcf374c4144423e4964e06ea74e0325aaaf) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc from 0.25.7 to 0.25.12

- [#134](https://github.com/kamiazya/web-csv-toolbox/pull/134) [`cf1f9ae`](https://github.com/kamiazya/web-csv-toolbox/commit/cf1f9ae6ef379686a68d8afd112dd541129b0a3f) Thanks [@kamiazya](https://github.com/kamiazya)! - Fix artefacts summary generation condition

- [#95](https://github.com/kamiazya/web-csv-toolbox/pull/95) [`8e6b7ac`](https://github.com/kamiazya/web-csv-toolbox/commit/8e6b7ac563e340e72496991d33cde714f4d36b51) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @fast-check/vitest from 0.0.9 to 0.1.0

- [#119](https://github.com/kamiazya/web-csv-toolbox/pull/119) [`4699780`](https://github.com/kamiazya/web-csv-toolbox/commit/4699780384169243e56ef4614035fde57d4ca792) Thanks [@github-actions](https://github.com/apps/github-actions)! - Update license copyright year(s)

- [#115](https://github.com/kamiazya/web-csv-toolbox/pull/115) [`30ab2e8`](https://github.com/kamiazya/web-csv-toolbox/commit/30ab2e82258454fdfde9270b1e797183a7deb4b5) Thanks [@kamiazya](https://github.com/kamiazya)! - Fix Lexer class

- [#107](https://github.com/kamiazya/web-csv-toolbox/pull/107) [`a47248f`](https://github.com/kamiazya/web-csv-toolbox/commit/a47248fb4f23f709753decaba26d9f739c1b7238) Thanks [@kamiazya](https://github.com/kamiazya)! - Improve GitHub Actions Workflows

- [#135](https://github.com/kamiazya/web-csv-toolbox/pull/135) [`21b2d9c`](https://github.com/kamiazya/web-csv-toolbox/commit/21b2d9ccfbb896297a9c47483a2e093aafe3591d) Thanks [@kamiazya](https://github.com/kamiazya)! - Pined license year action versions

- [#94](https://github.com/kamiazya/web-csv-toolbox/pull/94) [`379d899`](https://github.com/kamiazya/web-csv-toolbox/commit/379d899fb3756f5e779771f6c4df68f0bb9289c0) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump lint-staged from 15.2.0 to 15.2.1

## 0.7.3

### Patch Changes

- [#101](https://github.com/kamiazya/web-csv-toolbox/pull/101) [`534dff9`](https://github.com/kamiazya/web-csv-toolbox/commit/534dff9c3e2e02140d79097053603df4283ffa3f) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump webdriverio from 8.29.1 to 8.29.7

- [#104](https://github.com/kamiazya/web-csv-toolbox/pull/104) [`10c7be9`](https://github.com/kamiazya/web-csv-toolbox/commit/10c7be97fb84a5d74acae4eaebe379c353c9fc2a) Thanks [@kamiazya](https://github.com/kamiazya)! - Add tests

- [#96](https://github.com/kamiazya/web-csv-toolbox/pull/96) [`93e0f9c`](https://github.com/kamiazya/web-csv-toolbox/commit/93e0f9c6f2d36e4aa856e624ccec513b3f84d462) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump fast-check from 3.15.0 to 3.15.1

- [#102](https://github.com/kamiazya/web-csv-toolbox/pull/102) [`15a15f9`](https://github.com/kamiazya/web-csv-toolbox/commit/15a15f9fc1c973ad6aab9daf6e38e402475b68b7) Thanks [@kamiazya](https://github.com/kamiazya)! - Fix CI triggers

- [#100](https://github.com/kamiazya/web-csv-toolbox/pull/100) [`3eda346`](https://github.com/kamiazya/web-csv-toolbox/commit/3eda346ca68b6a0da36825d3f813e936c34d6aab) Thanks [@kamiazya](https://github.com/kamiazya)! - Update CI/CD workflows and Correct Coverage

- [#92](https://github.com/kamiazya/web-csv-toolbox/pull/92) [`9988bd7`](https://github.com/kamiazya/web-csv-toolbox/commit/9988bd7edaa3ca16c9b16bcdd46ddcee39e61934) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump compiler_builtins from 0.1.106 to 0.1.107 in /web-csv-toolbox-wasm

## 0.7.2

### Patch Changes

- [#83](https://github.com/kamiazya/web-csv-toolbox/pull/83) [`08de2d0`](https://github.com/kamiazya/web-csv-toolbox/commit/08de2d0e47b58f323129c8a18e2237357bbeaf85) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @biomejs/biome from 1.5.2 to 1.5.3

- [#98](https://github.com/kamiazya/web-csv-toolbox/pull/98) [`e156adb`](https://github.com/kamiazya/web-csv-toolbox/commit/e156adb80493aab43f236c4275bda51ebbc82193) Thanks [@kamiazya](https://github.com/kamiazya)! - Add provenance to publishConfig in package.json

## 0.7.1

### Patch Changes

- [#86](https://github.com/kamiazya/web-csv-toolbox/pull/86) [`44a6697`](https://github.com/kamiazya/web-csv-toolbox/commit/44a6697d2daa721d7269971c3c2824ac94b996d5) Thanks [@kamiazya](https://github.com/kamiazya)! - Add web_csv_toolbox_wasm_bg.wasm to package.json

- [#90](https://github.com/kamiazya/web-csv-toolbox/pull/90) [`5dcae2e`](https://github.com/kamiazya/web-csv-toolbox/commit/5dcae2e49b45b6575a088692db2c3ed252e21317) Thanks [@kamiazya](https://github.com/kamiazya)! - Migrate Husky to v9

- [#87](https://github.com/kamiazya/web-csv-toolbox/pull/87) [`e308015`](https://github.com/kamiazya/web-csv-toolbox/commit/e30801534edc487a9df544049be2ae6adad37156) Thanks [@kamiazya](https://github.com/kamiazya)! - Add PullRequest snapshot release action

- [#84](https://github.com/kamiazya/web-csv-toolbox/pull/84) [`de81672`](https://github.com/kamiazya/web-csv-toolbox/commit/de816725338ae2fec542cd505a4922538c86bd68) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps): bump serde_json from 1.0.112 to 1.0.113 in /web-csv-toolbox-wasm

- [#91](https://github.com/kamiazya/web-csv-toolbox/pull/91) [`14f7dab`](https://github.com/kamiazya/web-csv-toolbox/commit/14f7daba3f72734d4bb975dac3115a6a556a11fd) Thanks [@kamiazya](https://github.com/kamiazya)! - Fix documentation build

## 0.7.0

### Minor Changes

- [#70](https://github.com/kamiazya/web-csv-toolbox/pull/70) [`75642e9`](https://github.com/kamiazya/web-csv-toolbox/commit/75642e90ace412d1564537d2ca9655b66160949c) Thanks [@kamiazya](https://github.com/kamiazya)! - Support parsing CSV by WASM build by Rust

  - **New Features**

    - Introduced WebAssembly support for high-performance CSV parsing in the CSV Toolbox, including new APIs and limitations.
    - Added a weekly update schedule for cargo package dependencies.
    - Implemented a Vite plugin for integrating WebAssembly modules into projects.

  - **Enhancements**

    - Added new configuration rule for Rust files, setting indent size to 4 spaces.
    - Enhanced continuous integration and deployment workflows with additional steps for Rust and WebAssembly setup.
    - Updated documentation to reflect WebAssembly features and usage in CSV parsing.

  - **Chores**
    - Introduced linting and formatting checks for JavaScript, TypeScript, JSON, and Rust files.

### Patch Changes

- [#76](https://github.com/kamiazya/web-csv-toolbox/pull/76) [`c9194d2`](https://github.com/kamiazya/web-csv-toolbox/commit/c9194d22f6ce7883af3bed2bf8bac3abfc2dee33) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vitest from 1.2.0 to 1.2.1

- [#75](https://github.com/kamiazya/web-csv-toolbox/pull/75) [`9680f6b`](https://github.com/kamiazya/web-csv-toolbox/commit/9680f6b83f6557764567afb78ff5880a0d624195) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vite-plugin-dts from 3.7.0 to 3.7.1

- [#80](https://github.com/kamiazya/web-csv-toolbox/pull/80) [`b5438c0`](https://github.com/kamiazya/web-csv-toolbox/commit/b5438c0c8dd45fd6161c643e701e88ad9ce77c82) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vitest from 1.2.1 to 1.2.2

- [#82](https://github.com/kamiazya/web-csv-toolbox/pull/82) [`ce5f78c`](https://github.com/kamiazya/web-csv-toolbox/commit/ce5f78c9adf19b6e8d214de1c4293ada7996f64c) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump webdriverio from 8.27.2 to 8.29.1

- [#81](https://github.com/kamiazya/web-csv-toolbox/pull/81) [`94010de`](https://github.com/kamiazya/web-csv-toolbox/commit/94010de3cac7041b34b647ec2013a06bea785441) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vite from 5.0.11 to 5.0.12

- [#77](https://github.com/kamiazya/web-csv-toolbox/pull/77) [`62d61aa`](https://github.com/kamiazya/web-csv-toolbox/commit/62d61aa1d121f71bd019f3862660ce966f8beb7a) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.1.12 to 3.1.13

- [#79](https://github.com/kamiazya/web-csv-toolbox/pull/79) [`802a86f`](https://github.com/kamiazya/web-csv-toolbox/commit/802a86f2c6532ffef5984ae89cc6d27b53c6f242) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @vitest/browser from 1.2.0 to 1.2.2

- [#73](https://github.com/kamiazya/web-csv-toolbox/pull/73) [`a9ed6d0`](https://github.com/kamiazya/web-csv-toolbox/commit/a9ed6d0d2aed31e0ab5fada2b50a336258a636f1) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump terser from 5.26.0 to 5.27.0

## 0.6.1

### Patch Changes

- [#66](https://github.com/kamiazya/web-csv-toolbox/pull/66) [`73acb1b`](https://github.com/kamiazya/web-csv-toolbox/commit/73acb1b8221500bb564852471026b969d84dcdac) Thanks [@kamiazya](https://github.com/kamiazya)! - Migrates the project to use pnpm as the package manager and updates the build and dependency setup accordingly.

  - **Chores**
    - Switched package management from npm to pnpm to improve installation efficiency and reliability.
    - Updated continuous integration and deployment workflows to support pnpm.

## 0.6.0

### Minor Changes

- [#62](https://github.com/kamiazya/web-csv-toolbox/pull/62) [`9bd0ccc`](https://github.com/kamiazya/web-csv-toolbox/commit/9bd0ccc2f100f58156672ca282c1d6562b414425) Thanks [@kamiazya](https://github.com/kamiazya)! - - **New Features**

  - Introduced a new build configuration for generating a UMD format of the web CSV toolbox library.
  - Updated export paths to enhance module accessibility.

  - **Bug Fixes**

    - Fixed import paths across various modules to ensure proper module resolution.

  - **Refactor**

    - Reorganized internal file structure for improved maintainability.
    - Renamed functions to better reflect their functionality.
    - Streamlined namespace declarations for consistency.

  - **Style**

    - Adjusted import statements to use consistent file extensions.

  - **Documentation**

    - None

  - **Tests**

    - Updated test import paths to align with the new directory structure.

  - **Chores**
    - Modified build settings for the library to optimize output.

### Patch Changes

- [#56](https://github.com/kamiazya/web-csv-toolbox/pull/56) [`781bc39`](https://github.com/kamiazya/web-csv-toolbox/commit/781bc3921bc115ac138926b3aeb36cdd5a39c016) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.1.11 to 3.1.12

- [#64](https://github.com/kamiazya/web-csv-toolbox/pull/64) [`8b76ac2`](https://github.com/kamiazya/web-csv-toolbox/commit/8b76ac20a13411ec98f112539b733c8655455557) Thanks [@kamiazya](https://github.com/kamiazya)! - Add file inclusion patterns to biome.json

- [#55](https://github.com/kamiazya/web-csv-toolbox/pull/55) [`ca0ae5a`](https://github.com/kamiazya/web-csv-toolbox/commit/ca0ae5ad2736063068b75fa57d59c8d9a7d8d86a) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @vitest/browser from 1.1.3 to 1.2.0

- [#65](https://github.com/kamiazya/web-csv-toolbox/pull/65) [`6329952`](https://github.com/kamiazya/web-csv-toolbox/commit/6329952aaddfef42c761b6752b6cde2b0daf805c) Thanks [@kamiazya](https://github.com/kamiazya)! - Add custom file naming for different formats in vite.config.ts

- [#57](https://github.com/kamiazya/web-csv-toolbox/pull/57) [`144aff0`](https://github.com/kamiazya/web-csv-toolbox/commit/144aff084e8321aa7c77b3c501b85af250e04edd) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vitest from 1.1.3 to 1.2.0

- [#60](https://github.com/kamiazya/web-csv-toolbox/pull/60) [`1b6c9ca`](https://github.com/kamiazya/web-csv-toolbox/commit/1b6c9ca7b9845a987b39bf6482bfc3c30186ee72) Thanks [@kamiazya](https://github.com/kamiazya)! - Fixes a test failure in the Lexer class and improves the escapeField function.

  Additionally, the escapeField function has been refactored to handle common options and improve performance.

  The occurrences utility has also been added to count the number of occurrences of a substring in a string. These changes address the issue #54 and improve the overall reliability and efficiency of the codebase.

  - **New Features**

    - Enhanced filtering capability with validation checks.
    - Improved field escaping logic for data processing.

  - **Refactor**
    - Optimized substring occurrence calculations with caching.

- [#58](https://github.com/kamiazya/web-csv-toolbox/pull/58) [`8ae227b`](https://github.com/kamiazya/web-csv-toolbox/commit/8ae227b9878f0ae06723efa3d72b4a04d87edae3) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump webdriverio from 8.27.0 to 8.27.2

## 0.5.3

### Patch Changes

- [#50](https://github.com/kamiazya/web-csv-toolbox/pull/50) [`1956d13`](https://github.com/kamiazya/web-csv-toolbox/commit/1956d13c10c2dc782f51f5645ebff6acc1f395f1) Thanks [@kamiazya](https://github.com/kamiazya)! - Update GitHub workflows and package.json

- [#53](https://github.com/kamiazya/web-csv-toolbox/pull/53) [`9ceb572`](https://github.com/kamiazya/web-csv-toolbox/commit/9ceb5726aa3bf1d6e584bd68c167a91e46d6ebb6) Thanks [@kamiazya](https://github.com/kamiazya)! - This pull request integrates Deno, Node.js, and Browsers CI workflows as CI and adds Release and Prerelease workflows as CD. It also includes the integration of the doc workflow to the CD workflow. These changes aim to improve the development and deployment processes by automating the testing, building, and releasing of the software.

  - **New Features**
    - Introduced Continuous Deployment (CD) workflow for automated build and release processes.
    - Automated package deployment to npm.
    - Automated pre-release publishing.
    - Automated deployment of documentation to GitHub Pages.
  - **Refactor**
    - Improved Continuous Integration (CI) workflow to include building and testing across different environments and platforms.
  - **Chores**
    - Updated workflow names for better clarity.

## 0.5.2

### Patch Changes

- [`61ce41e`](https://github.com/kamiazya/web-csv-toolbox/commit/61ce41eae006cae6f3260f7d8a42371edb082f40) Thanks [@kamiazya](https://github.com/kamiazya)! - Update Release

## 0.5.1

### Patch Changes

- [#47](https://github.com/kamiazya/web-csv-toolbox/pull/47) [`8c7b4f8`](https://github.com/kamiazya/web-csv-toolbox/commit/8c7b4f8ae6b535489a002fa048b5a8c77b14072a) Thanks [@kamiazya](https://github.com/kamiazya)! - Create SECURITY.md

- [#42](https://github.com/kamiazya/web-csv-toolbox/pull/42) [`9274c24`](https://github.com/kamiazya/web-csv-toolbox/commit/9274c24a9e0670a10837255fdda95866031ac9f8) Thanks [@kamiazya](https://github.com/kamiazya)! - Implemented a new build configuration using Vite for enhanced development experience.

- [#40](https://github.com/kamiazya/web-csv-toolbox/pull/40) [`f0b4fa9`](https://github.com/kamiazya/web-csv-toolbox/commit/f0b4fa9eb57a68ba38223d5d85a829671b379df3) Thanks [@kamiazya](https://github.com/kamiazya)! - Reorder exports in package.json

- [#45](https://github.com/kamiazya/web-csv-toolbox/pull/45) [`0032e9b`](https://github.com/kamiazya/web-csv-toolbox/commit/0032e9bf8766f3f40256ae8427c29abe349a8e85) Thanks [@kamiazya](https://github.com/kamiazya)! - Create CODE_OF_CONDUCT.md

- [#43](https://github.com/kamiazya/web-csv-toolbox/pull/43) [`181f229`](https://github.com/kamiazya/web-csv-toolbox/commit/181f2292cb1e99a09fc40df5ea634cec8a618dc9) Thanks [@kamiazya](https://github.com/kamiazya)! - Fix typedoc config

- [#48](https://github.com/kamiazya/web-csv-toolbox/pull/48) [`81baca5`](https://github.com/kamiazya/web-csv-toolbox/commit/81baca57fda4c0203bc8c23a9ee7b4bf02fea1fb) Thanks [@kamiazya](https://github.com/kamiazya)! - Update web-csv-toolbox badges and import statement

## 0.5.0

### Minor Changes

- [`c9c5d8b`](https://github.com/kamiazya/web-csv-toolbox/commit/c9c5d8bbcb895878b051d118d0fb18269f5d51f6) Thanks [@kamiazya](https://github.com/kamiazya)! - Refactoring

  - **New Features**

    - Introduced `Lexer`, `RecordAssembler`, and `LexerTransformer` classes to enhance CSV parsing capabilities.
    - Added new methods (`toArraySync`, `toIterableIterator`, `toStream`) across various modules for flexible data processing.
    - Expanded `parseArrayBuffer`, `parseResponse`, `parseString`, and `parseUint8Array` with additional output formats.

  - **Bug Fixes**

    - Corrected typos in several modules, changing `quate` to `quote` and `demiliter` to `delimiter`.
    - Allowed `undefined` values in `CSVRecord` type to improve data handling.

  - **Refactor**

    - Simplified constructors and updated logic in `LexerTransformer` and `RecordAssemblerTransformer`.
    - Enhanced type safety with refactored token types in common types module.

  - **Tests**

    - Added and refactored test cases for `Lexer`, `RecordAssembler`, `LexerTransformer`, and `escapeField` to ensure reliability.

  - **Documentation**
    - Updated descriptions and examples for new methods in various modules to assist users in understanding their usage.

### Patch Changes

- [#34](https://github.com/kamiazya/web-csv-toolbox/pull/34) [`7b13862`](https://github.com/kamiazya/web-csv-toolbox/commit/7b1386211e7ee76d33d8f047079d068419461822) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump vitest from 1.1.1 to 1.1.3

- [#33](https://github.com/kamiazya/web-csv-toolbox/pull/33) [`3d8f97a`](https://github.com/kamiazya/web-csv-toolbox/commit/3d8f97a7c40b630e1424fbebe827b2c9fe336ec4) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump rollup from 4.9.1 to 4.9.4

- [#36](https://github.com/kamiazya/web-csv-toolbox/pull/36) [`1a72392`](https://github.com/kamiazya/web-csv-toolbox/commit/1a7239260985b29763da8c79c979fdbdd0aeef4c) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc from 0.25.6 to 0.25.7

- [#35](https://github.com/kamiazya/web-csv-toolbox/pull/35) [`3b93b38`](https://github.com/kamiazya/web-csv-toolbox/commit/3b93b3829b79a2fc81718ee7d7f9bc430a609868) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump typedoc-plugin-mdn-links from 3.1.10 to 3.1.11

- [#37](https://github.com/kamiazya/web-csv-toolbox/pull/37) [`476fa06`](https://github.com/kamiazya/web-csv-toolbox/commit/476fa0659e6b3b0c78c9c97832d26f8a73aa25f1) Thanks [@dependabot](https://github.com/apps/dependabot)! - build(deps-dev): bump @vitest/browser from 1.1.1 to 1.1.3

## 0.4.0

### Minor Changes

- [#30](https://github.com/kamiazya/web-csv-toolbox/pull/30) [`9f9117b`](https://github.com/kamiazya/web-csv-toolbox/commit/9f9117b133085cb2f54458870088626607ab21fb) Thanks [@kamiazya](https://github.com/kamiazya)! - - **New Features**

  - Introduced support for `Uint8Array` and `ArrayBuffer` input parameters for CSV parsing.
  - Added new parsing functions for `Uint8Array` and `ArrayBuffer` inputs.
  - Enhanced parsing capabilities to handle various CSV data representations.

  - **Documentation**

    - Updated README to reflect support for new input types and parsing functions.

  - **Tests**

    - Added test suites for `parseArrayBuffer`, `parseUint8Array`, and `parseUint8ArrayStream` functions.

  - **Refactor**

    - Renamed `parseBinaryStream` to `parseUint8ArrayStream`.
    - Updated exported symbols and namespaces to align with the new functionality.
    - Modified existing parsing functions to accommodate new CSV data types.

  - **Style**
    - Adjusted enumerable and read-only property definitions using `Object.defineProperty` for consistency across namespaces.

## 0.3.2

### Patch Changes

- [`9ef79d2`](https://github.com/kamiazya/web-csv-toolbox/commit/9ef79d2a1286821580c974e1393ad464ffdb1343) Thanks [@kamiazya](https://github.com/kamiazya)! - Enhanced the extractQuotedString method in text processing to handle specific conditions more accurately.

- [#27](https://github.com/kamiazya/web-csv-toolbox/pull/27) [`196d562`](https://github.com/kamiazya/web-csv-toolbox/commit/196d56226afcedf054476955f9b3fbc9745a4efc) Thanks [@dependabot](https://github.com/apps/dependabot)! - Some devDependencies updates.

## 0.3.1

### Patch Changes

- [#21](https://github.com/kamiazya/web-csv-toolbox/pull/21) [`e5480ba`](https://github.com/kamiazya/web-csv-toolbox/commit/e5480bacddf29b6cce7c1f0b8d426c99f5c9e0ba) Thanks [@kamiazya](https://github.com/kamiazya)! - fix: add instalation docs for CSN and Deno

- [#19](https://github.com/kamiazya/web-csv-toolbox/pull/19) [`5f0b861`](https://github.com/kamiazya/web-csv-toolbox/commit/5f0b86110b92f6e2c8b747341e424f6a7944d57b) Thanks [@kamiazya](https://github.com/kamiazya)! - Cross platform tests

## 0.3.0

### Minor Changes

- [#18](https://github.com/kamiazya/web-csv-toolbox/pull/18) [`cd5b9b9`](https://github.com/kamiazya/web-csv-toolbox/commit/cd5b9b9959039ac3e89e5e00a1a46614266ee882) Thanks [@kamiazya](https://github.com/kamiazya)! - feat: add support cdn

### Patch Changes

- [#16](https://github.com/kamiazya/web-csv-toolbox/pull/16) [`d8cbb1f`](https://github.com/kamiazya/web-csv-toolbox/commit/d8cbb1fc8e03fe5ee5986721a8b52378894f37bc) Thanks [@kamiazya](https://github.com/kamiazya)! - ci: fix snapshot release flow

## 0.2.0

### Minor Changes

- [#14](https://github.com/kamiazya/web-csv-toolbox/pull/14) [`8f2590e`](https://github.com/kamiazya/web-csv-toolbox/commit/8f2590e188f085808df05d5651f4999f86c4b22c) Thanks [@kamiazya](https://github.com/kamiazya)! - - Add more detailed documents.
  - Fixed a naming conventions problem in the documentation.
    - Changed `streamingParse` to `parseString`.

## 0.1.0

### Minor Changes

- [#12](https://github.com/kamiazya/web-csv-toolbox/pull/12) [`50475b3`](https://github.com/kamiazya/web-csv-toolbox/commit/50475b3f6be49e52a646eed389e72fe6efe0140d) Thanks [@kamiazya](https://github.com/kamiazya)! - doc: Publish TypeDoc to GitHub Pages

### Patch Changes

- [#11](https://github.com/kamiazya/web-csv-toolbox/pull/11) [`b48c782`](https://github.com/kamiazya/web-csv-toolbox/commit/b48c7829e5e3af1e986b3c32ffc12f41bab78e99) Thanks [@kamiazya](https://github.com/kamiazya)! - ci: add snapshot release

- [#6](https://github.com/kamiazya/web-csv-toolbox/pull/6) [`e183d61`](https://github.com/kamiazya/web-csv-toolbox/commit/e183d619c34cdcc6c9317454f7b84b02c8ba8e59) Thanks [@kamiazya](https://github.com/kamiazya)! - Create dependabot.yml

- [#13](https://github.com/kamiazya/web-csv-toolbox/pull/13) [`761c533`](https://github.com/kamiazya/web-csv-toolbox/commit/761c5336d410a1f288f844bc1f248fc4abc19fd7) Thanks [@kamiazya](https://github.com/kamiazya)! - ci: add GitHub Release after release

## 0.0.2

### Patch Changes

- 4be404f: ci: add build step before release

## 0.0.1

### Patch Changes

- 5402d6a: Initial Release for `web-csv-toolbox`, what is A CSV Toolbox utilizing Web Standard APIs.

  ## Key concepts

  - Web Standards first.
    - Using the [Web Streams API](https://streams.spec.whatwg.org/).
  - TypeScript friendly & User friendly.
    - Fully typed and documented.
  - Zero dependencies.
    - Using only Web Standards APIs.
  - Property-based testing.
    - Using [fast-check](https://fast-check.dev/) and [vitest](https://vitest.dev).
  - **To Be Tested** Cross platform.
    - Works on browsers and Node.js, Deno
      - Only web standard APIs are used, so it should work with these Runtimes.

  ## Key features

  - Parses CSV files using the [WHATWG Streams API](https://streams.spec.whatwg.org/).
  - Supports parsing CSV files from strings, `ReadableStream`s, and `Response` objects.
  - Supports parsing CSV files with different delimiters and quotation characters.
    - Defaults to `,` and `"` respectively.
    - Supports parsing TSV files by setting `delimiter` to `\t`.
    - Supports parsing with multi-character/multi-byte delimiters and quotation characters.
  - Supports parsing binary CSV files.
