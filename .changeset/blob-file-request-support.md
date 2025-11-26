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

- **`parseFile(file, options)`** - Enhanced File parsing with automatic error source tracking
  - Built on top of `parseBlob` with additional functionality
  - **Automatically sets `file.name` as error source** for better error reporting
  - Provides clearer intent when working specifically with File objects
  - Useful for file inputs and drag-and-drop scenarios
  - Includes `.toArray()` and `.toStream()` namespace methods

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
// File objects automatically include filename in error messages
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
- **New `source` field** in `CommonOptions`, `CSVRecordAssemblerOptions`, and `ParseError`
  - Allows custom error source identification (e.g., filename, description)
  - Automatically populated for File objects
  - Improves error messages with contextual information
- **Improved internal type naming** for better clarity
  - `Join` → `JoinCSVFields` - More descriptive CSV field joining utility type
  - `Split` → `SplitCSVFields` - More descriptive CSV field splitting utility type
  - These are internal utility types used for CSV type-level string manipulation
- **Enhanced terminology** in type definitions
  - `TokenLocation.rowNumber` - Logical CSV row number (includes header)
  - Clear distinction between physical line numbers (`line`) and logical row numbers (`rowNumber`)

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
- `getOptionsFromFile()` - Extracts options from File (charset + automatic source naming)
- `getOptionsFromRequest()` - Processes Request headers (Content-Type, Content-Encoding)
- `parseBlobToStream()` - Stream conversion helper
- `parseFileToArray()` - Parse File to array of records
- `parseFileToStream()` - Parse File to ReadableStream
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
  - **NEW:** Node.js Buffer usage (supported via BufferSource compatibility)
  - **NEW:** FormData integration patterns
  - **NEW:** Node.js stream conversion (fs.ReadStream → Web Streams)

- **Updated:**
  - `README.md` - Added usage examples and API listings
  - `choosing-the-right-api.md` - Updated decision tree

**Enhanced Error Reporting:**

The `source` field provides better error context when parsing multiple files:

```typescript
import { parseFile } from 'web-csv-toolbox';

// Automatic source tracking
try {
  for await (const record of parseFile(file)) {
    // ...
  }
} catch (error) {
  console.error(error.message);
  // "Field count (100001) exceeded maximum allowed count of 100000 at row 5 in "data.csv""
  console.error(error.source); // "data.csv"
}

// Manual source specification
parseString(csv, { source: "API-Export-2024" });
// Error: "... at row 5 in "API-Export-2024""
```

**Security Note:** The `source` field should not contain sensitive information (API keys, tokens, URLs with credentials) as it may be exposed in error messages and logs.

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
import { parseBlob, parseFile, parseRequest } from 'web-csv-toolbox';

// Blob support
for await (const record of parseBlob(blob)) { }

// File support with automatic error source
const file = input.files[0];
for await (const record of parseFile(file)) { }
// Errors will include: 'in "data.csv"'

// Server-side Request support
for await (const record of parseRequest(request)) { }

// Custom error source for any parser
import { parseString } from 'web-csv-toolbox';
for await (const record of parseString(csv, { source: 'user-import.csv' })) { }
```
