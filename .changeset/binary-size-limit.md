---
web-csv-toolbox: patch
---

Add binary size limit protection to prevent memory exhaustion attacks

- Add `maxBinarySize` option (default: 100MB) for ArrayBuffer/Uint8Array inputs
- Throw `RangeError` when binary size exceeds the limit
- Update documentation with security considerations for large file handling
- Add comprehensive tests for binary size validation
