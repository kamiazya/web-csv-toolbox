# CSVLexer API Reference

The **CSVLexer** class converts raw CSV text into a stream of tokens. This is the first stage of web-csv-toolbox's two-stage parsing pipeline.

## Overview

```typescript
import { CSVLexer } from 'web-csv-toolbox';

const lexer = new CSVLexer({ delimiter: ',', quotation: '"' });
const tokens = lexer.lex('Alice,30\r\n');

for (const token of tokens) {
  console.log(token);
}
// { type: 'Field', value: 'Alice', location: {...} }
// { type: 'FieldDelimiter', value: ',', location: {...} }
// { type: 'Field', value: '30', location: {...} }
// { type: 'RecordDelimiter', value: '\r\n', location: {...} }
```

## Constructor

```typescript
new CSVLexer<Delimiter, Quotation>(options?: LexerOptions)
```

### Type Parameters

- `Delimiter extends string = ','` - Field delimiter type (default: comma)
- `Quotation extends string = '"'` - Quotation character type (default: double-quote)

### Options

```typescript
interface LexerOptions {
  delimiter?: string;
  quotation?: string;
  maxBufferSize?: number;
  signal?: AbortSignal;
}
```

#### `delimiter`

**Type:** `string`
**Default:** `','`

The field delimiter character.

**Example:**
```typescript
const lexer = new CSVLexer({ delimiter: '\t' }); // TSV
```

#### `quotation`

**Type:** `string`
**Default:** `'"'`

The quotation character for escaping fields.

**Example:**
```typescript
const lexer = new CSVLexer({ quotation: "'" }); // Single-quote
```

**Note:** If using WebAssembly execution, only `'"'` (double-quote) is supported.

#### `maxBufferSize`

**Type:** `number`
**Default:** `10485760` (10M characters)

Maximum buffer size in characters (UTF-16 code units).

**Why it matters:**
- Prevents memory exhaustion from unbounded input accumulation
- Protects against DoS attacks (malicious CSV with extremely long fields)

**Example:**
```typescript
const lexer = new CSVLexer({
  maxBufferSize: 1024 * 1024 // 1M characters
});
```

**When to adjust:**
- ✅ Increase for legitimate large fields (e.g., long text columns)
- ❌ Don't set too high (memory exhaustion risk)

#### `signal`

**Type:** `AbortSignal`
**Default:** `undefined`

AbortSignal for canceling lexing operations.

**Example:**
```typescript
const controller = new AbortController();
const lexer = new CSVLexer({ signal: controller.signal });

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  for (const token of lexer.lex(csv)) {
    console.log(token);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Lexing was aborted');
  }
}
```

---

## Methods

### `lex()`

Lexes the given chunk of CSV data.

```typescript
lex(chunk: string | null, buffering?: boolean): IterableIterator<Token>
```

#### Parameters

##### `chunk`

**Type:** `string | null`

The chunk of CSV data to be lexed.

- Pass `string` to add data to the buffer
- Pass `null` to indicate no more data (equivalent to `buffering: false`)

##### `buffering`

**Type:** `boolean`
**Default:** `false`

Indicates whether the lexer should buffer incomplete tokens.

- `false`: Final chunk, flush all tokens including incomplete ones
- `true`: More chunks coming, buffer incomplete tokens

#### Returns

`IterableIterator<Token>` - An iterator of tokens

#### Example: Single Chunk

```typescript
const lexer = new CSVLexer();
const tokens = [...lexer.lex('Alice,30\r\n')]; // buffering=false (default)

console.log(tokens);
// [
//   { type: 'Field', value: 'Alice', location: {...} },
//   { type: 'FieldDelimiter', value: ',', location: {...} },
//   { type: 'Field', value: '30', location: {...} },
//   { type: 'RecordDelimiter', value: '\r\n', location: {...} }
// ]
```

#### Example: Multiple Chunks

```typescript
const lexer = new CSVLexer();

// First chunk - incomplete field
const tokens1 = [...lexer.lex('"Hello', true)]; // buffering=true
console.log(tokens1); // [] - waiting for closing quote

// Second chunk - completes field
const tokens2 = [...lexer.lex(' World",30\r\n', true)];
console.log(tokens2);
// [
//   { type: 'Field', value: 'Hello World', location: {...} },
//   { type: 'FieldDelimiter', value: ',', location: {...} },
//   { type: 'Field', value: '30', location: {...} }
// ]

// Final flush
const tokens3 = [...lexer.lex(null)]; // or lexer.flush()
console.log(tokens3);
// [{ type: 'RecordDelimiter', value: '\r\n', location: {...} }]
```

---

### `flush()`

Flushes the lexer and returns any remaining tokens.

```typescript
flush(): Token[]
```

#### Returns

`Token[]` - Array of remaining tokens

#### Example

```typescript
const lexer = new CSVLexer();

lexer.lex('Alice,30', true); // buffering=true, returns nothing

const tokens = lexer.flush(); // Force flush
console.log(tokens);
// [
//   { type: 'Field', value: 'Alice', location: {...} },
//   { type: 'FieldDelimiter', value: ',', location: {...} },
//   { type: 'Field', value: '30', location: {...} }
// ]
```

**When to use:**
- End of streaming data (alternative to `lex(null)`)
- Manual control over token emission

---

## Token Types

The CSVLexer produces three types of tokens:

### Field Token

Represents a CSV field value (data).

```typescript
{
  type: 'Field',
  value: string,
  location: {
    start: Position,
    end: Position,
    rowNumber: number
  }
}
```

**Example:**
```typescript
{
  type: 'Field',
  value: 'Alice',
  location: {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 6, offset: 5 },
    rowNumber: 1
  }
}
```

---

### FieldDelimiter Token

Represents a field separator (typically `,`).

```typescript
{
  type: 'FieldDelimiter',
  value: string,
  location: {
    start: Position,
    end: Position,
    rowNumber: number
  }
}
```

**Example:**
```typescript
{
  type: 'FieldDelimiter',
  value: ',',
  location: {
    start: { line: 1, column: 6, offset: 5 },
    end: { line: 1, column: 7, offset: 6 },
    rowNumber: 1
  }
}
```

---

### RecordDelimiter Token

Represents a record separator (typically `\r\n` or `\n`).

```typescript
{
  type: 'RecordDelimiter',
  value: string,
  location: {
    start: Position,
    end: Position,
    rowNumber: number
  }
}
```

**Example:**
```typescript
{
  type: 'RecordDelimiter',
  value: '\r\n',
  location: {
    start: { line: 1, column: 9, offset: 8 },
    end: { line: 2, column: 1, offset: 10 },
    rowNumber: 1
  }
}
```

---

### Position Object

```typescript
interface Position {
  line: number;    // 1-indexed line number
  column: number;  // 1-indexed column number
  offset: number;  // 0-indexed byte offset
}
```

**Use cases:**
- Error reporting (show exact location of syntax errors)
- Syntax highlighting (map tokens to editor positions)
- Debugging (trace parsing issues)

---

## Error Handling

### RangeError: Buffer Size Exceeded

Thrown when input exceeds `maxBufferSize`.

```typescript
const lexer = new CSVLexer({ maxBufferSize: 100 });

try {
  const tokens = [...lexer.lex('a'.repeat(200))];
} catch (error) {
  if (error instanceof RangeError) {
    console.error(error.message);
    // "Buffer size (200 characters) exceeded maximum allowed size of 100 characters"
  }
}
```

**How to handle:**
- ✅ Use streaming APIs (`CSVLexerTransformer`) for large inputs
- ✅ Increase `maxBufferSize` if legitimate use case
- ❌ Don't remove the limit (DoS vulnerability)

---

### ParseError: Unclosed Quoted Field

Thrown when a quoted field is not properly closed.

```typescript
const lexer = new CSVLexer();

try {
  lexer.lex('"Unclosed quote'); // No closing quote
  lexer.flush(); // Triggers error
} catch (error) {
  if (error.name === 'ParseError') {
    console.error(error.message);
    // "Unexpected EOF while parsing quoted field."

    console.error(error.position);
    // { line: 1, column: 16, offset: 15 }
  }
}
```

---

### AbortError

Thrown when lexing is canceled via `AbortSignal`.

```typescript
const controller = new AbortController();
const lexer = new CSVLexer({ signal: controller.signal });

setTimeout(() => controller.abort(), 100);

try {
  for (const token of lexer.lex(largeCSV)) {
    console.log(token);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Lexing was aborted');
  }
}
```

---

## Usage Patterns

### Pattern 1: Simple Lexing

```typescript
const lexer = new CSVLexer();
const tokens = [...lexer.lex('name,age\r\nAlice,30\r\n')];

for (const token of tokens) {
  console.log(token);
}
```

**Use case:** Small CSV strings, synchronous processing

---

### Pattern 2: Streaming Lexing

```typescript
const lexer = new CSVLexer();
const chunks = ['name,age\r\n', 'Alice,30\r\n', 'Bob,25\r\n'];

for (const chunk of chunks) {
  const tokens = lexer.lex(chunk, true); // buffering=true
  for (const token of tokens) {
    console.log(token);
  }
}

// Don't forget to flush!
const remainingTokens = lexer.flush();
for (const token of remainingTokens) {
  console.log(token);
}
```

**Use case:** Large files, network streams, memory-constrained environments

---

### Pattern 3: Custom Delimiter

```typescript
// Tab-separated values (TSV)
const lexer = new CSVLexer({ delimiter: '\t' });
const tokens = [...lexer.lex('name\tage\r\nAlice\t30\r\n')];

for (const token of tokens) {
  console.log(token);
}
```

**Use case:** Non-comma delimiters (TSV, pipe-separated, etc.)

---

### Pattern 4: With AbortSignal

```typescript
const controller = new AbortController();
const lexer = new CSVLexer({ signal: controller.signal });

// Abort after 5 seconds
const timeout = setTimeout(() => controller.abort(), 5000);

try {
  for (const token of lexer.lex(csv)) {
    // Process token
  }
  clearTimeout(timeout);
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Lexing was canceled');
  }
}
```

**Use case:** User-cancelable operations, timeout protection

---

## Performance Characteristics

### Memory Usage

**O(1)** - Constant memory usage

- Internal buffer size limited by `maxBufferSize`
- Tokens are yielded incrementally (not stored)
- Suitable for arbitrarily large CSV files

### Processing Speed

**O(n)** - Linear time complexity

- Single pass through input
- No backtracking
- Fast state machine implementation

### Bottlenecks

- **Long quoted fields**: Must buffer entire field before emitting token
- **Complex escaping**: Escaped quotes require character-by-character processing

---

## Related APIs

- **[CSVLexerTransformer](./lexer-transformer.md)** - TransformStream wrapper for streaming pipelines
- **[CSVRecordAssembler](./record-assembler.md)** - Converts tokens to CSV records
- **[Parsing Architecture](../../explanation/parsing-architecture.md)** - Understanding the two-stage pipeline

---

## Examples

### Example 1: Syntax Highlighter

```typescript
import { CSVLexer } from 'web-csv-toolbox';

function highlightCSV(csv: string): string {
  const lexer = new CSVLexer();
  const tokens = lexer.lex(csv);
  let highlighted = '';

  for (const token of tokens) {
    switch (token.type) {
      case 'Field':
        highlighted += `<span class="field">${token.value}</span>`;
        break;
      case 'FieldDelimiter':
        highlighted += `<span class="delimiter">${token.value}</span>`;
        break;
      case 'RecordDelimiter':
        highlighted += '<br>';
        break;
    }
  }

  return highlighted;
}

console.log(highlightCSV('Alice,30\r\nBob,25\r\n'));
```

---

### Example 2: CSV Validator

```typescript
import { CSVLexer } from 'web-csv-toolbox';

function validateCSV(csv: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const lexer = new CSVLexer();

  try {
    let fieldCount: number | null = null;
    let currentFieldCount = 1;

    for (const token of lexer.lex(csv)) {
      if (token.type === 'FieldDelimiter') {
        currentFieldCount++;
      } else if (token.type === 'RecordDelimiter') {
        if (fieldCount === null) {
          fieldCount = currentFieldCount;
        } else if (currentFieldCount !== fieldCount) {
          errors.push(
            `Row ${token.location.rowNumber}: Expected ${fieldCount} fields, got ${currentFieldCount}`
          );
        }
        currentFieldCount = 1;
      }
    }

    return { valid: errors.length === 0, errors };
  } catch (error) {
    return { valid: false, errors: [error.message] };
  }
}

console.log(validateCSV('name,age\r\nAlice,30\r\nBob\r\n'));
// { valid: false, errors: ['Row 3: Expected 2 fields, got 1'] }
```

---

### Example 3: Token Stream to JSON

```typescript
import { CSVLexer } from 'web-csv-toolbox';

function tokensToJSON(csv: string): string {
  const lexer = new CSVLexer();
  const tokens = [...lexer.lex(csv)];

  return JSON.stringify(tokens, null, 2);
}

console.log(tokensToJSON('Alice,30\r\n'));
```

---

## Best Practices

### ✅ Do

- Use `buffering: true` when processing streaming data
- Always call `flush()` at the end of streaming
- Set appropriate `maxBufferSize` for your use case
- Use `AbortSignal` for long-running operations
- Handle `ParseError` and `RangeError` gracefully

### ❌ Don't

- Don't store all tokens in memory (defeats streaming purpose)
- Don't remove `maxBufferSize` limit (DoS vulnerability)
- Don't ignore errors (silent failures are bad UX)
- Don't use CSVLexer directly for production CSV parsing (use high-level APIs instead)

---

## When to Use CSVLexer Directly

**✅ Use CSVLexer when:**
- Building custom CSV processing tools
- Implementing syntax highlighters or editors
- Debugging parsing issues
- Creating non-standard CSV dialects
- Performance profiling lexical analysis stage

**❌ Use high-level APIs when:**
- Parsing standard CSV files
- Production applications
- Simple data extraction
- Network CSV fetching

See: [parse()](../../tutorials/getting-started.md), [parseString()](../../tutorials/getting-started.md)

---

## Browser and Runtime Support

The CSVLexer API works across all supported runtimes:

- ✅ Node.js LTS
- ✅ Deno LTS
- ✅ Modern browsers (Chrome, Firefox, Edge, Safari)

See: [Supported Environments](../supported-environments.md)

---

## TypeScript Types

```typescript
import type { Token, Position, LexerOptions } from 'web-csv-toolbox';

// Token union type
type Token = FieldToken | FieldDelimiterToken | RecordDelimiterToken;

interface FieldToken {
  type: 'Field';
  value: string;
  location: Location;
}

interface FieldDelimiterToken {
  type: 'FieldDelimiter';
  value: string;
  location: Location;
}

interface RecordDelimiterToken {
  type: 'RecordDelimiter';
  value: string;
  location: Location;
}

interface Location {
  start: Position;
  end: Position;
  rowNumber: number;
}

interface Position {
  line: number;
  column: number;
  offset: number;
}
```
