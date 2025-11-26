---
"web-csv-toolbox": minor
---

refactor!: rename core classes and simplify type system

This release contains breaking changes for users of low-level APIs. Most users are not affected.

## Breaking Changes

### 1. Class Naming

Low-level CSV processing classes have been renamed:

```diff
- import { CSVLexer } from 'web-csv-toolbox';
+ import { FlexibleStringCSVLexer } from 'web-csv-toolbox';

- const lexer = new CSVLexer(options);
+ const lexer = new FlexibleStringCSVLexer(options);
```

For CSV record assembly, use the factory function or specialized classes:

```diff
- import { CSVRecordAssembler } from 'web-csv-toolbox';
+ import { createCSVRecordAssembler, FlexibleCSVObjectRecordAssembler, FlexibleCSVArrayRecordAssembler } from 'web-csv-toolbox';

- const assembler = new CSVRecordAssembler(options);
+ // Option 1: Use factory function (recommended)
+ const assembler = createCSVRecordAssembler({ outputFormat: 'object', ...options });
+
+ // Option 2: Use specialized class directly
+ const assembler = new FlexibleCSVObjectRecordAssembler(options);
```

### 2. Type Renaming

The `CSV` type has been renamed to `CSVData`:

```diff
- import type { CSV } from 'web-csv-toolbox';
+ import type { CSVData } from 'web-csv-toolbox';

- function processCSV(data: CSV) {
+ function processCSV(data: CSVData) {
    // ...
  }
```

## Bug Fixes

- Fixed stream reader locks not being released when AbortSignal was triggered
- Fixed Node.js WASM module loading
- Improved error handling

## Migration Guide

**For most users**: No changes required if you only use high-level functions like `parse()`, `parseString()`, `parseBlob()`, etc.

**For advanced users** using low-level APIs:
1. Rename `CSV` type to `CSVData`
2. Rename `CSVLexer` to `FlexibleStringCSVLexer`
3. Replace `CSVRecordAssembler` with `createCSVRecordAssembler()` factory function or specialized classes (`FlexibleCSVObjectRecordAssembler` / `FlexibleCSVArrayRecordAssembler`)
