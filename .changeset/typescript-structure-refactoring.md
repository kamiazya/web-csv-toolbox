---
"web-csv-toolbox": minor
---

refactor!: reorganize TypeScript project structure and rename core classes

This release includes a comprehensive TypeScript project structure refactoring that improves code organization and maintainability. This release contains breaking changes that require code updates when upgrading.

## Breaking Changes

### 1. Core Class Naming Changes

The following classes have been renamed to add a "Default" prefix, establishing an interface-implementation pattern:

- `CSVLexer` → `DefaultCSVLexer` (class)
- `CSVRecordAssembler` → `DefaultCSVRecordAssembler` (class)

**Migration:**
```diff
- import { CSVLexer } from 'web-csv-toolbox';
+ import { DefaultCSVLexer } from 'web-csv-toolbox';

- const lexer = new CSVLexer(options);
+ const lexer = new DefaultCSVLexer(options);
```

```diff
- import { CSVRecordAssembler } from 'web-csv-toolbox';
+ import { DefaultCSVRecordAssembler } from 'web-csv-toolbox';

- const assembler = new CSVRecordAssembler(options);
+ const assembler = new DefaultCSVRecordAssembler(options);
```

### 2. New Interface Pattern

New interfaces have been introduced to define the contracts for lexer and assembler implementations:

- `CSVLexer` interface
- `CSVRecordAssembler<Header>` interface
- `CSVLexerLexOptions` interface
- `CSVRecordAssemblerAssembleOptions` interface

The `DefaultCSVLexer` and `DefaultCSVRecordAssembler` classes implement these interfaces, allowing for future alternative implementations while maintaining a consistent API.

**Usage:**
```typescript
import type { CSVLexer, CSVLexerLexOptions } from 'web-csv-toolbox';
import { DefaultCSVLexer } from 'web-csv-toolbox';

// Use interface types for flexibility
const lexer: CSVLexer = new DefaultCSVLexer(options);
```

### 3. Core Type Simplification

The CSV type system has been dramatically simplified by removing unnecessary type parameters:

**Type Renaming:**
- `CSV` → `CSVData`

**Type Simplification:**
```typescript
// Before
export type CSVString<Header, Delimiter, Quotation> = ...complex type...
export type CSVData<Header, Delimiter, Quotation> = ...

// After
export type CSVString = string | ReadableStream<string>
export type CSVBinary = Uint8Array | ArrayBuffer | ReadableStream<Uint8Array> | Response | Request | Blob
export type CSVData = CSVString | CSVBinary
```

**Benefits:**
- Much simpler type definitions
- Easier to understand and use
- Type inference still works perfectly through the `parse` function's overloads

**Migration:**

For most users, no changes are required as `CSVData` is used internally. However, if you were explicitly using the `CSV` type in your code:

```diff
- import type { CSV } from 'web-csv-toolbox';
+ import type { CSVData } from 'web-csv-toolbox';

- function processCSV(data: CSV) {
+ function processCSV(data: CSVData) {
    // ...
  }
```

### 4. Import Path Changes

**Migration:** If you were importing from internal paths (not recommended), always import from the main package entry point instead:
```typescript
import { /* ... */ } from 'web-csv-toolbox';
```

## Non-Breaking Changes

### Bug Fixes

- **Stream Reader Lock Cleanup**: Fixed an issue where stream reader locks were not properly released when AbortSignal was triggered during parsing
- **WASM Loading**: Fixed Node.js WASM module loading
- **Error Handling**: Improved DOMException handling

### Improvements

- Better code organization with clearer separation of concerns
- Eliminated circular dependencies
- Improved TypeScript strict mode compliance
- Enhanced test coverage for edge cases

## Migration Guide Summary

For most users who only use the high-level parsing functions (`parse`, `parseString`, `parseBlob`, etc.), **no changes are required**.

If you are using low-level APIs or explicitly importing types:

1. **Update type names**: Replace `CSV` type with `CSVData`
2. **Update class names**: Add `Default` prefix when instantiating lexer or assembler classes
3. **Consider using interface types**: Use interface types for more flexible, decoupled code
4. **Use main entry point**: Import from the package root instead of internal paths
