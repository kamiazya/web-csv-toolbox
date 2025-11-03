---
"web-csv-toolbox": minor
---

**BREAKING CHANGE**: Refactor low-level API to align with Web Standards (TextDecoder pattern)

This release introduces breaking changes to make the API more consistent with Web Standard APIs like `TextDecoder`.

## Class Renames

All core classes have been renamed with `CSV` prefix for clarity:

- `Lexer` → `CSVLexer`
- `RecordAssembler` → `CSVRecordAssembler`
- `LexerTransformer` → `CSVLexerTransformer`
- `RecordAssemblerTransformer` → `CSVRecordAssemblerTransformer`

## API Changes

The streaming API now follows the `TextDecoder` pattern using `options.stream` instead of positional boolean parameters:

### CSVLexer

```ts
// Before
lexer.lex(chunk, true);  // buffering mode
lexer.flush();           // flush remaining data

// After
lexer.lex(chunk, { stream: true });  // streaming mode
lexer.lex();                         // flush remaining data
```

### CSVRecordAssembler

```ts
// Before
assembler.assemble(tokens, false);  // don't flush
assembler.flush();                  // flush remaining data

// After
assembler.assemble(tokens, { stream: true });  // streaming mode
assembler.assemble();                          // flush remaining data
```

## Removed Methods

- `CSVLexer.flush()` - Use `lex()` without arguments instead
- `CSVRecordAssembler.flush()` - Use `assemble()` without arguments instead

## Migration Guide

1. Update class names: Add `CSV` prefix to `Lexer`, `RecordAssembler`, `LexerTransformer`, and `RecordAssemblerTransformer`
2. Replace `lex(chunk, buffering)` with `lex(chunk, { stream: !buffering })`
3. Replace `assemble(tokens, flush)` with `assemble(tokens, { stream: !flush })`
4. Replace `flush()` calls with parameter-less `lex()` or `assemble()` calls
