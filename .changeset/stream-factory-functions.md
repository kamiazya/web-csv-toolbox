---
"web-csv-toolbox": minor
---

Add factory functions for stream-based CSV parsing APIs

- Add `createCSVLexerTransformer()` factory function for creating CSVLexerTransformer instances
- Add `createCSVRecordAssemblerTransformer()` factory function for creating CSVRecordAssemblerTransformer instances
- Add `createStringCSVParserStream()` factory function for high-level string stream parsing
- Add `createBinaryCSVParserStream()` factory function for high-level binary stream parsing
- Update JSDoc documentation to recommend factory functions over direct class instantiation
- Update custom-csv-parser.md guide with factory function examples

These factory functions simplify the API by handling internal parser/lexer creation, reducing the impact of future internal changes on user code. This addresses the issue where CSVLexerTransformer constructor signature changed in v0.14.0 (#612).
