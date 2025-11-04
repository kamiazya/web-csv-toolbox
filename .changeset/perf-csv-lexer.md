---
"web-csv-toolbox": patch
---

Optimize CSVLexer performance with buffer pointer pattern and tuned cleanup threshold

Replaced destructive string operations with buffer offset tracking to reduce memory allocations and improve parsing performance.

**Key Optimizations:**
- Added `#bufferOffset` to track position instead of repeatedly slicing strings
- Implemented `#cleanupBuffer()` to periodically clean up processed portions
- Added configurable `bufferCleanupThreshold` option (default: 4KB)
- Added helper methods `#startsWithDelimiter()` and `#startsWithQuotation()` for efficient prefix checking
- Replaced string concatenation with array-based construction using `parts.push()` and `parts.join("")` for quoted fields
- Optimized character-by-character comparisons to avoid substring allocations

**Buffer Cleanup Threshold Optimization:**
Through comprehensive benchmarking, determined that 4KB provides optimal performance:
- 4KB: 640 ops/sec (optimal)
- 10KB: 577 ops/sec (-10.9%)
- 64KB: 631 ops/sec (-1.4%)

The 4KB threshold offers the best balance between memory usage and CPU overhead.

**New Configuration Option:**
```typescript
const lexer = new CSVLexer({
  bufferCleanupThreshold: 4096 // default: 4KB, configurable for specific use cases
});
```

**Performance Impact:**
- Overall improvement: ~26% (506 → 640 ops/sec)
- Buffer pointer pattern: ~14% improvement
- Optimized threshold: additional ~11% improvement
- Maintains full compatibility with existing tests (462 tests passed)
- Reduces memory pressure during parsing large CSV files
