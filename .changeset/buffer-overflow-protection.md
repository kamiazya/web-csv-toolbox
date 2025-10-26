---
web-csv-toolbox: minor
---

Add comprehensive memory protection to prevent memory exhaustion attacks

This release introduces new security features to prevent unbounded memory growth during CSV parsing. The parser now enforces configurable limits on both buffer size and field count to protect against denial-of-service attacks via malformed or malicious CSV data.

**New Features:**
- Added `maxBufferSize` option to `CommonOptions` (default: 10MB)
- Added `maxFieldCount` option to `RecordAssemblerOptions` (default: 100,000 fields)
- Throws `RangeError` when buffer exceeds size limit
- Throws `RangeError` when field count exceeds limit
- Comprehensive memory safety protection against DoS attacks

**Breaking Changes:**
None. This is a backward-compatible enhancement with sensible defaults.

**Security:**
This change addresses three potential security vulnerabilities:

1. **Unbounded buffer growth via streaming input**: Attackers could exhaust system memory by streaming large amounts of malformed CSV data that cannot be tokenized. The `maxBufferSize` limit prevents this by throwing `RangeError` when the internal buffer exceeds 10MB.

2. **Quoted field parsing memory exhaustion**: Attackers could exploit the quoted field parsing logic by sending strategically crafted CSV with unclosed quotes or excessive escaped quotes, causing the parser to accumulate unbounded data in the buffer. The `maxBufferSize` limit protects against this attack vector.

3. **Excessive column count attacks**: Attackers could send CSV files with an enormous number of columns to exhaust memory during header parsing and record assembly. The `maxFieldCount` limit (default: 100,000 fields per record) prevents this by throwing `RangeError` when exceeded.

Users processing untrusted CSV input are encouraged to use the default limits or configure appropriate `maxBufferSize` and `maxFieldCount` values for their use case.
