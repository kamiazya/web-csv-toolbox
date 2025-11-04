---
"web-csv-toolbox": patch
---

Optimize CSVRecordAssembler with single-loop array processing

**Performance Optimization:**
- Replaced chained array methods (`.map().filter().map()`) with single for-loop
- Reduces array iterations from 3 passes to 1 pass
- Applied to 3 critical code paths:
  - Processing non-empty records (RecordDelimiter handler)
  - Processing empty lines (skipEmptyLines=false case)
  - Flushing remaining buffered data

**Implementation Details:**
- Changed from functional chaining to imperative loop for better performance
- Direct array construction eliminates intermediate array allocations
- Maintains identical output behavior - all 460 tests pass

**Impact:**
- Most beneficial for CSVs with many columns
- Reduces CPU cycles during record assembly phase
- Complements the CSVLexer buffer pointer optimization
