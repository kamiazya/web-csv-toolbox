---
title: CSV Parsing Architecture
group: Explanation
---

# CSV Parsing Architecture

This document explains the internal architecture of web-csv-toolbox's CSV parsing system and how the low-level APIs work together.

## Overview

web-csv-toolbox uses a **two-stage pipeline architecture** for CSV parsing:

```
CSV String → CSVLexer → Tokens → CSVRecordAssembler → Records
```

This separation of concerns provides:
- **Modularity**: Each stage has a single responsibility
- **Testability**: Each component can be tested independently
- **Flexibility**: Users can customize or replace individual stages
- **Performance**: Streaming architecture enables memory-efficient processing

## The Two-Stage Pipeline

### Stage 1: Lexical Analysis (CSVLexer)

The **CSVLexer** converts raw CSV text into a stream of **tokens**.

**Input:** Raw CSV string chunks
**Output:** Stream of tokens (Field, FieldDelimiter, RecordDelimiter)

```typescript
import { CSVLexer } from 'web-csv-toolbox';

const lexer = new CSVLexer({ delimiter: ',', quotation: '"' });
const tokens = lexer.lex('name,age\r\nAlice,30\r\n');

for (const token of tokens) {
  console.log(token);
}
// { type: 'Field', value: 'name', location: {...} }
// { type: 'FieldDelimiter', value: ',', location: {...} }
// { type: 'Field', value: 'age', location: {...} }
// { type: 'RecordDelimiter', value: '\r\n', location: {...} }
// { type: 'Field', value: 'Alice', location: {...} }
// { type: 'FieldDelimiter', value: ',', location: {...} }
// { type: 'Field', value: '30', location: {...} }
// { type: 'RecordDelimiter', value: '\r\n', location: {...} }
```

**Why separate lexical analysis?**
- Handles complex escaping rules (quoted fields, escaped quotes)
- Provides precise error locations (line, column, offset)
- Enables syntax highlighting and validation tools
- Separates parsing logic from semantic interpretation

### Stage 2: Record Assembly (CSVRecordAssembler)

The **CSVRecordAssembler** converts tokens into structured CSV records (objects).

**Input:** Stream of tokens
**Output:** Stream of CSV records (JavaScript objects)

```typescript
import { CSVRecordAssembler } from 'web-csv-toolbox';

const assembler = new CSVRecordAssembler<['name', 'age']>();
const records = assembler.assemble(tokens);

for (const record of records) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
```

**Why separate record assembly?**
- Handles header extraction and field mapping
- Validates field count constraints
- Detects duplicate header fields
- Enables custom record transformation logic

## Stream-Based Architecture

Both stages support **streaming** through TransformStream implementations:

```typescript
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

const csvStream = new ReadableStream({
  start(controller) {
    controller.enqueue('name,age\r\n');
    controller.enqueue('Alice,30\r\n');
    controller.enqueue('Bob,25\r\n');
    controller.close();
  }
});

csvStream
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new CSVRecordAssemblerTransformer())
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record);
    }
  }));
```

**Benefits of streaming:**
- **Memory efficiency**: Process large files without loading entire content
- **Backpressure handling**: Automatic flow control prevents memory exhaustion
- **Composability**: Easy to add custom transformation stages
- **Web Standards**: Built on Web Streams API (supported across runtimes)

## Token Types

The CSVLexer produces three types of tokens:

### Field Token

Represents a CSV field value (data).

```typescript
{
  type: 'Field',
  value: 'Alice',
  location: {
    start: { line: 2, column: 1, offset: 10 },
    end: { line: 2, column: 6, offset: 15 },
    rowNumber: 2
  }
}
```

### FieldDelimiter Token

Represents a field separator (typically `,`).

```typescript
{
  type: 'FieldDelimiter',
  value: ',',
  location: {
    start: { line: 2, column: 6, offset: 15 },
    end: { line: 2, column: 7, offset: 16 },
    rowNumber: 2
  }
}
```

### RecordDelimiter Token

Represents a record separator (typically `\r\n` or `\n`).

```typescript
{
  type: 'RecordDelimiter',
  value: '\r\n',
  location: {
    start: { line: 2, column: 8, offset: 17 },
    end: { line: 3, column: 1, offset: 19 },
    rowNumber: 2
  }
}
```

## Buffering and Flushing

Both CSVLexer and CSVRecordAssembler use **buffering** to handle partial data:

### CSVLexer Buffering

```typescript
const lexer = new CSVLexer();

// First chunk - incomplete quoted field
const tokens1 = [...lexer.lex('"Hello', true)]; // buffering=true
console.log(tokens1); // [] - waiting for closing quote

// Second chunk - completes the field
const tokens2 = [...lexer.lex(' World"', true)];
console.log(tokens2); // [{ type: 'Field', value: 'Hello World' }]

// Flush remaining tokens
const tokens3 = lexer.flush();
```

### CSVRecordAssembler Buffering

```typescript
const assembler = new CSVRecordAssembler();

// Partial record
const records1 = [...assembler.assemble(tokens, false)]; // flush=false
console.log(records1); // [] - waiting for complete record

// Complete record
const records2 = [...assembler.assemble(moreTokens, true)]; // flush=true
console.log(records2); // [{ name: 'Alice', age: '30' }]
```

**Why buffering?**
- Handles streaming data that arrives in arbitrary chunks
- Ensures tokens/records are only emitted when complete
- Prevents premature parsing of incomplete data

## Error Handling

Each stage provides detailed error information:

### CSVLexer Errors

```typescript
try {
  const tokens = lexer.lex('"Unclosed quote');
  lexer.flush(); // Triggers error
} catch (error) {
  if (error instanceof ParseError) {
    console.log(error.message); // "Unexpected EOF while parsing quoted field."
    console.log(error.position); // { line: 1, column: 16, offset: 15 }
  }
}
```

### CSVRecordAssembler Errors

```typescript
try {
  const assembler = new CSVRecordAssembler();
  // Duplicate headers
  const tokens = [
    { type: 'Field', value: 'name' },
    { type: 'FieldDelimiter', value: ',' },
    { type: 'Field', value: 'name' }, // Duplicate!
    { type: 'RecordDelimiter', value: '\r\n' }
  ];
  [...assembler.assemble(tokens)];
} catch (error) {
  console.log(error.message); // "The header must not contain duplicate fields."
}
```

## Resource Limits

Both stages enforce configurable resource limits to prevent DoS attacks:

### CSVLexer Limits

```typescript
const lexer = new CSVLexer({
  maxBufferSize: 10 * 1024 * 1024 // 10MB (default)
});

// Throws RangeError if buffer exceeds limit
```

**Protection against:**
- Extremely long fields (e.g., 100MB single field)
- Unclosed quoted fields that consume memory

### CSVRecordAssembler Limits

```typescript
const assembler = new CSVRecordAssembler({
  maxFieldCount: 100_000 // Default
});

// Throws RangeError if field count exceeds limit
```

**Protection against:**
- CSV bombs (millions of fields in a single record)
- Memory exhaustion attacks

## Integration with High-Level APIs

The high-level APIs (`parse`, `parseString`, etc.) use these low-level components internally:

```typescript
// High-level API
import { parse } from 'web-csv-toolbox';

for await (const record of parse(csv)) {
  console.log(record);
}

// Equivalent low-level implementation
import { CSVLexer, CSVRecordAssembler } from 'web-csv-toolbox';

const lexer = new CSVLexer();
const assembler = new CSVRecordAssembler();

const tokens = lexer.lex(csv);
for (const record of assembler.assemble(tokens)) {
  console.log(record);
}
```

**High-level APIs add:**
- Automatic execution strategy selection (Worker, WASM)
- Response header parsing (`Content-Type`, `Content-Encoding`)
- AbortSignal integration
- Simplified error handling

## When to Use Low-Level APIs

**Use low-level APIs when:**
- Building custom CSV processing tools
- Implementing non-standard CSV dialects
- Adding custom validation or transformation logic
- Building syntax highlighters or editors
- Debugging parsing issues
- Performance profiling individual stages

**Use high-level APIs when:**
- Parsing standard CSV files
- Fetching CSV from network
- Simple data extraction
- Production applications (more features, better ergonomics)

## Performance Characteristics

### Memory Usage

| Component | Memory | Notes |
|-----------|--------|-------|
| CSVLexer | O(1) | Constant buffer size (configurable) |
| CSVRecordAssembler | O(1) | Only stores current record |
| CSVLexerTransformer | O(1) | Stream-based, no accumulation |
| CSVRecordAssemblerTransformer | O(1) | Stream-based, no accumulation |

### Processing Speed

<!-- TODO: Add actual benchmarks -->

- **CSVLexer**: Fastest stage (simple state machine)
- **CSVRecordAssembler**: Minimal overhead (object creation)
- **TransformStream overhead**: Negligible for medium+ files

**Note:** Actual performance depends on CSV complexity, field count, and escaping frequency.

## Comparison with Other Parsers

### web-csv-toolbox Architecture

```
Input → CSVLexer → Tokens → Assembler → Records
```

**Benefits:**
- Precise error locations
- Composable pipeline
- Memory-efficient streaming
- Easy to extend/customize

### Traditional Parser Architecture

```
Input → Parser (combined) → Records
```

**Trade-offs:**
- Simpler implementation
- Faster for small files (less abstraction overhead)
- Less flexible (harder to customize)
- Harder to debug (mixed concerns)

## Related Documentation

- **[CSVLexer API Reference](../reference/api/lexer.md)**: Detailed API documentation
- **[CSVRecordAssembler API Reference](../reference/api/record-assembler.md)**: Detailed API documentation
- **[Custom CSV Parser How-To](../how-to-guides/custom-csv-parser.md)**: Practical examples
- **[Execution Strategies](./execution-strategies.md)**: Worker and WASM execution

## Summary

web-csv-toolbox's two-stage pipeline architecture provides:

1. **Separation of concerns**: Lexing and assembly are independent
2. **Streaming support**: Memory-efficient processing via Web Streams
3. **Error precision**: Token location tracking for debugging
4. **Resource limits**: Built-in DoS protection
5. **Flexibility**: Composable, extensible, customizable

For most use cases, the high-level APIs are recommended. Use low-level APIs when you need fine-grained control over the parsing process.
