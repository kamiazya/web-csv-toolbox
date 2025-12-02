---
"web-csv-toolbox": minor
---

Add TypeScript 5.0 const type parameters to eliminate `as const` requirements

**New Features:**
- Add `CSVOutputFormat` type alias for `"object" | "array"` union type
- Implement const type parameters in factory functions for automatic literal type inference
- Add function overloads to factory functions for precise return type narrowing
- Users no longer need to write `as const` when specifying headers, delimiters, or other options

**Improvements:**
- Replace `import("@/...").XXX` patterns with standard import statements at file top
- Update factory function type signatures to use const type parameters:
  - `createStringCSVParser` - automatically infers header, delimiter, quotation, and output format types
  - `createBinaryCSVParser` - automatically infers header, delimiter, quotation, charset, and output format types
  - `createCSVRecordAssembler` - automatically infers header and output format types
- Update type definitions to support const type parameters:
  - `CSVRecordAssemblerCommonOptions` - add `OutputFormat` and `Strategy` type parameters
  - `CSVProcessingOptions` - add `OutputFormat` type parameter
  - `BinaryOptions` - add `Charset` type parameter
- Update JSDoc examples in factory functions to remove unnecessary `as const` annotations
- Update README.md examples to demonstrate simplified usage without `as const`

**Before:**
```typescript
const parser = createStringCSVParser({
  header: ['name', 'age'] as const,  // Required as const
  outputFormat: 'object'
});
```

**After:**
```typescript
const parser = createStringCSVParser({
  header: ['name', 'age'],  // Automatically infers literal types
  outputFormat: 'object'     // Return type properly narrowed
});
```

**Technical Details:**
- Leverages TypeScript 5.0's const type parameters feature
- Uses function overloads to narrow return types based on `outputFormat` value:
  - `outputFormat: "array"` → returns array parser
  - `outputFormat: "object"` → returns object parser
  - omitted → defaults to object parser
  - dynamic value → returns union type
- All changes are 100% backward compatible
- Existing code using `as const` continues to work unchanged
