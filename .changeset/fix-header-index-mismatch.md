---
"web-csv-toolbox": patch
---

Fix header index mismatch when filtering empty header fields

Fixed a critical bug in `CSVRecordAssembler` where empty header fields caused incorrect mapping of row values to headers during record assembly.

## The Bug

When CSV headers contained empty fields (e.g., from trailing or leading commas), the record assembler would incorrectly map row values to header fields. This affected both the `#processToken()` method (for records with `RecordDelimiter`) and the `#flush()` method (for incomplete records at the end of streaming).

**Example:**
```typescript
// CSV with empty first header field:
// ,name,age
// skip,Alice,30

// Before (incorrect):
{ name: 'skip', age: 'Alice' }

// After (correct):
{ name: 'Alice', age: '30' }
```

## Root Cause

The implementation filtered out empty headers first, then used the filtered array's indices to access `this.#row` values:

```typescript
// Buggy code
this.#header
  .filter((v) => v)           // Filter creates new array with new indices
  .map((header, index) => [   // 'index' is wrong - it's the filtered index
    header,
    this.#row.at(index)       // Accesses wrong position in original row
  ])
```

## The Fix

Changed to preserve original indices before filtering:

```typescript
// Fixed code
this.#header
  .map((header, index) => [header, index] as const)  // Capture original index
  .filter(([header]) => header)                       // Filter with index preserved
  .map(([header, index]) => [header, this.#row.at(index)])  // Use original index
```

This fix is applied to both:
- `#processToken()` - for records ending with `RecordDelimiter`
- `#flush()` - for incomplete records at end of stream

## Impact

This bug affected any CSV with empty header fields, which can occur from:
- Trailing commas in headers: `name,age,`
- Leading commas in headers: `,name,age`
- Multiple consecutive commas: `name,,age`

All such cases now correctly map row values to their corresponding headers.
