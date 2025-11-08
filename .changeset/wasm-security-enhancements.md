---
"web-csv-toolbox": patch
---

feat(wasm): add input size validation and source option for error reporting

This patch enhances the WASM CSV parser with security improvements and better error reporting capabilities.

**Security Enhancements:**

- **Input Size Validation**: Added validation to prevent memory exhaustion attacks
  - Validates CSV input size against `maxBufferSize` parameter before processing
  - Returns clear error message when size limit is exceeded
  - Default limit: 10MB (configurable via TypeScript options)
  - Addresses potential DoS vulnerability from maliciously large CSV inputs

**Error Reporting Improvements:**

- **Source Option**: Added optional `source` parameter for better error context
  - Allows specifying a source identifier (e.g., filename) in error messages
  - Error format: `"Error message in \"filename\""`
  - Significantly improves debugging when processing multiple CSV files
  - Aligns with TypeScript implementation's `CommonOptions.source`

**Performance Optimizations:**

- Optimized `format_error()` to take ownership of String
  - Avoids unnecessary allocation when source is None
  - Improves error path performance by eliminating `to_string()` call
  - Zero-cost abstraction in the common case (no source identifier)

**Code Quality Improvements:**

- Used `bool::then_some()` for more idiomatic Option handling
- Fixed Clippy `needless_borrow` warnings in tests
- Applied cargo fmt formatting for consistency

**Implementation Details:**

Rust (`web-csv-toolbox-wasm/src/lib.rs`):
- Added `format_error()` helper function for consistent error formatting
- Updated `parse_csv_to_json()` to accept `max_buffer_size` and `source` parameters
- Implemented input size validation at parse entry point
- Applied source context to all error types (headers, records, JSON serialization)

TypeScript (`src/parseStringToArraySyncWASM.ts`):
- Updated to pass `maxBufferSize` from options to WASM function
- Updated to pass `source` from options to WASM function

**Breaking Changes:** None - this is a backward-compatible enhancement with sensible defaults.

**Migration:** No action required. Existing code continues to work without modification.
