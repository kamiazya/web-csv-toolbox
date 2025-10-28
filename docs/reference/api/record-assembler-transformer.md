# RecordAssemblerTransformer API Reference

The **RecordAssemblerTransformer** class is a TransformStream that wraps the [RecordAssembler](./record-assembler.md) for use in streaming pipelines. It converts a stream of token arrays into a stream of CSV records (JavaScript objects).

## Overview

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

const csvStream = new ReadableStream({
  start(controller) {
    controller.enqueue('name,age\r\n');
    controller.enqueue('Alice,30\r\n');
    controller.close();
  }
});

csvStream
  .pipeThrough(new LexerTransformer())
  .pipeThrough(new RecordAssemblerTransformer())
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record);
    }
  }));
// { name: 'Alice', age: '30' }
```

## Constructor

```typescript
new RecordAssemblerTransformer<Header>(options?: RecordAssemblerOptions)
```

### Type Parameters

- `Header extends ReadonlyArray<string>` - Header field names type

### Options

```typescript
interface RecordAssemblerOptions<Header> {
  header?: Header;
  maxFieldCount?: number;
  signal?: AbortSignal;
}
```

All options are the same as [RecordAssembler options](./record-assembler.md#options).

---

## Properties

### `assembler`

**Type:** `RecordAssembler<Header>`
**Read-only:** Yes

Access to the underlying RecordAssembler instance.

**Example:**
```typescript
const transformer = new RecordAssemblerTransformer();
console.log(transformer.assembler); // RecordAssembler instance
```

**Use case:** Advanced debugging, accessing internal state

---

## Stream Behavior

### Input

**Type:** `ReadableStream<Token[]>`

A stream of token arrays (typically from [LexerTransformer](./lexer-transformer.md)).

### Output

**Type:** `ReadableStream<CSVRecord<Header>>`

A stream of CSV record objects.

**Notes:**
- First record (if no `header` option) is used as header row
- Records are emitted incrementally
- Memory usage is constant (O(1))

---

## Usage Patterns

### Pattern 1: Basic Streaming

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

const csvStream = new ReadableStream({
  start(controller) {
    controller.enqueue('name,age\r\n');
    controller.enqueue('Alice,30\r\n');
    controller.enqueue('Bob,25\r\n');
    controller.close();
  }
});

csvStream
  .pipeThrough(new LexerTransformer())
  .pipeThrough(new RecordAssemblerTransformer())
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record);
    }
  }));
// { name: 'Alice', age: '30' }
// { name: 'Bob', age: '25' }
```

---

### Pattern 2: Pre-defined Header

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

const csvStream = new ReadableStream({
  start(controller) {
    controller.enqueue('Alice,30\r\n'); // No header row
    controller.enqueue('Bob,25\r\n');
    controller.close();
  }
});

csvStream
  .pipeThrough(new LexerTransformer())
  .pipeThrough(new RecordAssemblerTransformer({
    header: ['name', 'age']
  }))
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record);
    }
  }));
// { name: 'Alice', age: '30' }
// { name: 'Bob', age: '25' }
```

---

### Pattern 3: File Reading

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

// Browser
const file = document.querySelector('input[type="file"]').files[0];
const stream = file.stream()
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new LexerTransformer())
  .pipeThrough(new RecordAssemblerTransformer());

for await (const record of stream) {
  console.log(record);
}
```

```typescript
// Node.js
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';

const fileStream = Readable.toWeb(
  createReadStream('data.csv', { encoding: 'utf-8' })
);

fileStream
  .pipeThrough(new LexerTransformer())
  .pipeThrough(new RecordAssemblerTransformer())
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record);
    }
  }));
```

---

### Pattern 4: Network Fetching

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv');

response.body
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new LexerTransformer())
  .pipeThrough(new RecordAssemblerTransformer())
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record);
    }
  }));
```

---

### Pattern 5: Data Transformation

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

// Convert age to number
class AgeConverterTransform extends TransformStream {
  constructor() {
    super({
      transform(record, controller) {
        controller.enqueue({
          ...record,
          age: Number(record.age)
        });
      }
    });
  }
}

csvStream
  .pipeThrough(new LexerTransformer())
  .pipeThrough(new RecordAssemblerTransformer())
  .pipeThrough(new AgeConverterTransform())
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record); // { name: 'Alice', age: 30 } (number)
    }
  }));
```

---

### Pattern 6: Data Validation

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  age: z.coerce.number().int().min(0).max(150)
});

class ValidationTransform extends TransformStream {
  constructor() {
    super({
      transform(record, controller) {
        try {
          const validated = schema.parse(record);
          controller.enqueue(validated);
        } catch (error) {
          console.error('Validation error:', error);
          // Skip invalid records
        }
      }
    });
  }
}

csvStream
  .pipeThrough(new LexerTransformer())
  .pipeThrough(new RecordAssemblerTransformer())
  .pipeThrough(new ValidationTransform())
  .pipeTo(writable);
```

---

### Pattern 7: Progress Tracking

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

let recordCount = 0;

csvStream
  .pipeThrough(new LexerTransformer())
  .pipeThrough(new RecordAssemblerTransformer())
  .pipeThrough(new TransformStream({
    transform(record, controller) {
      recordCount++;
      if (recordCount % 1000 === 0) {
        console.log(`Processed ${recordCount} records`);
      }
      controller.enqueue(record);
    }
  }))
  .pipeTo(writable);
```

---

## Error Handling

### ParseError: Empty Header

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

const csvStream = new ReadableStream({
  start(controller) {
    controller.enqueue('\r\n'); // Empty header
    controller.close();
  }
});

csvStream
  .pipeThrough(new LexerTransformer())
  .pipeThrough(new RecordAssemblerTransformer())
  .pipeTo(writable)
  .catch(error => {
    if (error.name === 'ParseError') {
      console.error('Parse error:', error.message);
      // "The header must not be empty."
    }
  });
```

---

### ParseError: Duplicate Header Fields

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

const csvStream = new ReadableStream({
  start(controller) {
    controller.enqueue('name,age,name\r\n'); // Duplicate 'name'
    controller.enqueue('Alice,30,Bob\r\n');
    controller.close();
  }
});

csvStream
  .pipeThrough(new LexerTransformer())
  .pipeThrough(new RecordAssemblerTransformer())
  .pipeTo(writable)
  .catch(error => {
    if (error.name === 'ParseError') {
      console.error('Parse error:', error.message);
      // "The header must not contain duplicate fields."
    }
  });
```

---

### RangeError: Field Count Exceeded

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

const csvStream = new ReadableStream({
  start(controller) {
    // Generate CSV with 200 fields
    const header = Array.from({ length: 200 }, (_, i) => `field${i}`).join(',');
    controller.enqueue(header + '\r\n');
    controller.close();
  }
});

csvStream
  .pipeThrough(new LexerTransformer())
  .pipeThrough(new RecordAssemblerTransformer({ maxFieldCount: 100 }))
  .pipeTo(writable)
  .catch(error => {
    if (error instanceof RangeError) {
      console.error('Field count exceeded:', error.message);
    }
  });
```

---

### AbortSignal

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

const controller = new AbortController();

setTimeout(() => controller.abort(), 5000); // Abort after 5 seconds

csvStream
  .pipeThrough(new LexerTransformer({ signal: controller.signal }))
  .pipeThrough(new RecordAssemblerTransformer({ signal: controller.signal }))
  .pipeTo(writable)
  .catch(error => {
    if (error.name === 'AbortError') {
      console.log('Assembly was aborted');
    }
  });
```

---

## Performance Characteristics

### Memory Usage

**O(1)** - Constant memory usage

- Only buffers current record being assembled
- Records are streamed, not accumulated
- Memory usage independent of file size

### Backpressure Handling

**Automatic** via Web Streams API

- Consumer controls flow rate
- Producer pauses when consumer is slow
- No memory exhaustion

---

## Complete Pipeline Example

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

// Fetch CSV from network
const response = await fetch('https://example.com/large-data.csv');

// Process in streaming fashion
await response.body
  .pipeThrough(new TextDecoderStream())           // Decode to text
  .pipeThrough(new LexerTransformer())            // Tokenize
  .pipeThrough(new RecordAssemblerTransformer())  // Assemble records
  .pipeThrough(new TransformStream({              // Validate & transform
    transform(record, controller) {
      if (isValid(record)) {
        controller.enqueue(transform(record));
      }
    }
  }))
  .pipeTo(new WritableStream({                    // Store results
    write(record) {
      database.insert(record);
    }
  }));

console.log('Processing complete');
```

---

## Comparison: RecordAssembler vs RecordAssemblerTransformer

| Feature | RecordAssembler | RecordAssemblerTransformer |
|---------|-----------------|---------------------------|
| **API Style** | Imperative (method calls) | Declarative (streams) |
| **Memory** | Manual buffering | Automatic backpressure |
| **Composability** | Manual chaining | `.pipeThrough()` |
| **Use Case** | Low-level control | Production streaming |
| **Complexity** | Higher | Lower |

**Recommendation:** Use `RecordAssemblerTransformer` for production streaming applications.

---

## Browser and Runtime Support

RecordAssemblerTransformer uses the Web Streams API, which is supported across all modern runtimes:

- ✅ Node.js LTS
- ✅ Deno LTS
- ✅ Modern browsers (Chrome, Firefox, Edge, Safari)

See: [Supported Environments](../supported-environments.md)

---

## Related APIs

- **[RecordAssembler](./record-assembler.md)** - Low-level assembly API
- **[LexerTransformer](./lexer-transformer.md)** - Converts CSV to tokens
- **[Parsing Architecture](../../explanation/parsing-architecture.md)** - Understanding the pipeline

---

## Examples

### Example 1: CSV to JSON

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

async function csvToJSON(csvStream: ReadableStream<string>): Promise<string> {
  const records: any[] = [];

  await csvStream
    .pipeThrough(new LexerTransformer())
    .pipeThrough(new RecordAssemblerTransformer())
    .pipeTo(new WritableStream({
      write(record) {
        records.push(record);
      }
    }));

  return JSON.stringify(records, null, 2);
}

const json = await csvToJSON(csvStream);
console.log(json);
```

---

### Example 2: Filtering Records

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

class FilterTransform extends TransformStream {
  constructor(predicate: (record: any) => boolean) {
    super({
      transform(record, controller) {
        if (predicate(record)) {
          controller.enqueue(record);
        }
      }
    });
  }
}

csvStream
  .pipeThrough(new LexerTransformer())
  .pipeThrough(new RecordAssemblerTransformer())
  .pipeThrough(new FilterTransform(
    (record) => Number(record.age) >= 18
  ))
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record); // Only adults
    }
  }));
```

---

### Example 3: Record Aggregation

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

let totalAge = 0;
let count = 0;

await csvStream
  .pipeThrough(new LexerTransformer())
  .pipeThrough(new RecordAssemblerTransformer())
  .pipeTo(new WritableStream({
    write(record) {
      totalAge += Number(record.age);
      count++;
    },
    close() {
      console.log(`Average age: ${totalAge / count}`);
    }
  }));
```

---

### Example 4: Error Recovery

```typescript
import { LexerTransformer, RecordAssemblerTransformer } from 'web-csv-toolbox';

class ErrorRecoveryTransform extends TransformStream {
  constructor() {
    super({
      transform(record, controller) {
        try {
          // Validate and transform
          const validated = validateRecord(record);
          controller.enqueue(validated);
        } catch (error) {
          // Log error and skip invalid record
          console.error('Invalid record:', record, error);
        }
      }
    });
  }
}

csvStream
  .pipeThrough(new LexerTransformer())
  .pipeThrough(new RecordAssemblerTransformer())
  .pipeThrough(new ErrorRecoveryTransform())
  .pipeTo(writable);
```

---

## Best Practices

### ✅ Do

- Use RecordAssemblerTransformer for streaming CSV parsing
- Combine with LexerTransformer for complete pipeline
- Handle errors in `.catch()` blocks
- Use AbortSignal for cancelable operations
- Set appropriate `maxFieldCount` for your use case
- Add validation transforms after assembly
- Track progress with custom transforms

### ❌ Don't

- Don't accumulate all records in memory (defeats streaming purpose)
- Don't ignore backpressure (use `.pipeTo()` properly)
- Don't remove field count limits (DoS vulnerability)
- Don't use for small in-memory CSV strings (use high-level APIs instead)

---

## When to Use RecordAssemblerTransformer

**✅ Use RecordAssemblerTransformer when:**
- Parsing large CSV files (>1MB)
- Streaming data from network or disk
- Building composable CSV processing pipelines
- Memory efficiency is critical
- Real-time CSV processing

**❌ Use high-level APIs when:**
- Small CSV strings (<1MB)
- Simple data extraction
- One-off parsing operations

See: [parse()](../../tutorials/getting-started.md), [parseString()](../../tutorials/getting-started.md)

---

## TypeScript Types

```typescript
import type { CSVRecord, RecordAssemblerOptions } from 'web-csv-toolbox';

// CSVRecord type
type CSVRecord<Header extends ReadonlyArray<string>> = {
  [K in Header[number]]: string | undefined;
};

// Example with explicit types
const transformer = new RecordAssemblerTransformer<['name', 'age']>();

// Records will have type:
// { name: string | undefined; age: string | undefined; }
```
