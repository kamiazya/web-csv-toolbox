---
web-csv-toolbox: minor
---

Add support for Blob, File, and Request objects

This release adds native support for parsing CSV data from Web Standard `Blob`, `File`, and `Request` objects, making the library more versatile across different environments.

**New Functions:**

- **`parseBlob(blob, options)`** - Parse CSV from Blob or File objects
  - Automatic charset detection from `blob.type` property
  - Supports compression via `decompression` option
  - Returns `AsyncIterableIterator<CSVRecord>`
  - Includes `.toArray()` and `.toStream()` namespace methods

- **`parseFile(file, options)`** - Semantic alias for `parseBlob()`
  - Identical functionality to `parseBlob`
  - Provides clearer intent when working specifically with File objects
  - Useful for file inputs and drag-and-drop scenarios

- **`parseRequest(request, options)`** - Server-side Request parsing
  - Automatic `Content-Type` validation and charset extraction
  - Automatic `Content-Encoding` detection and decompression
  - Designed for Cloudflare Workers, Service Workers, and edge platforms
  - Includes `.toArray()` and `.toStream()` namespace methods

**High-level API Integration:**

The `parse()` function now automatically detects and handles these new input types:

```typescript
import { parse } from 'web-csv-toolbox';

// Blob/File (browser file uploads)
const file = input.files[0];
for await (const record of parse(file)) {
  console.log(record);
}

// Request (server-side)
export default {
  async fetch(request: Request) {
    for await (const record of parse(request)) {
      console.log(record);
    }
  }
};
```

**Type System Updates:**

- Updated `CSVBinary` type to include `Blob` and `Request`
- Added proper type overloads to `parse()` function
- Full TypeScript support with generic header types

**Compression Support:**

All binary input types support compressed data:

- **Blob/File**: Manual specification via `decompression` option
  ```typescript
  parseBlob(file, { decompression: 'gzip' })
  ```

- **Request**: Automatic detection from `Content-Encoding` header
  ```typescript
  // No configuration needed - automatic
  parseRequest(request)
  ```

- Supported formats: `gzip`, `deflate`, `deflate-raw` (environment-dependent)

**Helper Functions:**

- `getOptionsFromBlob()` - Extracts charset from Blob MIME type
- `getOptionsFromRequest()` - Processes Request headers (Content-Type, Content-Encoding)
- `parseBlobToStream()` - Stream conversion helper
- `parseRequestToStream()` - Stream conversion helper

**Documentation:**

Comprehensive documentation following Diátaxis framework:

- **API Reference:**
  - `parseBlob.md` - Complete API reference with examples
  - `parseFile.md` - Alias documentation
  - `parseRequest.md` - Server-side API reference with examples
  - Updated `parse.md` to include new input types

- **How-to Guides:**
  - **NEW:** `platform-usage/` - Environment-specific usage patterns organized by platform
    - Each topic has its own dedicated guide for easy navigation
    - **Browser:** File input, drag-and-drop, FormData, Fetch API
    - **Node.js:** Buffer, fs.ReadStream, HTTP requests, stdin/stdout
    - **Deno:** Deno.readFile, Deno.open, fetch API
  - Organized in `{environment}/{topic}.md` structure for maintainability

- **Examples:**
  - File input elements with HTML samples
  - Drag-and-drop file uploads
  - Compressed file handling (.csv.gz)
  - Validation and error handling patterns
  - **NEW:** Node.js Buffer usage (already supported via Uint8Array)
  - **NEW:** FormData integration patterns
  - **NEW:** Node.js stream conversion (fs.ReadStream → Web Streams)

- **Updated:**
  - `README.md` - Added usage examples and API listings
  - `choosing-the-right-api.md` - Updated decision tree

**Use Cases:**

✅ **Browser File Uploads:**
- File input elements (`<input type="file">`)
- Drag-and-drop interfaces
- Compressed file support (.csv.gz)

✅ **Server-Side Processing:**
- Node.js servers
- Deno applications
- Service Workers

✅ **Automatic Header Processing:**
- Content-Type validation
- Charset detection
- Content-Encoding decompression

**Platform Support:**

All new APIs work across:
- Modern browsers (Chrome, Firefox, Edge, Safari)
- Node.js 18+ (via undici Request/Blob)
- Deno
- Service Workers

**Breaking Changes:**

None - this is a purely additive feature. All existing APIs remain unchanged.

**Migration:**

No migration needed. New functions are available immediately:

```typescript
// Before (still works)
import { parse } from 'web-csv-toolbox';
const response = await fetch('data.csv');
for await (const record of parse(response)) { }

// After (new capabilities)
import { parseBlob, parseRequest } from 'web-csv-toolbox';

// Blob/File support
const file = input.files[0];
for await (const record of parseBlob(file)) { }

// Server-side Request support
for await (const record of parseRequest(request)) { }
```
