---
"web-csv-toolbox": minor
---

## Breaking Change: Rename `pad` to `sparse` and add `fill` strategy

### Changes

This release introduces breaking changes to the `columnCountStrategy` option:

1. **Renamed `pad` to `sparse`**: The old `pad` strategy has been renamed to `sparse` to better reflect its behavior of filling missing fields with `undefined`.

2. **Added new `fill` strategy**: A new strategy that fills missing fields with empty strings (`""`), which is now the default for both array and object formats.

3. **Object format restrictions**:
   - The `sparse` strategy is now **not allowed** for object format because `undefined` values are not type-safe for objects
   - Object format will use `fill` (empty string) by default
   - Using `sparse` with object format will throw a runtime error

4. **Default strategy changed**: The default `columnCountStrategy` is now `fill` instead of `keep`/`pad`

### Migration Guide

**Before (v0.x):**
```typescript
const assembler = createCSVRecordAssembler({
  header: ["a", "b", "c"] as const,
  outputFormat: "array",
  columnCountStrategy: "pad", // fills with undefined
});
```

**After (v1.x):**
```typescript
// For undefined behavior (array format only):
const assembler = createCSVRecordAssembler({
  header: ["a", "b", "c"] as const,
  outputFormat: "array",
  columnCountStrategy: "sparse", // fills with undefined
});

// For empty string behavior (both formats):
const assembler = createCSVRecordAssembler({
  header: ["a", "b", "c"] as const,
  outputFormat: "object", // or "array"
  columnCountStrategy: "fill", // fills with "" (default)
});
```

### Type Safety

The `sparse` strategy now correctly types its output as `string | undefined`:
```typescript
type ArrayRecord = CSVArrayRecord<["a", "b"], "sparse">;
// → { readonly 0: string | undefined; readonly 1: string | undefined }

type ArrayRecordFill = CSVArrayRecord<["a", "b"], "fill">;
// → { readonly 0: string; readonly 1: string }
```
