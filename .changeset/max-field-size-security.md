---
"web-csv-toolbox": minor
---

Add `maxFieldSize` option for protection against memory exhaustion attacks

This changeset introduces a new `maxFieldSize` option to limit the maximum size of individual CSV fields, providing protection against denial-of-service (DoS) attacks from maliciously crafted CSV files.

**Security Enhancement:**

- **Field Size Limit**: Added `maxFieldSize` option to `CommonOptions`
  - Limits individual field size to prevent memory exhaustion
  - Default: 10MB (10,485,760 bytes)
  - Maximum allowed value: 1GB (1,073,741,823 bytes)
  - Throws `RangeError` when a field exceeds the configured limit

**Why 10MB Default:**

- Covers 99.9% of legitimate CSV use cases
- Provides meaningful DoS protection out of the box
- Well under V8's string limit (~512MB), ensuring consistent behavior across all JavaScript runtimes
- Users can increase up to 1GB if needed, or decrease for stricter security

**Runtime-Specific Considerations:**

Different JavaScript engines have different maximum string length limits:
- V8 (Chrome, Node.js, Deno): ~512MB
- Firefox: ~1GB
- Safari: ~2GB

The 10MB default ensures safe operation across all runtimes. See [MDN String.length](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/length) for details.

**Usage:**

```typescript
import { parseString } from "web-csv-toolbox";

// Use default 10MB limit (recommended for most use cases)
const records = await parseString(csvData).toArray();

// Increase limit for large text fields (up to 1GB max)
const records = await parseString(csvData, {
  maxFieldSize: 100 * 1024 * 1024, // 100MB
}).toArray();

// Stricter limit for untrusted input
const records = await parseString(csvData, {
  maxFieldSize: 1024 * 1024, // 1MB
}).toArray();
```

**Validation:**

- `maxFieldSize` must be a positive integer
- `maxFieldSize` must not exceed 1GB (1,073,741,823 bytes)
- `Number.POSITIVE_INFINITY`, `NaN`, negative, or zero values are rejected with `RangeError`

**Error Message Example:**

```
RangeError: maxFieldSize must be a positive integer not exceeding 1073741823 bytes (1GB).
This limit is enforced due to internal offset representation constraints.
```

**Breaking Changes:** None - this is a new option with a secure default.

**Migration:** No action required. Existing code continues to work. If you were processing fields larger than 10MB, you may need to explicitly set `maxFieldSize` to a higher value.
