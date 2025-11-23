---
title: CSV Parsing Architecture
group: Explanation
---

# CSV Parsing Architecture

This document explains the internal architecture of web-csv-toolbox's CSV parsing system and how the low-level APIs work together.

## Overview

web-csv-toolbox uses a **3-tier architecture** for CSV parsing, providing flexibility from simple one-step parsing to advanced pipeline customization:

### Tier 1: Parser Models (Simplified Composition)

```
CSV Data → Parser (Lexer + Assembler) → Records
```

Combined Lexer + Assembler for streamlined usage. Best for most use cases.

### Tier 2: Low-Level Pipeline (Advanced Control)

```
CSV String → CSVLexer → Tokens → CSVRecordAssembler → Records
```

Granular control over tokenization and assembly. Best for custom dialects and extensions.

### Tier 3: Custom Implementation

Build your own parser using the token types and interfaces. Best for specialized requirements.

---

This tiered architecture provides:
- **Progressive complexity**: Choose the right abstraction level for your needs
- **Modularity**: Each tier has a single responsibility
- **Testability**: Each component can be tested independently
- **Flexibility**: Users can customize or replace individual tiers
- **Performance**: Streaming architecture enables memory-efficient processing

## Tier 1: Parser Models

Parser models provide a simplified API by composing Lexer and Assembler internally. This is the recommended starting point for most users.

### String CSV Parser

The **FlexibleStringCSVParser** parses CSV strings by composing `FlexibleStringCSVLexer` and CSV Record Assembler.

**Input:** CSV string chunks
**Output:** Array of CSV records

```typescript
import { FlexibleStringCSVParser } from 'web-csv-toolbox';

const parser = new FlexibleStringCSVParser({
  header: ['name', 'age'] as const,
  outputFormat: 'object', // or 'array'
});

// Parse complete data
const records1 = parser.parse('Alice,30\nBob,25\n');
console.log(records1);
// [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]
```

**Streaming Mode - Chunk-by-Chunk Processing**

When processing data in chunks, you must call `parse()` without arguments at the end to flush any remaining data:

```typescript
// Streaming mode - parse chunk by chunk
const parser = new FlexibleStringCSVParser({
  header: ['name', 'age'] as const,
});

const records1 = parser.parse('Alice,30\nBob,', { stream: true });
console.log(records1); // [{ name: 'Alice', age: '30' }] - complete records only

const records2 = parser.parse('25\nCharlie,', { stream: true });
console.log(records2); // [{ name: 'Bob', age: '25' }] - now Bob's record is complete

// IMPORTANT: Flush remaining data
const records3 = parser.parse(); // Flush call required!
console.log(records3); // [{ name: 'Charlie', age: undefined }] - remaining partial record
```

**Why use String Parser?**
- Simplified API - no manual Lexer + Assembler composition
- Stateful streaming support
- Supports both object and array output formats
- Full options support (delimiter, quotation, columnCountStrategy, etc.)

### Binary CSV Parser

The **FlexibleBinaryCSVParser** parses binary CSV data (BufferSource: Uint8Array, ArrayBuffer, or other TypedArray) by composing `TextDecoder` with `FlexibleStringCSVParser`.

**Input:** BufferSource (Uint8Array, ArrayBuffer, or other TypedArray) chunks
**Output:** Array of CSV records

```typescript
import { FlexibleBinaryCSVParser } from 'web-csv-toolbox';

const parser = new FlexibleBinaryCSVParser({
  header: ['name', 'age'] as const,
  charset: 'utf-8',
  ignoreBOM: true,
});

const encoder = new TextEncoder();
const data = encoder.encode('Alice,30\nBob,25\n');

const records = parser.parse(data);
console.log(records);
// [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]

// With ArrayBuffer
const buffer = await fetch('data.csv').then(r => r.arrayBuffer());
const records = parser.parse(buffer);
```

**Streaming Mode - Multi-byte Character Handling**

When processing data in chunks, you must call `parse()` without arguments at the end to flush TextDecoder and parser buffers:

```typescript
// Streaming mode - handles multi-byte characters across chunks
const parser = new FlexibleBinaryCSVParser({
  header: ['name', 'age'] as const,
});

const utf8Bytes = encoder.encode('Alice,30\nあ,25\n'); // Multi-byte character
const chunk1 = utf8Bytes.slice(0, 15); // May split multi-byte character
const chunk2 = utf8Bytes.slice(15);

const records1 = parser.parse(chunk1, { stream: true });
console.log(records1); // [{ name: 'Alice', age: '30' }] - complete records only

const records2 = parser.parse(chunk2, { stream: true });
console.log(records2); // [] - waiting for complete record

// IMPORTANT: Flush remaining data
const records3 = parser.parse(); // Flush call required!
console.log(records3); // [{ name: 'あ', age: '25' }] - remaining data
```

**Why use Binary Parser?**
- Accepts any BufferSource type (Uint8Array, ArrayBuffer, TypedArray views)
- Handles character encoding (utf-8, shift_jis, etc.)
- TextDecoder with `stream: true` for multi-byte character support
- BOM handling via `ignoreBOM` option
- Fatal error mode via `fatal` option
- Ideal for file uploads and fetch API responses

### Parser Streaming with TransformStream

Both parsers work seamlessly with `StringCSVParserStream` and `BinaryCSVParserStream`:

```typescript
import { FlexibleStringCSVParser, StringCSVParserStream } from 'web-csv-toolbox';

const parser = new FlexibleStringCSVParser({
  header: ['name', 'age'] as const,
});
const stream = new StringCSVParserStream(parser);

await fetch('data.csv')
  .then(res => res.body)
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(stream)
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record); // { name: '...', age: '...' }
    }
  }));
```

```typescript
import { FlexibleBinaryCSVParser, BinaryCSVParserStream } from 'web-csv-toolbox';

const parser = new FlexibleBinaryCSVParser({
  header: ['name', 'age'] as const,
  charset: 'utf-8',
});
const stream = new BinaryCSVParserStream(parser);

await fetch('data.csv')
  .then(res => res.body)
  .pipeThrough(stream) // Directly pipe binary data
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record);
    }
  }));
```

**Benefits of Parser Streams:**
- Accepts parser instances (doesn't construct internally)
- Configurable backpressure handling
- Custom queuing strategies support
- Follows existing Transformer patterns

## Tier 2: Low-Level Pipeline

For advanced use cases requiring granular control, you can use the Lexer and Assembler directly.

### Stage 1: Lexical Analysis (CSVLexer)

The **CSVLexer** converts raw CSV text into a stream of **tokens**.

**Input:** Raw CSV string chunks
**Output:** Stream of tokens (Field, FieldDelimiter, RecordDelimiter)

```typescript
import { FlexibleStringCSVLexer } from 'web-csv-toolbox';

const lexer = new FlexibleStringCSVLexer({ delimiter: ',', quotation: '"' });
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
import { FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

const assembler = new FlexibleCSVRecordAssembler<['name', 'age']>();
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
const lexer = new FlexibleStringCSVLexer();

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
const assembler = new FlexibleCSVRecordAssembler();

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
  const assembler = new FlexibleCSVRecordAssembler();
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
const lexer = new FlexibleStringCSVLexer({
  maxBufferSize: 10 * 1024 * 1024 // 10MB (default)
});

// Throws RangeError if buffer exceeds limit
```

**Protection against:**
- Extremely long fields (e.g., 100MB single field)
- Unclosed quoted fields that consume memory

### CSVRecordAssembler Limits

```typescript
const assembler = new FlexibleCSVRecordAssembler({
  maxFieldCount: 100_000 // Default
});

// Throws RangeError if field count exceeds limit
```

**Protection against:**
- CSV bombs (millions of fields in a single record)
- Memory exhaustion attacks

## Integration with High-Level APIs

The high-level APIs (`parse`, `parseString`, etc.) use these low-level components internally, with Parser models serving as the primary implementation:

```typescript
// High-level API
import { parse } from 'web-csv-toolbox';

for await (const record of parse(csv)) {
  console.log(record);
}

// Equivalent using Parser (Tier 1)
import { FlexibleStringCSVParser } from 'web-csv-toolbox';

const parser = new FlexibleStringCSVParser();
for (const record of parser.parse(csv)) {
  console.log(record);
}

// Equivalent using Lexer + Assembler (Tier 2)
import { FlexibleStringCSVLexer, FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

const lexer = new FlexibleStringCSVLexer();
const assembler = new FlexibleCSVRecordAssembler();

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

**Parser models (Tier 1) add over raw Lexer + Assembler:**
- Simplified API - single class instead of manual composition
- Stateful streaming support with `{ stream: true }` option
- Binary data handling with TextDecoder integration

## Choosing the Right Tier

### Use High-Level APIs (`parse`, `parseString`, etc.) when:
- Parsing standard CSV files
- Fetching CSV from network
- Simple data extraction
- Production applications (most features, best ergonomics)
- Want automatic Worker/WASM execution

### Use Parser Models (Tier 1) when:
- Need stateful parsing with streaming support
- Working with binary data (Uint8Array/ArrayBuffer)
- Want composition benefits without manual Lexer + Assembler wiring
- Building custom CSV processing pipelines
- Need character encoding support (charset, BOM handling)
- Streaming file uploads or fetch responses

### Use Lexer + Assembler (Tier 2) when:
- Implementing non-standard CSV dialects
- Building syntax highlighters or editors
- Need access to raw tokens for custom processing
- Debugging parsing issues at token level
- Performance profiling individual stages
- Extending parser with custom token transformation

### Use Custom Implementation (Tier 3) when:
- Building entirely new CSV variants
- Research and experimentation
- Educational purposes

## Performance Characteristics

### Memory Usage

| Component | Memory | Notes |
|-----------|--------|-------|
| FlexibleStringCSVParser | O(1) | Stateful composition of Lexer + Assembler |
| FlexibleBinaryCSVParser | O(1) | Adds TextDecoder overhead (minimal) |
| StringCSVParserStream | O(1) | Stream-based, no accumulation |
| BinaryCSVParserStream | O(1) | Stream-based, no accumulation |
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

### web-csv-toolbox Architecture (3-Tier)

```
// Tier 1: Parser Models (recommended for most users)
Input → Parser (Lexer + Assembler) → Records

// Tier 2: Low-Level Pipeline (advanced customization)
Input → CSVLexer → Tokens → Assembler → Records

// Tier 3: Custom Implementation (specialized needs)
Input → Your Custom Implementation → Records
```

**Benefits:**
- **Progressive complexity**: Choose abstraction level based on needs
- **Precise error locations**: Token-level tracking
- **Composable pipeline**: Mix and match components
- **Memory-efficient streaming**: O(1) memory usage
- **Easy to extend/customize**: Multiple entry points
- **Type safety**: Full TypeScript support across all tiers

### Traditional Parser Architecture

```
Input → Parser (combined) → Records
```

**Trade-offs:**
- Simpler implementation (monolithic)
- Faster for small files (less abstraction overhead)
- Less flexible (harder to customize)
- Harder to debug (mixed concerns)
- No intermediate token access

## Related Documentation

- **[CSVLexer API Reference](https://kamiazya.github.io/web-csv-toolbox/classes/CSVLexer.html)**: Detailed API documentation
- **[CSVRecordAssembler API Reference](https://kamiazya.github.io/web-csv-toolbox/classes/CSVRecordAssembler.html)**: Detailed API documentation
- **[Custom CSV Parser How-To](../how-to-guides/custom-csv-parser.md)**: Practical examples
- **[Execution Strategies](./execution-strategies.md)**: Worker and WASM execution

## Summary

web-csv-toolbox's 3-tier architecture provides:

1. **Progressive complexity**: Choose the right abstraction level
   - Tier 1 (Parser Models): Simplified composition for most users
   - Tier 2 (Lexer + Assembler): Granular control for advanced needs
   - Tier 3 (Custom): Full flexibility for specialized requirements

2. **Separation of concerns**: Lexing and assembly are independent

3. **Streaming support**: Memory-efficient processing via Web Streams
   - `StringCSVParserStream` and `BinaryCSVParserStream` for Parser models
   - `CSVLexerTransformer` and `CSVRecordAssemblerTransformer` for low-level pipeline

4. **Error precision**: Token location tracking for debugging

5. **Resource limits**: Built-in DoS protection across all tiers

6. **Flexibility**: Composable, extensible, customizable at every level

**Recommendations:**
- **Most users**: Start with high-level APIs (`parse`, `parseString`)
- **Streaming/binary needs**: Use Parser Models (Tier 1)
- **Custom dialects**: Use Lexer + Assembler (Tier 2)
- **Specialized requirements**: Build custom implementation (Tier 3)
