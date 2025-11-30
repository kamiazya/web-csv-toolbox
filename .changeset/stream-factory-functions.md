---
"web-csv-toolbox": minor
---

Add factory functions for stream-based CSV parsing APIs

**New Features:**
- Add `createStringCSVParserStream()` factory function for Mid-level string stream parsing
- Add `createBinaryCSVParserStream()` factory function for Mid-level binary stream parsing
- Add `createStringCSVLexerTransformer()` factory function for creating StringCSVLexerTransformer instances
- Add `createCSVRecordAssemblerTransformer()` factory function for creating CSVRecordAssemblerTransformer instances
- Add `StringCSVLexerOptions` type for lexer factory function options
- Add `StringCSVLexerTransformerStreamOptions` type for stream behavior options
- Add `CSVRecordAssemblerFactoryOptions` type for assembler factory function options
- Add `StringCSVParserFactoryOptions` type for string parser factory function options
- Add `BinaryCSVParserFactoryOptions` type for binary parser factory function options
- Update model factory functions (`createStringCSVLexer`, `createCSVRecordAssembler`, `createStringCSVParser`, `createBinaryCSVParser`) to accept engine options for future optimization support
- Update documentation with API level classification (High-level, Mid-level, Low-level)

**Breaking Changes:**
- Rename `CSVLexerTransformer` class to `StringCSVLexerTransformer` to clarify input type (string)
- Rename `createCSVLexerTransformer()` to `createStringCSVLexerTransformer()` for consistency
- Rename `CSVLexerTransformerStreamOptions` type to `StringCSVLexerTransformerStreamOptions` for naming consistency
- Remove unused `CSVLexerTransformerOptions` type

**Migration:**
```typescript
// Before
import {
  CSVLexerTransformer,
  createCSVLexerTransformer,
  type CSVLexerTransformerStreamOptions
} from 'web-csv-toolbox';
new CSVLexerTransformer(lexer);
createCSVLexerTransformer({ delimiter: ',' });

// After
import {
  StringCSVLexerTransformer,
  createStringCSVLexerTransformer,
  type StringCSVLexerTransformerStreamOptions
} from 'web-csv-toolbox';
new StringCSVLexerTransformer(lexer);
createStringCSVLexerTransformer({ delimiter: ',' });
```

These factory functions simplify the API by handling internal parser/lexer creation, reducing the impact of future internal changes on user code. This addresses the issue where CSVLexerTransformer constructor signature changed in v0.14.0 (#612).
