---
"web-csv-toolbox": patch
---

fix: add charset validation to prevent malicious Content-Type header manipulation

This patch addresses a security vulnerability where malicious or invalid charset values in Content-Type headers could cause parsing failures or unexpected behavior.

**Changes:**

- Fixed `parseMime` to handle Content-Type parameters without values (prevents `undefined.trim()` errors)
- Added charset validation similar to existing compression validation pattern
- Created `SUPPORTED_CHARSETS` constants for commonly used character encodings
- Added `allowNonStandardCharsets` option to `BinaryOptions` for opt-in support of non-standard charsets
- Added error handling in `convertBinaryToString` to catch TextDecoder instantiation failures
- Charset values are now validated against a whitelist and normalized to lowercase

**Security Impact:**

- Invalid or malicious charset values are now rejected with clear error messages
- Prevents DoS attacks via malformed Content-Type headers
- Reduces risk of charset-based injection attacks

**Breaking Changes:** None - existing valid charset values continue to work as before.
