---
web-csv-toolbox: patch
---

Add Content-Encoding header validation and security improvements

- Add validation for Content-Encoding header values in `getOptionsFromResponse()`
- Only allow supported compression formats: gzip, deflate, deflate-raw
- Throw clear error messages for unsupported compression formats
- Add comprehensive tests for Content-Encoding validation
- Add security documentation with TransformStream size limit example for protecting against compression bomb attacks
