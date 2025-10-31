---
web-csv-toolbox: minor
---

Add experimental worker thread execution support for CSV parsing

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
import { parseString } from 'web-csv-toolbox';

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
for await (const record of parseString(csv, { engine: { worker: true, wasm: true } })) {
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
parseString(csv)

// After (with worker)
parseString(csv, { engine: { worker: true } })

// With WASM
parseString(csv, { engine: { wasm: true } })

// With both
parseString(csv, { engine: { worker: true, wasm: true } })
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
