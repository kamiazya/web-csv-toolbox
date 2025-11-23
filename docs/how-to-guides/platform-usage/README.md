---
title: Platform Usage Overview
group: How-to Guides
---

# Platform-Specific Usage Guide

Guide for using web-csv-toolbox across different JavaScript runtime environments.

---

## Guides by Environment

### 🌐 Browser Environments

Common CSV parsing scenarios in web browsers:
- **[File Input Elements](./browser/file-input.md)** - Parse files from `<input type="file">`
- **[Drag and Drop](./browser/drag-and-drop.md)** - Handle dropped CSV files
- **[FormData](./browser/formdata.md)** - Work with form submissions
- **[Fetch API](./browser/fetch.md)** - Load and parse remote CSV files

### 🟢 Node.js Environments

Working with CSV in Node.js applications:
- **[Buffer](./nodejs/buffer.md)** - Parse Node.js Buffer objects
- **[File System Streams](./nodejs/fs-stream.md)** - Read CSV files with fs.ReadStream
- **[HTTP Requests](./nodejs/http.md)** - Fetch and parse CSV over HTTP
- **[stdin/stdout](./nodejs/stdin-stdout.md)** - Process CSV from pipes
- **[Stream Conversion](./nodejs/stream-conversion.md)** - Convert Node.js Streams to Web Streams (Express, Fastify, etc.)

### 🦕 Deno Environments

CSV parsing in Deno runtime:
- **[Deno.readFile](./deno/readfile.md)** - Read and parse CSV files
- **[Deno.open](./deno/open.md)** - Stream large CSV files
- **[fetch API](./deno/fetch.md)** - Fetch remote CSV files

---

## Quick Reference

### Input Type to API Mapping

| Environment | Input Type | API | Guide |
|-------------|-----------|-----|-------|
| **Browser** | `File` | `parseFile()` | [File Input](./browser/file-input.md) |
| | `File` (dropped) | `parseFile()` | [Drag & Drop](./browser/drag-and-drop.md) |
| | `FormData` | `parseFile()` | [FormData](./browser/formdata.md) |
| | `Response` | `parseResponse()` | [Fetch](./browser/fetch.md) |
| **Node.js** | `Buffer` | `parseBinary()` | [Buffer](./nodejs/buffer.md) |
| | `fs.ReadStream` | `parseBinaryStream()` | [FS Stream](./nodejs/fs-stream.md) |
| | `Response` | `parseResponse()` | [HTTP](./nodejs/http.md) |
| | stdin | `parseBinaryStream()` | [stdin/stdout](./nodejs/stdin-stdout.md) |
| | `stream.Readable` | `parseBinaryStream()` | [Stream Conversion](./nodejs/stream-conversion.md) |
| **Deno** | `Uint8Array` | `parseBinary()` | [readFile](./deno/readfile.md) |
| | `ReadableStream` | `parseBinaryStream()` | [open](./deno/open.md) |
| | `Response` | `parseResponse()` | [fetch](./deno/fetch.md) |

> **Note:** `parseFile()` automatically includes the filename in error messages. For environments where the File constructor is unavailable (e.g., Cloudflare Workers), use `parseBlob()` with a manual `source` option: `parseBlob(blob, { source: 'filename.csv' })`.

---

## Best Practices

### Memory Efficiency

- ✅ **Use streaming for large files** - Prefer `parseBinaryStream()` over loading entire files
- ✅ **Process incrementally** - Use `for await...of` to handle records one at a time
- ❌ **Avoid `.toArray()` for large datasets** - Loads entire result into memory

### Error Handling

- ✅ **Always use try-catch** - Wrap parsing operations in error handlers
- ✅ **Validate inputs** - Check file types and sizes before parsing
- ✅ **Provide user feedback** - Display clear error messages
- ✅ **Use source tracking** - Specify `source` option or use `parseFile()` for automatic filename tracking
- ✅ **Check error types** - Handle `ParseError`, `RangeError`, and `DOMException` appropriately

**Example:**
```typescript
import { parseFile, ParseError } from 'web-csv-toolbox';

try {
  for await (const record of parseFile(file)) {
    await processRecord(record);
  }
} catch (error) {
  if (error instanceof ParseError) {
    // CSV format error - includes filename automatically
    console.error(`Parse error in "${error.source}":`, error.message);
  } else if (error instanceof RangeError) {
    // Security limit exceeded
    console.error('File exceeds security limits');
  } else if (error instanceof DOMException && error.name === 'AbortError') {
    // Operation cancelled
    console.log('Parsing cancelled');
  }
}
```

### Performance

- ✅ **Enable compression** - Use gzip for network transfers
- ✅ **Use AbortSignal** - Implement timeout protection for untrusted sources
- ✅ **Batch processing** - Process records in batches for database operations

---

## Example Projects

For complete, working examples on different platforms:

- **Node.js:**
  - [node-slim](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/node-slim) - Slim entry (external WASM)
  - [node-main](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/node-main) - Main entry (embedded WASM)
  - [node-worker-main](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/node-worker-main) - Worker pool example
  - [hono-secure-api](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/hono-secure-api) - Production API example
- **Browser (Vite):**
  - [vite-bundle-slim](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/vite-bundle-slim) / [vite-bundle-main](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/vite-bundle-main)
  - [vite-bundle-worker-slim](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/vite-bundle-worker-slim) / [vite-bundle-worker-main](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/vite-bundle-worker-main)
- **Browser (Webpack):**
  - [webpack-bundle-worker-slim](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/webpack-bundle-worker-slim) / [webpack-bundle-worker-main](https://github.com/kamiazya/web-csv-toolbox/tree/main/examples/webpack-bundle-worker-main)

## Related Documentation

- **[Choosing the Right API](../choosing-the-right-api.md)** - API selection guide
- **[API Reference](https://kamiazya.github.io/web-csv-toolbox/)** - Complete API documentation
- **[Security Guide](../secure-csv-processing.md)** - Security best practices
- **[Use with Bundlers](../using-with-bundlers.md)** - Bundler integration guide
