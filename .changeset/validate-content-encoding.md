---
web-csv-toolbox: patch
---

Add Content-Encoding header validation and security improvements

- Add validation for Content-Encoding header values in `getOptionsFromResponse()`
- Normalize Content-Encoding header: convert to lowercase, trim whitespace (per RFC 7231)
- Ignore empty or whitespace-only Content-Encoding headers
- Reject multiple comma-separated compression formats (only single format supported)
- Only allow supported compression formats: gzip, deflate, deflate-raw
- Throw clear error messages for unsupported or multiple compression formats
- Add comprehensive tests for Content-Encoding validation (18 tests)
- Add security documentation with TransformStream size limit example for protecting against compression bomb attacks
