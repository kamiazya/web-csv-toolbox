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

## Understanding the Two-Stage Pipeline

web-csv-toolbox uses a two-stage parsing architecture:

```
CSV String → Lexer → Tokens → RecordAssembler → Records
```

- **Stage 1 (Lexer)**: Converts raw CSV text into tokens
- **Stage 2 (RecordAssembler)**: Converts tokens into structured records

See: [Parsing Architecture](../explanation/parsing-architecture.md)

---

## Basic Custom Parser

### Step 1: Create a Simple Parser

```typescript
import { Lexer, RecordAssembler } from 'web-csv-toolbox';

function parseCSV(csv: string) {
  // Stage 1: Tokenization
  const lexer = new Lexer();
  const tokens = lexer.lex(csv);

  // Stage 2: Record assembly
  const assembler = new RecordAssembler();
  const records = assembler.assemble(tokens);

  return records;
}

// Usage
for (const record of parseCSV('name,age\r\nAlice,30\r\n')) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
```

---

## Custom Delimiters

### Tab-Separated Values (TSV)

```typescript
import { Lexer, RecordAssembler } from 'web-csv-toolbox';

function parseTSV(tsv: string) {
  const lexer = new Lexer({ delimiter: '\t' });
  const tokens = lexer.lex(tsv);

  const assembler = new RecordAssembler();
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

```typescript
import { Lexer, RecordAssembler } from 'web-csv-toolbox';

function parsePSV(psv: string) {
  const lexer = new Lexer({ delimiter: '|' });
  const tokens = lexer.lex(psv);

  const assembler = new RecordAssembler();
  const records = assembler.assemble(tokens);

  return records;
}

// Usage
for (const record of parsePSV('name|age\r\nAlice|30\r\n')) {
  console.log(record);
}
// { name: 'Alice', age: '30' }
```

---

## Custom Headers

### Skip Header Row

```typescript
import { Lexer, RecordAssembler } from 'web-csv-toolbox';

function parseWithCustomHeader(csv: string, header: string[]) {
  const lexer = new Lexer();
  const tokens = lexer.lex(csv);

  // Pre-define header (skips first row)
  const assembler = new RecordAssembler({ header });
  const records = assembler.assemble(tokens);

  return records;
}

// Usage (CSV has header, but we use custom field names)
for (const record of parseWithCustomHeader(
  'first_name,last_name\r\nAlice,Smith\r\n',
  ['firstName', 'lastName']
)) {
  console.log(record);
}
// { firstName: 'first_name', lastName: 'last_name' } // First data row (header ignored)
// { firstName: 'Alice', lastName: 'Smith' }
```

---

### No Header Row

```typescript
import { Lexer, RecordAssembler } from 'web-csv-toolbox';

function parseHeaderless(csv: string, header: string[]) {
  const lexer = new Lexer();
  const tokens = lexer.lex(csv);

  const assembler = new RecordAssembler({ header });
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

## Data Validation

### Field-Level Validation

```typescript
import { Lexer, RecordAssembler } from 'web-csv-toolbox';

function* parseWithValidation(csv: string) {
  const lexer = new Lexer();
  const tokens = lexer.lex(csv);

  const assembler = new RecordAssembler<['name', 'age', 'email']>();
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
import { Lexer, RecordAssembler } from 'web-csv-toolbox';
import { z } from 'zod';

const recordSchema = z.object({
  name: z.string().min(1).max(100),
  age: z.coerce.number().int().min(0).max(150),
  email: z.string().email(),
});

function* parseWithSchema(csv: string) {
  const lexer = new Lexer();
  const tokens = lexer.lex(csv);

  const assembler = new RecordAssembler<['name', 'age', 'email']>();
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
import { Lexer, RecordAssembler } from 'web-csv-toolbox';

function* parseWithTypes(csv: string) {
  const lexer = new Lexer();
  const tokens = lexer.lex(csv);

  const assembler = new RecordAssembler<['name', 'age', 'active']>();
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
import { Lexer, RecordAssembler } from 'web-csv-toolbox';

function* parseWithMapping(
  csv: string,
  mapping: Record<string, string>
) {
  const lexer = new Lexer();
  const tokens = lexer.lex(csv);

  const assembler = new RecordAssembler();
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
import { Lexer, RecordAssembler } from 'web-csv-toolbox';

function* parseWithFilter(
  csv: string,
  predicate: (record: any) => boolean
) {
  const lexer = new Lexer();
  const tokens = lexer.lex(csv);

  const assembler = new RecordAssembler();
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

## Streaming Parsers

### Streaming with TransformStream

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

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
  .pipeThrough(new LexerTransformer())
  .pipeThrough(new RecordAssemblerTransformer())
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
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

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
  .pipeThrough(new LexerTransformer())
  .pipeThrough(new RecordAssemblerTransformer())
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
import { Lexer } from 'web-csv-toolbox';

function highlightCSV(csv: string): string {
  const lexer = new Lexer();
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
import { Lexer, RecordAssembler } from 'web-csv-toolbox';

function* parseWithProgress(
  csv: string,
  onProgress: (progress: { records: number; tokens: number }) => void
) {
  const lexer = new Lexer();
  const tokens = [...lexer.lex(csv)];
  const totalTokens = tokens.length;

  const assembler = new RecordAssembler();
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
import { Lexer, RecordAssembler } from 'web-csv-toolbox';

function* parseWithErrorRecovery(csv: string) {
  const lexer = new Lexer();
  const assembler = new RecordAssembler();

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
import { Lexer, RecordAssembler } from 'web-csv-toolbox';

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateCSV(csv: string): ValidationResult {
  const errors: string[] = [];

  try {
    const lexer = new Lexer();
    const tokens = [...lexer.lex(csv)];

    const assembler = new RecordAssembler();
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

- **[Lexer API Reference](../reference/api/lexer.md)** - Detailed Lexer documentation
- **[RecordAssembler API Reference](../reference/api/record-assembler.md)** - Detailed RecordAssembler documentation
- **[LexerTransformer API Reference](../reference/api/lexer-transformer.md)** - Streaming lexer
- **[RecordAssemblerTransformer API Reference](../reference/api/record-assembler-transformer.md)** - Streaming assembler
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
