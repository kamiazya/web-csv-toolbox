# CSVRecordAssemblerTransformer API Reference

The **CSVRecordAssemblerTransformer** class is a TransformStream that wraps the [CSVRecordAssembler](./csv-record-assembler.md) for use in streaming pipelines. It converts a stream of token arrays into a stream of CSV records (JavaScript objects).

## Overview

```typescript
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

const csvStream = new ReadableStream({
  start(controller) {
    controller.enqueue('name,age\r\n');
    controller.enqueue('Alice,30\r\n');
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
// { name: 'Alice', age: '30' }
```

## Constructor

```typescript
new CSVRecordAssemblerTransformer<Header>(
  options?: CSVRecordAssemblerOptions<Header>,
  writableStrategy?: ExtendedQueuingStrategy<Token[]>,
  readableStrategy?: ExtendedQueuingStrategy<CSVRecord<Header>>
)
```

### Type Parameters

- `Header extends ReadonlyArray<string>` - Header field names type

### Parameters

#### `options`

```typescript
interface CSVRecordAssemblerOptions<Header> {
  header?: Header;
  maxFieldCount?: number;
  skipEmptyLines?: boolean;
  signal?: AbortSignal;
}
```

All options are the same as [CSVRecordAssembler options](./csv-record-assembler.md#options).

#### `writableStrategy`

**Type:** `ExtendedQueuingStrategy<Token[]>`
**Default:** `{ highWaterMark: 1024, size: tokens => tokens.length, checkInterval: 10 }`

Queuing strategy for the writable side (input stream).

**Example:**
```typescript
const transformer = new CSVRecordAssemblerTransformer(
  { header: ['name', 'age'] },
  { highWaterMark: 2048 } // Larger input buffer
);
```

**When to customize:**
- ✅ Match with CSVLexerTransformer output buffer
- ✅ Adjust based on token array sizes
- ❌ Don't set arbitrarily without profiling

#### `readableStrategy`

**Type:** `ExtendedQueuingStrategy<CSVRecord<Header>>`
**Default:** `{ highWaterMark: 256, size: () => 1, checkInterval: 10 }`

Queuing strategy for the readable side (output stream).

**Example:**
```typescript
const transformer = new CSVRecordAssemblerTransformer(
  { skipEmptyLines: true },
  undefined, // Use default writable strategy
  { highWaterMark: 512 } // More records buffered
);
```

**When to customize:**
- ✅ Increase for better throughput in high-latency consumers
- ✅ Decrease for memory-constrained environments
- ❌ Don't set too high (defeats streaming purpose)

**ExtendedQueuingStrategy:**
```typescript
interface ExtendedQueuingStrategy<T> extends QueuingStrategy<T> {
  checkInterval?: number; // How often to check backpressure (default: 10)
}
```

---

## Properties

### `assembler`

**Type:** `CSVRecordAssembler<Header>`
**Read-only:** Yes

Access to the underlying CSVRecordAssembler instance.

**Example:**
```typescript
const transformer = new CSVRecordAssemblerTransformer();
console.log(transformer.assembler); // CSVRecordAssembler instance
```

**Use case:** Advanced debugging, accessing internal state

---

## Stream Behavior

### Input

**Type:** `ReadableStream<Token[]>`

A stream of token arrays (typically from [CSVLexerTransformer](./csv-lexer-transformer.md)).

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
// { name: 'Alice', age: '30' }
// { name: 'Bob', age: '25' }
```

---

### Pattern 2: Pre-defined Header

```typescript
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

const csvStream = new ReadableStream({
  start(controller) {
    controller.enqueue('Alice,30\r\n'); // No header row
    controller.enqueue('Bob,25\r\n');
    controller.close();
  }
});

csvStream
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new CSVRecordAssemblerTransformer({
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
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

// Browser
const file = document.querySelector('input[type="file"]').files[0];
const stream = file.stream()
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new CSVRecordAssemblerTransformer());

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
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new CSVRecordAssemblerTransformer())
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record);
    }
  }));
```

---

### Pattern 4: Network Fetching

```typescript
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv');

response.body
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new CSVRecordAssemblerTransformer())
  .pipeTo(new WritableStream({
    write(record) {
      console.log(record);
    }
  }));
```

---

### Pattern 5: Data Transformation

```typescript
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

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
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new CSVRecordAssemblerTransformer())
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
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';
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
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new CSVRecordAssemblerTransformer())
  .pipeThrough(new ValidationTransform())
  .pipeTo(writable);
```

---

### Pattern 7: Progress Tracking

```typescript
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

let recordCount = 0;

csvStream
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new CSVRecordAssemblerTransformer())
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
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

const csvStream = new ReadableStream({
  start(controller) {
    controller.enqueue('\r\n'); // Empty header
    controller.close();
  }
});

csvStream
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new CSVRecordAssemblerTransformer())
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
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

const csvStream = new ReadableStream({
  start(controller) {
    controller.enqueue('name,age,name\r\n'); // Duplicate 'name'
    controller.enqueue('Alice,30,Bob\r\n');
    controller.close();
  }
});

csvStream
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new CSVRecordAssemblerTransformer())
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
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

const csvStream = new ReadableStream({
  start(controller) {
    // Generate CSV with 200 fields
    const header = Array.from({ length: 200 }, (_, i) => `field${i}`).join(',');
    controller.enqueue(header + '\r\n');
    controller.close();
  }
});

csvStream
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new CSVRecordAssemblerTransformer({ maxFieldCount: 100 }))
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
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

const controller = new AbortController();

setTimeout(() => controller.abort(), 5000); // Abort after 5 seconds

csvStream
  .pipeThrough(new CSVLexerTransformer({ signal: controller.signal }))
  .pipeThrough(new CSVRecordAssemblerTransformer({ signal: controller.signal }))
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
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

// Fetch CSV from network
const response = await fetch('https://example.com/large-data.csv');

// Process in streaming fashion
await response.body
  .pipeThrough(new TextDecoderStream())           // Decode to text
  .pipeThrough(new CSVLexerTransformer())            // Tokenize
  .pipeThrough(new CSVRecordAssemblerTransformer())  // Assemble records
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

## Comparison: CSVRecordAssembler vs CSVRecordAssemblerTransformer

| Feature | CSVRecordAssembler | CSVRecordAssemblerTransformer |
|---------|-----------------|---------------------------|
| **API Style** | Imperative (method calls) | Declarative (streams) |
| **Memory** | Manual buffering | Automatic backpressure |
| **Composability** | Manual chaining | `.pipeThrough()` |
| **Use Case** | Low-level control | Production streaming |
| **Complexity** | Higher | Lower |

**Recommendation:** Use `CSVRecordAssemblerTransformer` for production streaming applications.

---

## Browser and Runtime Support

CSVRecordAssemblerTransformer uses the Web Streams API, which is supported across all modern runtimes:

- ✅ Node.js LTS
- ✅ Deno LTS
- ✅ Modern browsers (Chrome, Firefox, Edge, Safari)

See: [Supported Environments](../supported-environments.md)

---

## Related APIs

- **[CSVRecordAssembler](./csv-record-assembler.md)** - Low-level assembly API
- **[CSVLexerTransformer](./csv-lexer-transformer.md)** - Converts CSV to tokens
- **[Parsing Architecture](../../explanation/parsing-architecture.md)** - Understanding the pipeline

---

## Examples

### Example 1: CSV to JSON

```typescript
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

async function csvToJSON(csvStream: ReadableStream<string>): Promise<string> {
  const records: any[] = [];

  await csvStream
    .pipeThrough(new CSVLexerTransformer())
    .pipeThrough(new CSVRecordAssemblerTransformer())
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
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

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
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new CSVRecordAssemblerTransformer())
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
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

let totalAge = 0;
let count = 0;

await csvStream
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new CSVRecordAssemblerTransformer())
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
import { CSVLexerTransformer, CSVRecordAssemblerTransformer } from 'web-csv-toolbox';

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
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new CSVRecordAssemblerTransformer())
  .pipeThrough(new ErrorRecoveryTransform())
  .pipeTo(writable);
```

---

## Best Practices

### ✅ Do

- Use CSVRecordAssemblerTransformer for streaming CSV parsing
- Combine with CSVLexerTransformer for complete pipeline
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

## When to Use CSVRecordAssemblerTransformer

**✅ Use CSVRecordAssemblerTransformer when:**
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
import type { CSVRecord, CSVRecordAssemblerOptions } from 'web-csv-toolbox';

// CSVRecord type
type CSVRecord<Header extends ReadonlyArray<string>> = {
  [K in Header[number]]: string | undefined;
};

// Example with explicit types
const transformer = new CSVRecordAssemblerTransformer<['name', 'age']>();

// Records will have type:
// { name: string | undefined; age: string | undefined; }
```
