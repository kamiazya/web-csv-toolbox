---
"web-csv-toolbox": minor
---

Refactoring

- **New Features**
  - Introduced `Lexer`, `RecordAssembler`, and `LexerTransformer` classes to enhance CSV parsing capabilities.
  - Added new methods (`toArraySync`, `toIterableIterator`, `toStream`) across various modules for flexible data processing.
  - Expanded `parseArrayBuffer`, `parseResponse`, `parseString`, and `parseUint8Array` with additional output formats.

- **Bug Fixes**
  - Corrected typos in several modules, changing `quate` to `quote` and `demiliter` to `delimiter`.
  - Allowed `undefined` values in `CSVRecord` type to improve data handling.

- **Refactor**
  - Simplified constructors and updated logic in `LexerTransformer` and `RecordAssemblerTransformer`.
  - Enhanced type safety with refactored token types in common types module.

- **Tests**
  - Added and refactored test cases for `Lexer`, `RecordAssembler`, `LexerTransformer`, and `escapeField` to ensure reliability.

- **Documentation**
  - Updated descriptions and examples for new methods in various modules to assist users in understanding their usage.
