---
title: Build a Custom CSV Parser
group: How-to Guides
---

# How to Build a Custom CSV Parser

This guide shows you how to use web-csv-toolbox's low-level APIs to build custom CSV parsers for specialized use cases.

## Prerequisites

- Basic understanding of CSV format
- Familiarity with JavaScript iterators and generators
- Knowledge of Web Streams API (for streaming examples)

## Why Build a Custom Parser?

Use low-level APIs when you need:

- **Custom CSV dialects**: Non-standard delimiters, quote characters
- **Custom validation**: Field-level or record-level validation
- **Custom transformations**: Data normalization, type conversion
- **Syntax highlighting**: Building CSV editors or viewers
- **Performance optimization**: Fine-tuned control over parsing stages
- **Debugging**: Understanding exactly how parsing works

For standard CSV parsing, use the high-level APIs: [parse()](../tutorials/getting-started.md), [parseString()](../tutorials/getting-started.md)

---

## Understanding the 3-Tier Architecture

web-csv-toolbox uses a 3-tier architecture for CSV parsing:

### Tier 1: Parser Models (Simplified Composition)

```
CSV Data → Parser (Lexer + Assembler) → Records
```

**Recommended for most custom parsing needs:**
- `createStringCSVParser(options?)` - Factory for string CSV parsers (returns format-specific parser)
  - `FlexibleStringObjectCSVParser` - Object output format
  - `FlexibleStringArrayCSVParser` - Array output format
- `createBinaryCSVParser(options?)` - Factory for binary CSV parsers with encoding support
  - `FlexibleBinaryObjectCSVParser` - Object output format
  - `FlexibleBinaryArrayCSVParser` - Array output format
- Stateful streaming support via `{ stream: true }` option
- **Note**: Low-level API (accepts `CSVProcessingOptions`, no `engine` option)

### Tier 2: Low-Level Pipeline (Advanced Control)

```
CSV String → CSVLexer → Tokens → CSVRecordAssembler → Records
```

**For advanced customization:**
- `FlexibleStringCSVLexer` - Tokenization
- `FlexibleCSVRecordAssembler` - Record assembly

### Tier 3: Custom Implementation

Build your own parser using token types and interfaces.

See: [Parsing Architecture](../explanation/parsing-architecture.md)

---

## Basic Custom Parser

### Using Parser Models (Recommended)

The simplest way to build a custom parser is using Parser Models (Tier 1):

```typescript
import { createStringCSVParser } from 'web-csv-toolbox';

function parseCSV(csv: string) {
  const parser = createStringCSVParser({
    header: ['name', 'age'] as const,
    // outputFormat: 'object' is default
  });

  return parser.parse(csv);
}

// Usage
for (const record of parseCSV('Alice,30\nBob,25\n')) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
// { name: 'Bob', age: '25' }
```

**Note**: `createStringCSVParser` accepts `CSVProcessingOptions` (no `engine` option). For high-level APIs with execution strategy support, use `parseString()` instead.

**Benefits:**
- Single class instead of Lexer + Assembler composition
- Stateful streaming support built-in
- Simpler API for most use cases

### Using Low-Level APIs (Advanced)

For advanced control, use the Lexer + Assembler pipeline (Tier 2):

```typescript
import { FlexibleStringCSVLexer, FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

function parseCSV(csv: string) {
  // Stage 1: Tokenization
  const lexer = new FlexibleStringCSVLexer();
  const tokens = lexer.lex(csv);

  // Stage 2: Record assembly
  const assembler = new FlexibleCSVRecordAssembler();
  const records = assembler.assemble(tokens);

  return records;
}

// Usage
for (const record of parseCSV('name,age\r\nAlice,30\r\n')) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
```

**Use when:**
- Need access to raw tokens
- Building syntax highlighters or validators
- Custom token transformation

---

## Custom Delimiters

### Tab-Separated Values (TSV)

**Using Parser Model:**

```typescript
import { createStringCSVParser } from 'web-csv-toolbox';

function parseTSV(tsv: string) {
  const parser = createStringCSVParser({ delimiter: '\t' });
  return parser.parse(tsv);
}

// Usage
for (const record of parseTSV('name\tage\r\nAlice\t30\r\n')) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
```

**Using Low-Level APIs:**

```typescript
import { FlexibleStringCSVLexer, FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

function parseTSV(tsv: string) {
  const lexer = new FlexibleStringCSVLexer({ delimiter: '\t' });
  const tokens = lexer.lex(tsv);

  const assembler = new FlexibleCSVRecordAssembler();
  const records = assembler.assemble(tokens);

  return records;
}

// Usage
for (const record of parseTSV('name\tage\r\nAlice\t30\r\n')) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
```

---

### Pipe-Separated Values

**Using Parser Model:**

```typescript
import { createStringCSVParser } from 'web-csv-toolbox';

function parsePSV(psv: string) {
  const parser = createStringCSVParser({ delimiter: '|' });
  return parser.parse(psv);
}

// Usage
for (const record of parsePSV('name|age\r\nAlice|30\r\n')) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
```

---

## Custom Headers

### Use Custom Header

```typescript
import { FlexibleStringCSVLexer, FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

function parseWithCustomHeader(csv: string, header: string[]) {
  const lexer = new FlexibleStringCSVLexer();
  const tokens = lexer.lex(csv);

  // Pre-define header (all rows treated as data)
  const assembler = new FlexibleCSVRecordAssembler({ header });
  const records = assembler.assemble(tokens);

  return records;
}

// Usage: CSV without header row - use custom field names
for (const record of parseWithCustomHeader(
  'Alice,Smith\r\nBob,Johnson\r\n',
  ['firstName', 'lastName']
)) {
  console.log(record);
}
// { firstName: 'Alice', lastName: 'Smith' }
// { firstName: 'Bob', lastName: 'Johnson' }
```

---

### No Header Row

```typescript
import { FlexibleStringCSVLexer, FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

function parseHeaderless(csv: string, header: string[]) {
  const lexer = new FlexibleStringCSVLexer();
  const tokens = lexer.lex(csv);

  const assembler = new FlexibleCSVRecordAssembler({ header });
  const records = assembler.assemble(tokens);

  return records;
}

// Usage (CSV has no header row)
for (const record of parseHeaderless(
  'Alice,30\r\nBob,25\r\n',
  ['name', 'age']
)) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
// { name: 'Bob', age: '25' }
```

---

### Controlling Record Output and Column Alignment

Use the new `createCSVRecordAssembler()` factory when you need to swap between object output (default) and array/tuple output or to fine-tune how rows align with headers:

```typescript
import {
  createCSVRecordAssembler,
  FlexibleStringCSVLexer,
} from 'web-csv-toolbox';

function parseAsTuples(csv: string) {
  const lexer = new FlexibleStringCSVLexer();
  const tokens = lexer.lex(csv);

  const assembler = createCSVRecordAssembler({
    header: ['name', 'age'] as const,
    outputFormat: 'array',
    includeHeader: true,
    columnCountStrategy: 'pad',
  });

  return assembler.assemble(tokens);
}

const rows = [...parseAsTuples('name,age\r\nAlice,30\r\nBob,25\r\n')];
// rows[0] -> ['name', 'age'] (header row)
// rows[1] -> readonly [name: 'Alice', age: '30']
```

- `outputFormat: 'object'` keeps the traditional `{ column: value }` shape.
- `outputFormat: 'array'` returns readonly tuples with header-derived names (great for TypeScript exhaustiveness checks).
- `includeHeader: true` prepends the header row when you output arrays — perfect for re-exporting CSV data.
- `columnCountStrategy` decides how mismatched rows behave when you provide a header:
  - `keep` (default for array format) emits rows exactly as parsed.
  - `pad` (default for object format) fills missing fields with `undefined` and trims extras.
  - `strict` throws if a row has a different column count.
  - `truncate` silently drops columns beyond the header length.

> Need to stick with classes? You can still instantiate `FlexibleCSVObjectRecordAssembler` or `FlexibleCSVArrayRecordAssembler` directly. `FlexibleCSVRecordAssembler` remains for backward compatibility, but the factory makes it easier to share consistent options.

---

## Data Validation

### Field-Level Validation

```typescript
import { FlexibleStringCSVLexer, FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

function* parseWithValidation(csv: string) {
  const lexer = new FlexibleStringCSVLexer();
  const tokens = lexer.lex(csv);

  const assembler = new FlexibleCSVRecordAssembler<['name', 'age', 'email']>();
  const records = assembler.assemble(tokens);

  for (const record of records) {
    // Validate each field
    if (!record.name || record.name.trim() === '') {
      throw new Error(`Invalid name: ${record.name}`);
    }

    const age = Number(record.age);
    if (!Number.isInteger(age) || age < 0 || age > 150) {
      throw new Error(`Invalid age: ${record.age}`);
    }

    if (!record.email?.includes('@')) {
      throw new Error(`Invalid email: ${record.email}`);
    }

    yield record;
  }
}

// Usage
try {
  for (const record of parseWithValidation(
    'name,age,email\r\nAlice,30,alice@example.com\r\nBob,invalid,bob\r\n'
  )) {
    console.log(record);
  }
} catch (error) {
  console.error(error.message); // "Invalid age: invalid"
}
```

---

### Schema Validation with Zod

```typescript
import { FlexibleStringCSVLexer, FlexibleCSVRecordAssembler } from 'web-csv-toolbox';
import { z } from 'zod';

const recordSchema = z.object({
  name: z.string().min(1).max(100),
  age: z.coerce.number().int().min(0).max(150),
  email: z.string().email(),
});

function* parseWithSchema(csv: string) {
  const lexer = new FlexibleStringCSVLexer();
  const tokens = lexer.lex(csv);

  const assembler = new FlexibleCSVRecordAssembler<['name', 'age', 'email']>();
  const records = assembler.assemble(tokens);

  for (const record of records) {
    yield recordSchema.parse(record);
  }
}

// Usage
try {
  for (const record of parseWithSchema(
    'name,age,email\r\nAlice,30,alice@example.com\r\n'
  )) {
    console.log(record); // { name: 'Alice', age: 30, email: 'alice@example.com' }
    // Note: age is number (coerced by Zod)
  }
} catch (error) {
  console.error('Validation error:', error);
}
```

---

## Data Transformation

### Type Conversion

```typescript
import { FlexibleStringCSVLexer, FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

function* parseWithTypes(csv: string) {
  const lexer = new FlexibleStringCSVLexer();
  const tokens = lexer.lex(csv);

  const assembler = new FlexibleCSVRecordAssembler<['name', 'age', 'active']>();
  const records = assembler.assemble(tokens);

  for (const record of records) {
    yield {
      name: record.name,
      age: Number(record.age),
      active: record.active === 'true',
    };
  }
}

// Usage
for (const record of parseWithTypes(
  'name,age,active\r\nAlice,30,true\r\n'
)) {
  console.log(record); // { name: 'Alice', age: 30, active: true }
  console.log(typeof record.age); // 'number'
  console.log(typeof record.active); // 'boolean'
}
```

---

### Field Mapping

```typescript
import { FlexibleStringCSVLexer, FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

function* parseWithMapping(
  csv: string,
  mapping: Record<string, string>
) {
  const lexer = new FlexibleStringCSVLexer();
  const tokens = lexer.lex(csv);

  const assembler = new FlexibleCSVRecordAssembler();
  const records = assembler.assemble(tokens);

  for (const record of records) {
    const mapped: Record<string, string | undefined> = {};
    for (const [oldKey, newKey] of Object.entries(mapping)) {
      mapped[newKey] = record[oldKey];
    }
    yield mapped;
  }
}

// Usage
for (const record of parseWithMapping(
  'first_name,last_name\r\nAlice,Smith\r\n',
  { first_name: 'firstName', last_name: 'lastName' }
)) {
  console.log(record); // { firstName: 'Alice', lastName: 'Smith' }
}
```

---

## Filtering Records

### Basic Filtering

```typescript
import { FlexibleStringCSVLexer, FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

function* parseWithFilter(
  csv: string,
  predicate: (record: any) => boolean
) {
  const lexer = new FlexibleStringCSVLexer();
  const tokens = lexer.lex(csv);

  const assembler = new FlexibleCSVRecordAssembler();
  const records = assembler.assemble(tokens);

  for (const record of records) {
    if (predicate(record)) {
      yield record;
    }
  }
}

// Usage: Filter adults only
for (const record of parseWithFilter(
  'name,age\r\nAlice,30\r\nBob,17\r\nCharlie,25\r\n',
  (record) => Number(record.age) >= 18
)) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
// { name: 'Charlie', age: '25' }
```

---

## Streaming Lexing and Assembly

### Stateful Parsing with Parser Models (Recommended)

Process CSV data in chunks using Parser Models:

```typescript
import { createStringCSVParser } from 'web-csv-toolbox';

const parser = createStringCSVParser({
  header: ['name', 'age'] as const,
});

// First chunk - incomplete record
const records1 = parser.parse('Alice,', { stream: true });
console.log(records1); // [] - waiting for complete record

// Second chunk - completes the record
const records2 = parser.parse('30\nBob,25\n', { stream: true });
console.log(records2);
// [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]

// Final chunk - flush remaining data
const records3 = parser.parse(); // Call without arguments to flush
console.log(records3); // []
```

**Benefits:**
- Simpler API - single parser instance maintains state
- Handles both lexing and assembly automatically
- Ideal for streaming file uploads or fetch responses

### Streaming with TransformStream

Use `StringCSVParserStream` for Web Streams API integration:

```typescript
import { createStringCSVParser, StringCSVParserStream } from 'web-csv-toolbox';

const parser = createStringCSVParser({
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

For binary data with character encoding:

```typescript
import { createBinaryCSVParser, BinaryCSVParserStream } from 'web-csv-toolbox';

const parser = createBinaryCSVParser({
  header: ['name', 'age'] as const,
  charset: 'utf-8',
  ignoreBOM: true,
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

### Low-Level: Chunked Lexing with stream Option

For advanced control, use Lexer + Assembler directly:

```typescript
import { FlexibleStringCSVLexer, FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

const lexer = new FlexibleStringCSVLexer();

// First chunk - incomplete quoted field
const chunk1 = '"Hello';
const tokens1 = [...lexer.lex(chunk1, { stream: true })];
console.log(tokens1); // [] - waiting for closing quote

// Second chunk - completes the field
const chunk2 = ' World",30\r\n';
const tokens2 = [...lexer.lex(chunk2, { stream: true })];
console.log(tokens2);
// [
//   { type: 'Field', value: 'Hello World' },
//   { type: 'FieldDelimiter', value: ',' },
//   { type: 'Field', value: '30' },
//   { type: 'RecordDelimiter', value: '\r\n' }
// ]

// Final chunk - flush remaining data
const tokens3 = [...lexer.lex()]; // Call without arguments to flush
```

### Low-Level: Combined Chunked Processing

```typescript
import { FlexibleStringCSVLexer, FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

async function* processChunks(chunks: string[]) {
  const lexer = new FlexibleStringCSVLexer();
  const assembler = new FlexibleCSVRecordAssembler();

  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;

    // Lex chunk
    const tokens = lexer.lex(chunks[i], { stream: !isLast });

    // Assemble records
    const records = assembler.assemble(tokens, { stream: !isLast });

    for (const record of records) {
      yield record;
    }
  }
}

// Usage
const chunks = [
  'name,age\r\n',
  'Alice,30\r\n',
  'Bob,25\r\n'
];

for await (const record of processChunks(chunks)) {
  console.log(record);
}
```

---

## Resource Limits and Security

### Set Buffer Size Limits

Protect against malicious CSV files with extremely large fields:

```typescript
import { FlexibleStringCSVLexer } from 'web-csv-toolbox';

const lexer = new FlexibleStringCSVLexer({
  maxBufferSize: 1024 * 1024 // 1MB limit per field
});

try {
  for (const token of lexer.lex(untrustedCSV)) {
    console.log(token);
  }
} catch (error) {
  if (error instanceof RangeError) {
    console.error('Buffer size exceeded - possible CSV bomb attack');
    console.error(error.message);
  }
}
```

### Set Field Count Limits

Prevent records with excessive field counts:

```typescript
import { FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

const assembler = new FlexibleCSVRecordAssembler({
  maxFieldCount: 10000 // Maximum 10,000 fields per record
});

try {
  for (const record of assembler.assemble(tokens)) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof RangeError) {
    console.error('Field count exceeded - possible DoS attack');
    console.error(error.message);
  }
}
```

### Combined Security Limits

```typescript
import { FlexibleStringCSVLexer, FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

function* secureParseCSV(csv: string) {
  // Lexer with buffer size limit
  const lexer = new FlexibleStringCSVLexer({
    maxBufferSize: 10 * 1024 * 1024 // 10MB per field
  });

  // Assembler with field count limit
  const assembler = new FlexibleCSVRecordAssembler({
    maxFieldCount: 1000 // 1000 fields per record
  });

  try {
    const tokens = lexer.lex(csv);
    const records = assembler.assemble(tokens);

    for (const record of records) {
      yield record;
    }
  } catch (error) {
    if (error instanceof RangeError) {
      console.error('Security limit exceeded:', error.message);
      throw new Error('CSV file exceeds security limits');
    }
    throw error;
  }
}

// Usage with user-uploaded file
try {
  for (const record of secureParseCSV(userUploadedCSV)) {
    console.log(record);
  }
} catch (error) {
  console.error('Failed to parse CSV:', error.message);
}
```

---

## Cancellation with AbortSignal

### Cancel Long-Running Operations

Use AbortSignal to allow user cancellation:

```typescript
import { FlexibleStringCSVLexer } from 'web-csv-toolbox';

function* parseWithCancellation(
  csv: string,
  signal?: AbortSignal
) {
  const lexer = new FlexibleStringCSVLexer({ signal });
  const assembler = new FlexibleCSVRecordAssembler();

  try {
    const tokens = lexer.lex(csv);
    const records = assembler.assemble(tokens);

    for (const record of records) {
      // Check if cancelled
      if (signal?.aborted) {
        throw new DOMException('Parsing cancelled', 'AbortError');
      }
      yield record;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.log('Parsing was cancelled by user');
      throw error;
    }
    throw error;
  }
}

// Usage with timeout
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000); // Cancel after 5 seconds

try {
  for (const record of parseWithCancellation(largeCSV, controller.signal)) {
    console.log(record);
  }
} catch (error) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    console.log('Parsing timed out');
  }
}
```

### Cancel Button Example

```typescript
import { FlexibleStringCSVLexer, FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

// HTML: <button id="cancel-btn">Cancel</button>

const cancelButton = document.getElementById('cancel-btn');
const controller = new AbortController();

cancelButton.addEventListener('click', () => {
  controller.abort();
  console.log('Cancellation requested');
});

async function parseWithUI(csv: string) {
  const lexer = new FlexibleStringCSVLexer({ signal: controller.signal });
  const assembler = new FlexibleCSVRecordAssembler();

  try {
    let count = 0;
    const tokens = lexer.lex(csv);
    const records = assembler.assemble(tokens);

    for (const record of records) {
      console.log(record);
      count++;

      // Update UI periodically
      if (count % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0)); // Yield to UI
      }
    }

    console.log(`Completed: ${count} records`);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.log('User cancelled parsing');
    } else {
      console.error('Parsing error:', error);
    }
  }
}
```

---

## Understanding Token Types

### Token Structure

CSVLexer produces three types of tokens:

#### Field Token
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

#### FieldDelimiter Token
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

#### RecordDelimiter Token
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

### Using Token Location

```typescript
import { FlexibleStringCSVLexer } from 'web-csv-toolbox';

function analyzeTokens(csv: string) {
  const lexer = new FlexibleStringCSVLexer();
  const tokens = [...lexer.lex(csv)];

  for (const token of tokens) {
    if (token.type === 'Field') {
      console.log(`Field "${token.value}" at line ${token.location.start.line}, column ${token.location.start.column}`);
    }
  }
}

analyzeTokens('name,age\r\nAlice,30\r\n');
// Field "name" at line 1, column 1
// Field "age" at line 1, column 6
// Field "Alice" at line 2, column 1
// Field "30" at line 2, column 7
```

---

## When to Use Low-Level APIs

### Use Low-Level APIs When:

- ✅ **Custom CSV dialects** - Non-standard delimiters, quote characters
- ✅ **Custom validation** - Field-level validation during parsing
- ✅ **Custom transformations** - Data normalization, type conversion
- ✅ **Syntax highlighting** - Building CSV editors or viewers
- ✅ **Performance profiling** - Understanding bottlenecks
- ✅ **Debugging parsing issues** - Inspecting token stream
- ✅ **Building higher-level abstractions** - Creating specialized parsers

### Use High-Level APIs When:

- ✅ **Standard CSV files** - RFC 4180 compliant
- ✅ **Quick prototyping** - Fast development
- ✅ **Production applications** - Most use cases
- ✅ **Remote CSV files** - Fetching from network
- ✅ **File uploads** - User-uploaded files
- ✅ **Simple data extraction** - No special processing needed

### Decision Matrix

| Requirement | Use High-Level | Use Low-Level |
|------------|---------------|--------------|
| Standard CSV format | ✅ | |
| Custom delimiter | | ✅ |
| Custom validation | | ✅ |
| File upload handling | ✅ | |
| Syntax highlighting | | ✅ |
| Real-time streaming | ✅ | |
| Token inspection | | ✅ |
| Production app | ✅ | |
| Learning library | ✅ | |

---

## CSV Parser Stream Factory Functions

> **New in v0.14.0+**: Factory functions for creating CSV parser streams with simplified API.

### Using Parser Stream Factory Functions (Recommended)

The simplest way to stream CSV parsing - handles all internal component creation:

```typescript
import {
  createStringCSVParserStream,
  createBinaryCSVParserStream
} from 'web-csv-toolbox';

// String stream → CSV records (use with TextDecoderStream)
await fetch('data.csv')
  .then(res => res.body)
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(createStringCSVParserStream())
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record); // { name: 'Alice', age: '30' }
    }
  }));

// Binary stream → CSV records (no TextDecoderStream needed!)
await fetch('data.csv')
  .then(res => res.body)
  .pipeThrough(createBinaryCSVParserStream())
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record); // { name: 'Alice', age: '30' }
    }
  }));
```

### Parser Stream with Options

```typescript
import {
  createStringCSVParserStream,
  createBinaryCSVParserStream
} from 'web-csv-toolbox';

// With predefined header (data has no header row)
const stringStream = createStringCSVParserStream({
  header: ['name', 'age'] as const,
  delimiter: '\t'  // TSV
});

// Binary with charset encoding
const binaryStream = createBinaryCSVParserStream({
  header: ['name', 'age'] as const,
  charset: 'shift-jis',
  ignoreBOM: true
});

// Array output format
const arrayStream = createStringCSVParserStream({
  outputFormat: 'array'
});
```

---

## Stream Transformer Factory Functions

### Using Factory Functions (Recommended)

For lower-level control, use transformer factory functions:

```typescript
import {
  createCSVLexerTransformer,
  createCSVRecordAssemblerTransformer
} from 'web-csv-toolbox';

// Simple streaming pipeline
const csvStream = new ReadableStream({
  start(controller) {
    controller.enqueue('name,age\r\n');
    controller.enqueue('Alice,30\r\n');
    controller.enqueue('Bob,25\r\n');
    controller.close();
  }
});

csvStream
  .pipeThrough(createCSVLexerTransformer())
  .pipeThrough(createCSVRecordAssemblerTransformer())
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record);
    }
  }));
// { name: 'Alice', age: '30' }
// { name: 'Bob', age: '25' }
```

### Factory Function with Custom Options

```typescript
import {
  createCSVLexerTransformer,
  createCSVRecordAssemblerTransformer
} from 'web-csv-toolbox';

// TSV with predefined header
const tsvStream = new ReadableStream({
  start(controller) {
    controller.enqueue('Alice\t30\r\n');
    controller.enqueue('Bob\t25\r\n');
    controller.close();
  }
});

tsvStream
  .pipeThrough(createCSVLexerTransformer({ delimiter: '\t' }))
  .pipeThrough(createCSVRecordAssemblerTransformer({
    header: ['name', 'age'] as const
  }))
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record);
    }
  }));
// { name: 'Alice', age: '30' }
// { name: 'Bob', age: '25' }
```

### Factory Functions with Backpressure Tuning

```typescript
import {
  createCSVLexerTransformer,
  createCSVRecordAssemblerTransformer
} from 'web-csv-toolbox';

// With custom stream options and queuing strategies
const lexerTransformer = createCSVLexerTransformer(
  { delimiter: ',' },
  { backpressureCheckInterval: 50 },
  { highWaterMark: 131072, size: (chunk) => chunk.length },
  new CountQueuingStrategy({ highWaterMark: 2048 })
);

const assemblerTransformer = createCSVRecordAssemblerTransformer(
  {},
  { backpressureCheckInterval: 20 },
  new CountQueuingStrategy({ highWaterMark: 2048 }),
  new CountQueuingStrategy({ highWaterMark: 512 })
);

await fetch('large-file.csv')
  .then(res => res.body)
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(lexerTransformer)
  .pipeThrough(assemblerTransformer)
  .pipeTo(yourProcessor);
```

### Direct Instantiation (Advanced)

For advanced use cases where you need direct access to lexer/assembler instances:

```typescript
import {
  createStringCSVLexer,
  createCSVRecordAssembler,
  CSVLexerTransformer,
  CSVRecordAssemblerTransformer
} from 'web-csv-toolbox';

// Create components separately for direct access
const lexer = createStringCSVLexer({ delimiter: ',' });
const assembler = createCSVRecordAssembler({ header: ['name', 'age'] as const });

// Create transformers with existing components
const lexerTransformer = new CSVLexerTransformer(lexer);
const assemblerTransformer = new CSVRecordAssemblerTransformer(assembler);

csvStream
  .pipeThrough(lexerTransformer)
  .pipeThrough(assemblerTransformer)
  .pipeTo(yourProcessor);

// Access the internal lexer/assembler if needed
console.log(lexerTransformer.lexer);
console.log(assemblerTransformer.assembler);
```

---

## Streaming Parsers

### Streaming with TransformStream

```typescript
import {
  createCSVLexerTransformer,
  createCSVRecordAssemblerTransformer
} from 'web-csv-toolbox';

// Custom validation transform
class ValidationTransform extends TransformStream {
  constructor() {
    super({
      transform(record, controller) {
        try {
          // Validate record
          if (record.name && Number(record.age) >= 0) {
            controller.enqueue(record);
          } else {
            console.error('Invalid record:', record);
          }
        } catch (error) {
          console.error('Validation error:', error);
        }
      }
    });
  }
}

// Usage
const csvStream = new ReadableStream({
  start(controller) {
    controller.enqueue('name,age\r\n');
    controller.enqueue('Alice,30\r\n');
    controller.enqueue('Bob,invalid\r\n'); // Invalid
    controller.enqueue('Charlie,25\r\n');
    controller.close();
  }
});

csvStream
  .pipeThrough(createCSVLexerTransformer())
  .pipeThrough(createCSVRecordAssemblerTransformer())
  .pipeThrough(new ValidationTransform())
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record);
    }
  }));
// { name: 'Alice', age: '30' }
// { name: 'Charlie', age: '25' }
```

---

### Custom Type Conversion Transform

```typescript
import {
  createCSVLexerTransformer,
  createCSVRecordAssemblerTransformer
} from 'web-csv-toolbox';

class TypeConversionTransform extends TransformStream {
  constructor() {
    super({
      transform(record, controller) {
        controller.enqueue({
          name: record.name,
          age: Number(record.age),
          active: record.active === 'true',
        });
      }
    });
  }
}

// Usage
csvStream
  .pipeThrough(createCSVLexerTransformer())
  .pipeThrough(createCSVRecordAssemblerTransformer())
  .pipeThrough(new TypeConversionTransform())
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record);
      console.log(typeof record.age); // 'number'
    }
  }));
```

---

## Advanced: Syntax Highlighting

```typescript
import { FlexibleStringCSVLexer } from 'web-csv-toolbox';

function highlightCSV(csv: string): string {
  const lexer = new FlexibleStringCSVLexer();
  const tokens = lexer.lex(csv);
  let html = '<pre class="csv-highlight">';

  for (const token of tokens) {
    switch (token.type) {
      case 'Field':
        html += `<span class="field">${escapeHTML(token.value)}</span>`;
        break;
      case 'FieldDelimiter':
        html += `<span class="delimiter">${escapeHTML(token.value)}</span>`;
        break;
      case 'RecordDelimiter':
        html += '\n';
        break;
    }
  }

  html += '</pre>';
  return html;
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// CSS
const css = `
.csv-highlight .field { color: #0066cc; }
.csv-highlight .delimiter { color: #999; font-weight: bold; }
`;

// Usage
const highlighted = highlightCSV('name,age\r\nAlice,30\r\n');
console.log(highlighted);
```

---

## Advanced: Progress Tracking

```typescript
import { FlexibleStringCSVLexer, FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

function* parseWithProgress(
  csv: string,
  onProgress: (progress: { records: number; tokens: number }) => void
) {
  const lexer = new FlexibleStringCSVLexer();
  const tokens = [...lexer.lex(csv)];
  const totalTokens = tokens.length;

  const assembler = new FlexibleCSVRecordAssembler();
  const records = assembler.assemble(tokens);

  let recordCount = 0;
  for (const record of records) {
    recordCount++;
    onProgress({ records: recordCount, tokens: totalTokens });
    yield record;
  }
}

// Usage
for (const record of parseWithProgress(
  'name,age\r\nAlice,30\r\nBob,25\r\n',
  (progress) => {
    console.log(`Processed ${progress.records} records (${progress.tokens} tokens)`);
  }
)) {
  console.log(record);
}
```

---

## Advanced: Error Recovery

```typescript
import { FlexibleStringCSVLexer, FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

function* parseWithErrorRecovery(csv: string) {
  const lexer = new FlexibleStringCSVLexer();
  const assembler = new FlexibleCSVRecordAssembler();

  try {
    const tokens = lexer.lex(csv);
    const records = assembler.assemble(tokens);

    for (const record of records) {
      yield { success: true, record };
    }
  } catch (error) {
    yield {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Usage
for (const result of parseWithErrorRecovery(
  'name,age\r\nAlice,30\r\n"Unclosed quote\r\n'
)) {
  if (result.success) {
    console.log('Record:', result.record);
  } else {
    console.error('Error:', result.error);
  }
}
```

---

## Advanced: CSV Validator

```typescript
import { FlexibleStringCSVLexer, FlexibleCSVRecordAssembler } from 'web-csv-toolbox';

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateCSV(csv: string): ValidationResult {
  const errors: string[] = [];

  try {
    const lexer = new FlexibleStringCSVLexer();
    const tokens = [...lexer.lex(csv)];

    const assembler = new FlexibleCSVRecordAssembler();
    const records = [...assembler.assemble(tokens)];

    // Check field count consistency
    let fieldCount: number | null = null;
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const currentFieldCount = Object.keys(record).length;

      if (fieldCount === null) {
        fieldCount = currentFieldCount;
      } else if (currentFieldCount !== fieldCount) {
        errors.push(
          `Row ${i + 2}: Expected ${fieldCount} fields, got ${currentFieldCount}`
        );
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Usage
const result = validateCSV('name,age\r\nAlice,30\r\nBob\r\n');
console.log(result);
// { valid: false, errors: ['Row 3: Expected 2 fields, got 1'] }
```

---

## Best Practices

### ✅ Do

- Use generators (`function*`) for memory-efficient iteration
- Handle errors gracefully with try-catch
- Validate data before using it
- Use TransformStream for streaming pipelines
- Set appropriate resource limits (`maxBufferSize`, `maxFieldCount`)
- Use AbortSignal for cancelable operations

### ❌ Don't

- Don't store all records in memory (use generators)
- Don't ignore parsing errors
- Don't remove security limits
- Don't parse untrusted CSV without validation
- Don't use low-level APIs when high-level APIs suffice

---

## Performance Tips

1. **Use streaming**: Process records one at a time instead of loading all into memory
2. **Early filtering**: Filter records as early as possible to reduce memory usage
3. **Lazy evaluation**: Use generators to defer computation
4. **Minimize allocations**: Reuse objects where possible
5. **Set limits**: Use `maxBufferSize` and `maxFieldCount` to prevent runaway memory usage

---

## Related Documentation

- **[CSVLexer API Reference](https://kamiazya.github.io/web-csv-toolbox/classes/CSVLexer.html)** - Detailed CSVLexer documentation
- **[CSVRecordAssembler API Reference](https://kamiazya.github.io/web-csv-toolbox/classes/CSVRecordAssembler.html)** - Detailed CSVRecordAssembler documentation
- **[CSVLexerTransformer API Reference](https://kamiazya.github.io/web-csv-toolbox/classes/CSVLexerTransformer.html)** - Streaming lexer
- **[CSVRecordAssemblerTransformer API Reference](https://kamiazya.github.io/web-csv-toolbox/classes/CSVRecordAssemblerTransformer.html)** - Streaming assembler
- **[Parsing Architecture](../explanation/parsing-architecture.md)** - Understanding the pipeline
- **[Getting Started](../tutorials/getting-started.md)** - High-level API tutorial

---

## Summary

You've learned how to:

- ✅ Build custom CSV parsers using low-level APIs
- ✅ Handle custom delimiters and headers
- ✅ Validate and transform data
- ✅ Filter records
- ✅ Build streaming parsers with TransformStream
- ✅ Create specialized tools (syntax highlighting, validation)

For production CSV parsing, use the high-level APIs: [parse()](../tutorials/getting-started.md), [parseString()](../tutorials/getting-started.md)
