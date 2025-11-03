# CSVLexerTransformer API Reference

The **CSVLexerTransformer** class is a TransformStream that wraps the [CSVLexer](./lexer.md) for use in streaming pipelines. It converts a stream of CSV string chunks into a stream of token arrays.

## Overview

```typescript
import { CSVLexerTransformer } from 'web-csv-toolbox';

const csvStream = new ReadableStream({
  start(controller) {
    controller.enqueue('name,age\r\n');
    controller.enqueue('Alice,30\r\n');
    controller.close();
  }
});

csvStream
  .pipeThrough(new CSVLexerTransformer())
  .pipeTo(new WritableStream({
    write(tokens) {
      for (const token of tokens) {
        console.log(token);
      }
    }
  }));
```

## Constructor

```typescript
new CSVLexerTransformer<Delimiter, Quotation>(
  options?: CSVLexerTransformerOptions,
  writableStrategy?: ExtendedQueuingStrategy<string>,
  readableStrategy?: ExtendedQueuingStrategy<Token[]>
)
```

### Type Parameters

- `Delimiter extends string = ','` - Field delimiter type (default: comma)
- `Quotation extends string = '"'` - Quotation character type (default: double-quote)

### Parameters

#### `options`

CSV parsing options (same as [CSVLexer options](./csv-lexer.md#options)):

```typescript
interface CSVLexerTransformerOptions {
  delimiter?: string;
  quotation?: string;
  maxBufferSize?: number;
  signal?: AbortSignal;
}
```

#### `writableStrategy`

**Type:** `ExtendedQueuingStrategy<string>`
**Default:** `{ highWaterMark: 65536, size: chunk => chunk.length, checkInterval: 100 }`

Queuing strategy for the writable side (input stream).

- `highWaterMark`: 65536 characters (≈64KB)
- `size`: Counts by string length (characters)
- `checkInterval`: Check backpressure every 100 tokens

**Example:**
```typescript
// Increase buffer for high-throughput scenarios
const transformer = new CSVLexerTransformer(
  { delimiter: ',' },
  { highWaterMark: 131072 }  // 128KB
);

// Decrease buffer for memory-constrained environments
const transformer = new CSVLexerTransformer(
  {},
  { highWaterMark: 32768 }  // 32KB
);

// Custom size function and backpressure checking
const transformer = new CSVLexerTransformer(
  {},
  {
    highWaterMark: 65536,
    size: (chunk) => chunk.length,
    checkInterval: 200  // Check every 200 tokens
  }
);
```

#### `readableStrategy`

**Type:** `ExtendedQueuingStrategy<Token[]>`
**Default:** `{ highWaterMark: 1024, size: tokens => tokens.length, checkInterval: 100 }`

Queuing strategy for the readable side (output token arrays).

- `highWaterMark`: 1024 tokens
- `size`: Counts by number of tokens in each array
- `checkInterval`: Check backpressure every 100 tokens

**Example:**
```typescript
const transformer = new CSVLexerTransformer(
  { delimiter: ',' },
  { highWaterMark: 65536 },    // writable
  { highWaterMark: 2048 }      // readable
);
```

### Queuing Strategy Notes

**Default Rationale:**
- Writable side counts by character length (64KB default)
- Readable side counts by token count (1024 tokens default)
- These defaults are starting points, not empirically optimized

**When to adjust:**
- ✅ Increase for server environments with large files
- ✅ Decrease for browsers or edge functions with limited memory
- ⚠️ Profile with your actual data before changing defaults

**Backpressure Handling:**
The transformer monitors `controller.desiredSize` and yields to the event loop when backpressure is detected (desiredSize ≤ 0). The `checkInterval` option controls how often this check occurs.

---

## Properties

### `lexer`

**Type:** `CSVLexer<Delimiter, Quotation>`
**Read-only:** Yes

Access to the underlying CSVLexer instance.

**Example:**
```typescript
const transformer = new CSVLexerTransformer();
console.log(transformer.lexer); // CSVLexer instance
```

**Use case:** Advanced debugging, accessing internal state

---

## Stream Behavior

### Input

**Type:** `ReadableStream<string>`

A stream of CSV string chunks.

**Notes:**
- Chunks can be any size (1 byte to entire file)
- Chunk boundaries don't need to align with CSV structure
- Handles incomplete tokens across chunk boundaries

### Output

**Type:** `ReadableStream<Token[]>`

A stream of token arrays.

**Notes:**
- Each chunk produces an array of tokens
- Empty arrays are possible (buffering incomplete tokens)
- Final chunk includes all remaining tokens

---

## Usage Patterns

### Pattern 1: Basic Streaming

```typescript
import { CSVLexerTransformer } from 'web-csv-toolbox';

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
  .pipeTo(new WritableStream({
    write(tokens) {
      console.log(`Received ${tokens.length} tokens`);
      for (const token of tokens) {
        console.log(token);
      }
    }
  }));
```

---

### Pattern 2: File Reading

```typescript
import { CSVLexerTransformer } from 'web-csv-toolbox';

// Browser
const file = document.querySelector('input[type="file"]').files[0];
const stream = file.stream()
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new CSVLexerTransformer());

for await (const tokens of stream) {
  console.log(tokens);
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
  .pipeTo(new WritableStream({
    write(tokens) {
      for (const token of tokens) {
        console.log(token);
      }
    }
  }));
```

---

### Pattern 3: Network Fetching

```typescript
import { CSVLexerTransformer } from 'web-csv-toolbox';

const response = await fetch('https://example.com/data.csv');

response.body
  .pipeThrough(new TextDecoderStream())
  .pipeThrough(new CSVLexerTransformer())
  .pipeTo(new WritableStream({
    write(tokens) {
      console.log(tokens);
    }
  }));
```

---

### Pattern 4: Pipeline Composition

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
      console.log(record); // { name: 'Alice', age: '30' }
    }
  }));
```

---

### Pattern 5: Custom Transform

```typescript
import { CSVLexerTransformer } from 'web-csv-toolbox';

// Filter only Field tokens
class FieldFilterTransform extends TransformStream {
  constructor() {
    super({
      transform(tokens, controller) {
        const fields = tokens.filter(t => t.type === 'Field');
        if (fields.length > 0) {
          controller.enqueue(fields);
        }
      }
    });
  }
}

csvStream
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new FieldFilterTransform())
  .pipeTo(new WritableStream({
    write(fieldTokens) {
      console.log(fieldTokens); // Only Field tokens
    }
  }));
```

---

## Error Handling

### RangeError: Buffer Size Exceeded

```typescript
import { CSVLexerTransformer } from 'web-csv-toolbox';

const csvStream = new ReadableStream({
  start(controller) {
    controller.enqueue('a'.repeat(20_000_000)); // 20M characters
    controller.close();
  }
});

csvStream
  .pipeThrough(new CSVLexerTransformer({ maxBufferSize: 10_000_000 }))
  .pipeTo(new WritableStream({
    write(tokens) {
      console.log(tokens);
    }
  }))
  .catch(error => {
    if (error instanceof RangeError) {
      console.error('Buffer exceeded:', error.message);
    }
  });
```

---

### ParseError: Unclosed Quoted Field

```typescript
import { CSVLexerTransformer } from 'web-csv-toolbox';

const csvStream = new ReadableStream({
  start(controller) {
    controller.enqueue('"Unclosed quote');
    controller.close(); // Missing closing quote
  }
});

csvStream
  .pipeThrough(new CSVLexerTransformer())
  .pipeTo(new WritableStream({
    write(tokens) {
      console.log(tokens);
    }
  }))
  .catch(error => {
    if (error.name === 'ParseError') {
      console.error('Parse error:', error.message);
      console.error('Position:', error.position);
    }
  });
```

---

### AbortSignal

```typescript
import { CSVLexerTransformer } from 'web-csv-toolbox';

const controller = new AbortController();
const csvStream = getLargeCSVStream();

setTimeout(() => controller.abort(), 5000); // Abort after 5 seconds

csvStream
  .pipeThrough(new CSVLexerTransformer({ signal: controller.signal }))
  .pipeTo(new WritableStream({
    write(tokens) {
      console.log(tokens);
    }
  }))
  .catch(error => {
    if (error.name === 'AbortError') {
      console.log('Lexing was aborted');
    }
  });
```

---

## Performance Characteristics

### Memory Usage

**O(1)** - Constant memory usage

- Only buffers current incomplete token
- Tokens are streamed, not accumulated
- Memory usage independent of file size

### Backpressure Handling

**Automatic** via Web Streams API

- Consumer controls flow rate
- Producer pauses when consumer is slow
- No memory exhaustion

---

## Comparison: CSVLexer vs CSVLexerTransformer

| Feature | CSVLexer | CSVLexerTransformer |
|---------|-------|------------------|
| **API Style** | Imperative (method calls) | Declarative (streams) |
| **Memory** | Manual buffering | Automatic backpressure |
| **Composability** | Manual chaining | `.pipeThrough()` |
| **Use Case** | Low-level control | Production streaming |
| **Complexity** | Higher | Lower |

**Recommendation:** Use `CSVLexerTransformer` for production streaming applications.

---

## Integration with Web Streams

### Readable Stream Source

```typescript
import { CSVLexerTransformer } from 'web-csv-toolbox';

const csvStream = new ReadableStream({
  start(controller) {
    controller.enqueue('name,age\r\n');
    controller.enqueue('Alice,30\r\n');
    controller.close();
  }
});

csvStream.pipeThrough(new CSVLexerTransformer());
```

---

### Transform Stream Middleware

```typescript
import { CSVLexerTransformer } from 'web-csv-toolbox';

class UppercaseTransform extends TransformStream {
  constructor() {
    super({
      transform(tokens, controller) {
        const uppercased = tokens.map(token => ({
          ...token,
          value: token.value.toUpperCase()
        }));
        controller.enqueue(uppercased);
      }
    });
  }
}

csvStream
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new UppercaseTransform())
  .pipeTo(writable);
```

---

### Writable Stream Sink

```typescript
import { CSVLexerTransformer } from 'web-csv-toolbox';

const writable = new WritableStream({
  write(tokens) {
    for (const token of tokens) {
      console.log(token);
    }
  },
  close() {
    console.log('Stream closed');
  },
  abort(reason) {
    console.error('Stream aborted:', reason);
  }
});

csvStream
  .pipeThrough(new CSVLexerTransformer())
  .pipeTo(writable);
```

---

## Browser and Runtime Support

CSVLexerTransformer uses the Web Streams API, which is supported across all modern runtimes:

- ✅ Node.js LTS
- ✅ Deno LTS
- ✅ Modern browsers (Chrome, Firefox, Edge, Safari)

See: [Supported Environments](../supported-environments.md)

---

## Related APIs

- **[CSVLexer](./lexer.md)** - Low-level lexing API
- **[CSVRecordAssemblerTransformer](./record-assembler-transformer.md)** - Converts tokens to records
- **[Parsing Architecture](../../explanation/parsing-architecture.md)** - Understanding the pipeline

---

## Examples

### Example 1: Progress Tracking

```typescript
import { CSVLexerTransformer } from 'web-csv-toolbox';

let tokenCount = 0;

csvStream
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new TransformStream({
    transform(tokens, controller) {
      tokenCount += tokens.length;
      console.log(`Processed ${tokenCount} tokens`);
      controller.enqueue(tokens);
    }
  }))
  .pipeTo(writable);
```

---

### Example 2: Token Type Filtering

```typescript
import { CSVLexerTransformer } from 'web-csv-toolbox';

// Extract only field values
csvStream
  .pipeThrough(new CSVLexerTransformer())
  .pipeThrough(new TransformStream({
    transform(tokens, controller) {
      const fields = tokens
        .filter(t => t.type === 'Field')
        .map(t => t.value);
      controller.enqueue(fields);
    }
  }))
  .pipeTo(new WritableStream({
    write(fields) {
      console.log(fields); // ['Alice', '30']
    }
  }));
```

---

### Example 3: Error Recovery

```typescript
import { CSVLexerTransformer } from 'web-csv-toolbox';

csvStream
  .pipeThrough(new CSVLexerTransformer())
  .pipeTo(new WritableStream({
    write(tokens) {
      console.log(tokens);
    }
  }))
  .catch(error => {
    console.error('Error:', error.message);

    // Retry or fallback logic
    if (error instanceof RangeError) {
      console.log('Retrying with larger buffer...');
      return csvStream
        .pipeThrough(new CSVLexerTransformer({ maxBufferSize: 50_000_000 }))
        .pipeTo(writable);
    }
  });
```

---

## Best Practices

### ✅ Do

- Use CSVLexerTransformer for streaming CSV parsing
- Combine with CSVRecordAssemblerTransformer for complete pipeline
- Handle errors in `.catch()` blocks
- Use AbortSignal for cancelable operations
- Set appropriate `maxBufferSize` for your use case

### ❌ Don't

- Don't accumulate all tokens in memory (defeats streaming purpose)
- Don't ignore backpressure (use `.pipeTo()` properly)
- Don't remove buffer size limits (DoS vulnerability)
- Don't use for small in-memory CSV strings (use high-level APIs instead)

---

## When to Use CSVLexerTransformer

**✅ Use CSVLexerTransformer when:**
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
