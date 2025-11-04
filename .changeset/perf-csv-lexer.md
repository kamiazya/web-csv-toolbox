---
"web-csv-toolbox": patch
---

Optimize CSVLexer performance with buffer pointer pattern

Replaced destructive string operations with buffer offset tracking to reduce memory allocations and improve parsing performance.

**Key Optimizations:**
- Added `#bufferOffset` to track position instead of repeatedly slicing strings
- Implemented `#cleanupBuffer()` to periodically clean up processed portions (10KB threshold)
- Added helper methods `#startsWithDelimiter()` and `#startsWithQuotation()` for efficient prefix checking
- Replaced string concatenation with array-based construction using `parts.push()` and `parts.join("")` for quoted fields
- Optimized character-by-character comparisons to avoid substring allocations

**Performance Impact:**
- CSVLexer-only benchmark: ~14% improvement (506 → 577 ops/sec)
- Maintains full compatibility with existing tests (460 tests passed)
- Reduces memory pressure during parsing large CSV files
