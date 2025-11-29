---
"web-csv-toolbox": minor
---

Add factory functions for stream-based CSV parsing APIs

**New Features:**
- Add `createStringCSVParserStream()` factory function for Mid-level string stream parsing
- Add `createBinaryCSVParserStream()` factory function for Mid-level binary stream parsing
- Add `createStringCSVLexerTransformer()` factory function for creating StringCSVLexerTransformer instances
- Add `createCSVRecordAssemblerTransformer()` factory function for creating CSVRecordAssemblerTransformer instances
- Add `StringCSVLexerOptions` type for factory function options
- Update documentation with API level classification (High-level, Mid-level, Low-level)

**Breaking Changes:**
- Rename `CSVLexerTransformer` class to `StringCSVLexerTransformer` to clarify input type (string)
- Rename `createCSVLexerTransformer()` to `createStringCSVLexerTransformer()` for consistency

**Migration:**
```typescript
// Before
import { CSVLexerTransformer, createCSVLexerTransformer } from 'web-csv-toolbox';
new CSVLexerTransformer(lexer);
createCSVLexerTransformer({ delimiter: ',' });

// After
import { StringCSVLexerTransformer, createStringCSVLexerTransformer } from 'web-csv-toolbox';
new StringCSVLexerTransformer(lexer);
createStringCSVLexerTransformer({ delimiter: ',' });
```

These factory functions simplify the API by handling internal parser/lexer creation, reducing the impact of future internal changes on user code. This addresses the issue where CSVLexerTransformer constructor signature changed in v0.14.0 (#612).
