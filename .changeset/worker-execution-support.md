---
web-csv-toolbox: minor
---

Add experimental worker thread execution support for CSV parsing

This release introduces experimental worker thread execution support, enabling CSV parsing to be offloaded to a separate thread. This keeps the main thread responsive, particularly beneficial for large CSV files in browser environments.

**New Features:**

- Added `execution` option to all parsing functions (`parseString`, `parseBinary`, `parseStringStream`, `parseUint8ArrayStream`, `parseResponse`)
- Support for `execution: ["worker"]` to run parsing in a Web Worker (browser) or Worker Thread (Node.js)
- Cross-platform worker support for browsers, Node.js (20+), and Deno
- Automatic fallback: uses Transferable Streams in browsers for zero-copy, collects streams in Node.js
- Concurrent request handling: single worker instance can process multiple CSV parsing requests

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
for await (const record of parseString(csv, { execution: ['worker'] })) {
  console.log(record);
}
```

**Supported Platforms:**

- ✅ Browsers with Web Workers support
- ✅ Node.js 20.x and later (Worker Threads)
- ✅ Deno with Web Workers support

**Performance Considerations:**

- Worker initialization has overhead (~5-20ms depending on environment)
- Best suited for:
  - Large CSV files (>1000 rows)
  - Maintaining UI responsiveness during parsing
  - Processing multiple CSVs concurrently
- For small CSV files (<100 rows), main thread execution is typically faster

**Testing:**

- Comprehensive test coverage for all execution strategies
- Property-based tests verify identical results across execution modes
- Error handling and memory management tests
- Concurrent execution tests
- Performance benchmarks comparing main vs worker execution

**Known Limitations:**

- Worker execution is experimental and subject to change
- WASM execution in worker (`execution: ["worker", "wasm"]`) is not yet fully supported
- Node.js Worker Threads do not support Transferable Streams (uses message passing instead)

**Breaking Changes:**

None. This is a backward-compatible addition. Existing code continues to work without changes.

**Migration Guide:**

No migration required. To use worker execution, simply add the `execution` option:

```typescript
// Before (still works)
parseString(csv)

// After (with worker)
parseString(csv, { execution: ['worker'] })
```

**Future Plans:**

- Stabilize worker execution API based on feedback
- Add support for custom worker URLs
- Implement worker pooling for better performance
- Enable WASM execution in worker threads
