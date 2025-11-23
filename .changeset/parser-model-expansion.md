---
"web-csv-toolbox": minor
---

feat!: add Parser models and streams with improved architecture

## Summary

This release introduces a new Parser layer that composes Lexer and Assembler components, providing a cleaner architecture and improved streaming support. The implementation follows the design patterns established by the recently developed CSVObjectRecordAssembler and CSVArrayRecordAssembler.

## New Features

### Parser Models

#### FlexibleStringCSVParser
- Composes `FlexibleStringCSVLexer` and CSV Record Assembler
- Stateful parser for string CSV data
- Supports both object and array output formats
- Streaming mode support via `parse(chunk, { stream: true })`
- Full options support (delimiter, quotation, columnCountStrategy, etc.)

#### FlexibleBinaryCSVParser
- Composes `TextDecoder` with `FlexibleStringCSVParser`
- Accepts any BufferSource (Uint8Array, ArrayBuffer, or other TypedArray views)
- Uses `TextDecoder` with `stream: true` option for proper streaming
- Supports multiple character encodings (utf-8, shift_jis, etc.)
- BOM handling via `ignoreBOM` option
- Fatal error mode via `fatal` option

#### Factory Functions
- `createStringCSVParser()` - Creates FlexibleStringCSVParser instances
- `createBinaryCSVParser()` - Creates FlexibleBinaryCSVParser instances

### Stream Classes

#### StringCSVParserStream
- `TransformStream<string, CSVRecord>` for streaming string parsing
- Wraps Parser instances (not constructing internally)
- Configurable backpressure handling
- Custom queuing strategies support
- Follows existing CSVLexerTransformer pattern

#### BinaryCSVParserStream
- `TransformStream<BufferSource, CSVRecord>` for streaming binary parsing
- Accepts any BufferSource (Uint8Array, ArrayBuffer, or other TypedArray views)
- Handles UTF-8 multi-byte characters across chunk boundaries
- Integration-ready for fetch API and file streaming
- Backpressure management with configurable check intervals

## Breaking Changes

### Object Format Behavior (Reverted)
While initially explored, the final implementation **maintains the existing behavior**:
- **Empty fields** (`,value,`): Filled with `""`
- **Missing fields** (short rows): Remain as `undefined`

This preserves backward compatibility and allows users to distinguish between explicitly empty fields and missing fields.

### Array Format Behavior (No Change)
- **Empty fields**: Filled with `""`
- **Missing fields** with `columnCountStrategy: 'pad'`: Filled with `undefined`

## Public API Exports (common.ts)
Added exports for:
- `FlexibleStringCSVParser`
- `FlexibleBinaryCSVParser`
- `createStringCSVParser`
- `createBinaryCSVParser`
- `StringCSVParserStream`
- `BinaryCSVParserStream`

## Architecture Improvements

### Composition Over Implementation
- Parsers compose Lexer + Assembler instead of reimplementing
- Reduces code duplication across the codebase
- Easier to maintain and extend

### Streaming Support
- `TextDecoder` with `stream: true` for proper multi-byte character handling
- Backpressure handling in Stream classes
- Configurable check intervals for performance tuning

### Type Safety
- Maintains full TypeScript strict mode compliance
- Generic type parameters for header types
- Proper CSVRecord type inference based on outputFormat

## Migration Guide

### For Users of Existing APIs
No changes required. All existing functions (`parseString`, `parseBinary`, etc.) continue to work as before.

### For Direct Lexer/Assembler Users
Consider migrating to Parser classes for simplified usage:

```typescript
// Before (manual composition)
const lexer = new FlexibleStringCSVLexer(options);
const assembler = createCSVRecordAssembler(options);
const tokens = lexer.lex(csv);
const records = Array.from(assembler.assemble(tokens));

// After (using Parser)
const parser = new FlexibleStringCSVParser(options);
const records = parser.parse(csv);
```

### For Stream Users
New stream classes provide cleaner API:

```typescript
// String streaming
const parser = new FlexibleStringCSVParser({ header: ['name', 'age'] });
const stream = new StringCSVParserStream(parser);

await fetch('data.csv')
  .then(res => res.body)
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(stream)
  .pipeTo(yourProcessor);

// Binary streaming
const parser = new FlexibleBinaryCSVParser({ header: ['name', 'age'] });
const stream = new BinaryCSVParserStream(parser);

await fetch('data.csv')
  .then(res => res.body)
  .pipeThrough(stream)
  .pipeTo(yourProcessor);
```

## Performance Considerations

- Backpressure check interval defaults to 100 records
- Writable side: 64KB highWaterMark (byte/character counting)
- Readable side: 256 records highWaterMark
- Configurable via queuing strategies

## Documentation

All new classes include comprehensive JSDoc documentation with:
- Usage examples
- Parameter descriptions
- Return type documentation
- Remarks on streaming behavior
- Performance characteristics
