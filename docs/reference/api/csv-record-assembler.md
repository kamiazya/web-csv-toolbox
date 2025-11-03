# CSVRecordAssembler API Reference

The **CSVRecordAssembler** class converts tokens from the [CSVLexer](./csv-lexer.md) into structured CSV records (JavaScript objects). This is the second stage of web-csv-toolbox's two-stage parsing pipeline.

## Overview

```typescript
import { CSVLexer, CSVRecordAssembler } from 'web-csv-toolbox';

const lexer = new CSVLexer();
const assembler = new CSVRecordAssembler();

const tokens = lexer.lex('name,age\r\nAlice,30\r\n');
const records = assembler.assemble(tokens);

for (const record of records) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
```

## Constructor

```typescript
new CSVRecordAssembler<Header>(options?: CSVRecordAssemblerOptions)
```

### Type Parameters

- `Header extends ReadonlyArray<string>` - Header field names type

**Example:**
```typescript
// Inferred header
const assembler = new CSVRecordAssembler();

// Explicit header type
const assembler = new CSVRecordAssembler<['name', 'age']>();
```

### Options

```typescript
interface CSVRecordAssemblerOptions<Header> {
  header?: Header;
  maxFieldCount?: number;
  skipEmptyLines?: boolean;
  signal?: AbortSignal;
}
```

#### `header`

**Type:** `Header extends ReadonlyArray<string>`
**Default:** `undefined` (extract from first record)

Pre-defined header fields.

**Example:**
```typescript
// Extract header from CSV data
const assembler = new CSVRecordAssembler();
const records = assembler.assemble(tokens);
// First record becomes header

// Pre-define header
const assembler = new CSVRecordAssembler({
  header: ['name', 'age']
});
const records = assembler.assemble(tokens);
// All records treated as data
```

**When to use:**
- ✅ CSV has no header row
- ✅ Custom field names needed
- ❌ CSV already has header row (use automatic extraction)

---

#### `maxFieldCount`

**Type:** `number`
**Default:** `100000` (100k fields)

Maximum number of fields allowed per record.

**Why it matters:**
- Prevents DoS attacks (CSV bombs with millions of fields)
- Protects against memory exhaustion
- Early rejection of malicious input

**Example:**
```typescript
const assembler = new CSVRecordAssembler({
  maxFieldCount: 1000 // Limit to 1000 fields
});

try {
  // CSV with 2000 fields
  const records = assembler.assemble(tokens);
} catch (error) {
  if (error instanceof RangeError) {
    console.error('Too many fields');
  }
}
```

**When to adjust:**
- ✅ Increase for legitimate wide CSV files (e.g., 200+ columns)
- ❌ Don't set to `Number.POSITIVE_INFINITY` (DoS vulnerability)

---

#### `skipEmptyLines`

**Type:** `boolean`
**Default:** `false`

When `true`, completely empty lines (with only delimiters or whitespace) will be skipped during parsing.

**Example:**
```typescript
const csv = 'name,age\r\nAlice,30\r\n\r\nBob,25\r\n';

// Without skipEmptyLines (default)
const assembler1 = new CSVRecordAssembler();
const records1 = [...assembler1.assemble(lexer.lex(csv))];
// [{ name: 'Alice', age: '30' }, { name: '', age: '' }, { name: 'Bob', age: '25' }]

// With skipEmptyLines
const assembler2 = new CSVRecordAssembler({ skipEmptyLines: true });
const records2 = [...assembler2.assemble(lexer.lex(csv))];
// [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }]
```

**When to use:**
- ✅ CSV files with blank lines between records
- ✅ Cleaning up poorly formatted CSV data
- ❌ When empty records have semantic meaning

---

#### `signal`

**Type:** `AbortSignal`
**Default:** `undefined`

AbortSignal for canceling assembly operations.

**Example:**
```typescript
const controller = new AbortController();
const assembler = new CSVRecordAssembler({ signal: controller.signal });

setTimeout(() => controller.abort(), 5000);

try {
  for (const record of assembler.assemble(tokens)) {
    console.log(record);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Assembly was aborted');
  }
}
```

---

## Methods

### `assemble()`

Converts tokens into CSV records.

```typescript
assemble(
  tokens: Iterable<Token>,
  flush?: boolean
): IterableIterator<CSVRecord<Header>>
```

#### Parameters

##### `tokens`

**Type:** `Iterable<Token>`

Tokens from the Lexer.

##### `flush`

**Type:** `boolean`
**Default:** `true`

Whether to flush incomplete records.

- `true`: Emit final incomplete record (if any)
- `false`: Buffer incomplete record for next call

#### Returns

`IterableIterator<CSVRecord<Header>>` - Iterator of CSV records

#### Example: Basic Usage

```typescript
const lexer = new CSVLexer();
const assembler = new CSVRecordAssembler();

const tokens = lexer.lex('name,age\r\nAlice,30\r\nBob,25\r\n');
const records = assembler.assemble(tokens);

for (const record of records) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
// { name: 'Bob', age: '25' }
```

#### Example: Streaming with Buffering

```typescript
const lexer = new CSVLexer();
const assembler = new CSVRecordAssembler();

// First chunk
const tokens1 = lexer.lex('name,age\r\nAlice,', true); // Incomplete record
const records1 = assembler.assemble(tokens1, false); // flush=false
console.log([...records1]); // [] - buffering incomplete record

// Second chunk
const tokens2 = lexer.lex('30\r\n', true);
const records2 = assembler.assemble(tokens2, false);
console.log([...records2]); // [{ name: 'Alice', age: '30' }]

// Final flush
const tokens3 = lexer.flush();
const records3 = assembler.assemble(tokens3, true); // flush=true
console.log([...records3]); // []
```

---

### `flush()`

Flushes any incomplete record.

```typescript
flush(): Generator<CSVRecord<Header>>
```

#### Returns

`Generator<CSVRecord<Header>>` - Generator of remaining records

#### Example

```typescript
const assembler = new CSVRecordAssembler();

// Partial record
assembler.assemble(tokens, false); // flush=false, returns nothing

// Force flush
const records = [...assembler.flush()];
console.log(records); // [{ name: 'Alice', age: '30' }]
```

**When to use:**
- End of streaming data (alternative to `assemble(tokens, true)`)
- Manual control over record emission

---

## Record Structure

Records are returned as JavaScript objects with header fields as keys.

### With Header Row

```typescript
// CSV: name,age\r\nAlice,30\r\n
const assembler = new CSVRecordAssembler();
const records = assembler.assemble(tokens);

// First record: { name: 'Alice', age: '30' }
```

### With Pre-defined Header

```typescript
// CSV: Alice,30\r\n
const assembler = new CSVRecordAssembler({
  header: ['name', 'age']
});
const records = assembler.assemble(tokens);

// First record: { name: 'Alice', age: '30' }
```

### Missing Fields

```typescript
// CSV: name,age\r\nAlice\r\n
const assembler = new CSVRecordAssembler();
const records = assembler.assemble(tokens);

// First record: { name: 'Alice', age: undefined }
```

**Note:** Missing fields are `undefined`, not empty strings.

### Extra Fields

```typescript
// CSV: name,age\r\nAlice,30,Boston\r\n
const assembler = new CSVRecordAssembler();
const records = assembler.assemble(tokens);

// First record: { name: 'Alice', age: '30' }
// 'Boston' is ignored (no header field)
```

---

## Error Handling

### ParseError: Empty Header

```typescript
const assembler = new CSVRecordAssembler({ header: [] });

try {
  const records = assembler.assemble(tokens);
} catch (error) {
  if (error.name === 'ParseError') {
    console.error(error.message);
    // "The header must not be empty."
  }
}
```

---

### ParseError: Duplicate Header Fields

```typescript
const lexer = new CSVLexer();
const assembler = new CSVRecordAssembler();

// CSV with duplicate headers
const tokens = lexer.lex('name,age,name\r\nAlice,30,Bob\r\n');

try {
  const records = [...assembler.assemble(tokens)];
} catch (error) {
  if (error.name === 'ParseError') {
    console.error(error.message);
    // "The header must not contain duplicate fields."
  }
}
```

---

### RangeError: Field Count Exceeded

```typescript
const assembler = new CSVRecordAssembler({ maxFieldCount: 10 });

// Generate tokens for 20 fields
const tokens = generateManyFieldTokens(20);

try {
  const records = [...assembler.assemble(tokens)];
} catch (error) {
  if (error instanceof RangeError) {
    console.error(error.message);
    // "Field count (20) exceeded maximum allowed count of 10"
  }
}
```

---

### AbortError

```typescript
const controller = new AbortController();
const assembler = new CSVRecordAssembler({ signal: controller.signal });

setTimeout(() => controller.abort(), 100);

try {
  for (const record of assembler.assemble(largeTokenStream)) {
    console.log(record);
  }
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Assembly was aborted');
  }
}
```

---

## Usage Patterns

### Pattern 1: Automatic Header Extraction

```typescript
const lexer = new CSVLexer();
const assembler = new CSVRecordAssembler();

const tokens = lexer.lex('name,age\r\nAlice,30\r\n');
const records = assembler.assemble(tokens);

for (const record of records) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
```

**Use case:** CSV with header row

---

### Pattern 2: Pre-defined Header

```typescript
const lexer = new CSVLexer();
const assembler = new CSVRecordAssembler({
  header: ['name', 'age']
});

const tokens = lexer.lex('Alice,30\r\n');
const records = assembler.assemble(tokens);

for (const record of records) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
```

**Use case:** CSV without header row

---

### Pattern 3: Streaming Assembly

```typescript
const lexer = new CSVLexer();
const assembler = new CSVRecordAssembler();

const chunks = ['name,age\r\n', 'Alice,30\r\n', 'Bob,25\r\n'];

for (const chunk of chunks) {
  const tokens = lexer.lex(chunk, true); // buffering=true
  const records = assembler.assemble(tokens, false); // flush=false

  for (const record of records) {
    console.log(record);
  }
}

// Don't forget to flush!
const finalTokens = lexer.flush();
const finalRecords = assembler.assemble(finalTokens, true);
for (const record of finalRecords) {
  console.log(record);
}
```

**Use case:** Large files, network streams

---

### Pattern 4: Type-Safe Headers

```typescript
const assembler = new CSVRecordAssembler<['name', 'age']>();

const tokens = lexer.lex('name,age\r\nAlice,30\r\n');
const records = assembler.assemble(tokens);

for (const record of records) {
  // TypeScript knows: record.name and record.age exist
  console.log(record.name); // ✅ Type-safe
  console.log(record.city); // ❌ TypeScript error
}
```

**Use case:** TypeScript projects with known schema

---

### Pattern 5: With AbortSignal

```typescript
const controller = new AbortController();
const assembler = new CSVRecordAssembler({ signal: controller.signal });

// Abort after 5 seconds
const timeout = setTimeout(() => controller.abort(), 5000);

try {
  for (const record of assembler.assemble(tokens)) {
    console.log(record);
  }
  clearTimeout(timeout);
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Assembly was canceled');
  }
}
```

**Use case:** User-cancelable operations, timeout protection

---

## Performance Characteristics

### Memory Usage

**O(1)** - Constant memory usage

- Only stores current record being assembled
- Records are yielded incrementally (not stored)
- Memory usage independent of file size

### Processing Speed

**O(n)** - Linear time complexity

- Single pass through tokens
- Minimal object allocation overhead
- Fast field mapping

---

## Integration Example

### Complete Parsing Pipeline

```typescript
import { CSVLexer, CSVRecordAssembler } from 'web-csv-toolbox';

function parseCSV(csv: string) {
  const lexer = new CSVLexer();
  const assembler = new CSVRecordAssembler();

  const tokens = lexer.lex(csv);
  const records = assembler.assemble(tokens);

  return records;
}

for (const record of parseCSV('name,age\r\nAlice,30\r\n')) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
```

**Note:** For production use, prefer high-level APIs like `parse()` or `parseString()`.

---

## Related APIs

- **[CSVLexer](./csv-lexer.md)** - Converts CSV text to tokens
- **[CSVRecordAssemblerTransformer](./csv-record-assembler-transformer.md)** - TransformStream wrapper
- **[Parsing Architecture](../../explanation/parsing-architecture.md)** - Understanding the pipeline

---

## Examples

### Example 1: Data Validation

```typescript
import { CSVLexer, CSVRecordAssembler } from 'web-csv-toolbox';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  age: z.coerce.number().int().min(0).max(150)
});

function validateCSV(csv: string) {
  const lexer = new CSVLexer();
  const assembler = new CSVRecordAssembler<['name', 'age']>();

  const tokens = lexer.lex(csv);
  const records = assembler.assemble(tokens);

  const validRecords = [];
  const errors = [];

  for (const record of records) {
    try {
      validRecords.push(schema.parse(record));
    } catch (error) {
      errors.push({ record, error });
    }
  }

  return { validRecords, errors };
}

const result = validateCSV('name,age\r\nAlice,30\r\nBob,invalid\r\n');
console.log(result.validRecords); // [{ name: 'Alice', age: 30 }]
console.log(result.errors.length); // 1
```

---

### Example 2: Field Mapping

```typescript
import { CSVLexer, CSVRecordAssembler } from 'web-csv-toolbox';

function mapFields(csv: string, mapping: Record<string, string>) {
  const lexer = new CSVLexer();
  const assembler = new CSVRecordAssembler();

  const tokens = lexer.lex(csv);
  const records = assembler.assemble(tokens);

  return Array.from(records).map(record => {
    const mapped: Record<string, string | undefined> = {};
    for (const [oldKey, newKey] of Object.entries(mapping)) {
      mapped[newKey] = record[oldKey];
    }
    return mapped;
  });
}

const result = mapFields(
  'first_name,last_name\r\nAlice,Smith\r\n',
  { first_name: 'firstName', last_name: 'lastName' }
);

console.log(result);
// [{ firstName: 'Alice', lastName: 'Smith' }]
```

---

### Example 3: Row Filtering

```typescript
import { CSVLexer, CSVRecordAssembler } from 'web-csv-toolbox';

function filterRecords(
  csv: string,
  predicate: (record: Record<string, string | undefined>) => boolean
) {
  const lexer = new CSVLexer();
  const assembler = new CSVRecordAssembler();

  const tokens = lexer.lex(csv);
  const records = assembler.assemble(tokens);

  return Array.from(records).filter(predicate);
}

const adults = filterRecords(
  'name,age\r\nAlice,30\r\nBob,17\r\nCharlie,25\r\n',
  (record) => Number(record.age) >= 18
);

console.log(adults);
// [{ name: 'Alice', age: '30' }, { name: 'Charlie', age: '25' }]
```

---

## Best Practices

### ✅ Do

- Use `flush: false` when processing streaming data
- Always call `flush()` at the end of streaming
- Set appropriate `maxFieldCount` for your use case
- Use `AbortSignal` for long-running operations
- Validate data with schema libraries (Zod, Yup, etc.)
- Handle `ParseError` and `RangeError` gracefully

### ❌ Don't

- Don't store all records in memory (defeats streaming purpose)
- Don't remove `maxFieldCount` limit (DoS vulnerability)
- Don't ignore errors (silent failures are bad UX)
- Don't use CSVRecordAssembler directly for production (use high-level APIs)

---

## When to Use CSVRecordAssembler Directly

**✅ Use CSVRecordAssembler when:**
- Building custom CSV processing tools
- Implementing custom validation logic
- Debugging parsing issues
- Creating non-standard record formats
- Performance profiling assembly stage

**❌ Use high-level APIs when:**
- Parsing standard CSV files
- Production applications
- Simple data extraction

See: [parse()](../../tutorials/getting-started.md), [parseString()](../../tutorials/getting-started.md)

---

## Browser and Runtime Support

CSVRecordAssembler works across all supported runtimes:

- ✅ Node.js LTS
- ✅ Deno LTS
- ✅ Modern browsers (Chrome, Firefox, Edge, Safari)

See: [Supported Environments](../supported-environments.md)

---

## TypeScript Types

```typescript
import type { CSVRecord, CSVRecordAssemblerOptions } from 'web-csv-toolbox';

// CSVRecord type (inferred from header)
type CSVRecord<Header extends ReadonlyArray<string>> = {
  [K in Header[number]]: string | undefined;
};

// Example usage
type MyHeader = ['name', 'age'];
type MyRecord = CSVRecord<MyHeader>;
// { name: string | undefined; age: string | undefined; }

interface CSVRecordAssemblerOptions<Header> {
  header?: Header;
  maxFieldCount?: number;
  signal?: AbortSignal;
}
```
