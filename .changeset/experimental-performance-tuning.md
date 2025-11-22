---
"web-csv-toolbox": minor
---

Add experimental performance tuning options to Engine configuration: `backpressureCheckInterval` and `queuingStrategy`

## New Experimental Features

Added advanced performance tuning options for fine-grained control over streaming behavior:

### `engine.backpressureCheckInterval`

Controls how frequently the internal parsers check for backpressure during streaming operations (count-based).

**Default:**
```typescript
{
  lexer: 100,      // Check every 100 tokens processed
  assembler: 10    // Check every 10 records processed
}
```

**Trade-offs:**
- **Lower values**: More frequent backpressure checks, more responsive to downstream consumers
- **Higher values**: Less frequent backpressure checks, reduced checking overhead

**Potential Use Cases:**
- Memory-constrained environments: Consider lower values for more responsive backpressure
- Scenarios where checking overhead is a concern: Consider higher values
- Slow consumers: Consider lower values to propagate backpressure more quickly

### `engine.queuingStrategy`

Controls the internal queuing behavior of the CSV parser's streaming pipeline.

**Default:** Designed to balance memory usage and buffering behavior

**Structure:**
```typescript
{
  lexerWritable?: QueuingStrategy<string>;
  lexerReadable?: QueuingStrategy<Token>;
  assemblerWritable?: QueuingStrategy<Token>;
  assemblerReadable?: QueuingStrategy<CSVRecord<any>>;
}
```

**Pipeline Stages:**
The CSV parser uses a two-stage pipeline:
1. **Lexer**: String → Token
2. **Assembler**: Token → CSVRecord

Each stage has both writable (input) and readable (output) sides:
1. `lexerWritable` - Lexer input (string chunks)
2. `lexerReadable` - Lexer output (tokens)
3. `assemblerWritable` - Assembler input (tokens from lexer)
4. `assemblerReadable` - Assembler output (CSV records)

**Theoretical Trade-offs:**
- **Small highWaterMark (1-10)**: Less memory for buffering, backpressure applied more quickly
- **Medium highWaterMark (default)**: Balanced memory and buffering
- **Large highWaterMark (100+)**: More memory for buffering, backpressure applied less frequently

**Note:** Actual performance characteristics depend on your specific use case and runtime environment. Profile your application to determine optimal values.

**Potential Use Cases:**
- IoT/Embedded: Consider smaller highWaterMark for minimal memory footprint
- Server-side batch processing: Consider larger highWaterMark for more buffering
- Real-time streaming: Consider smaller highWaterMark for faster backpressure propagation

## Usage Examples

### Configuration Example: Tuning for Potential High-Throughput Scenarios

```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

const config = EnginePresets.fastest({
  backpressureCheckInterval: {
    lexer: 200,      // Check every 200 tokens (less frequent)
    assembler: 20    // Check every 20 records (less frequent)
  },
  queuingStrategy: {
    lexerReadable: new CountQueuingStrategy({ highWaterMark: 100 }),
    assemblerReadable: new CountQueuingStrategy({ highWaterMark: 50 })
  }
});

for await (const record of parseString(csv, { engine: config })) {
  console.log(record);
}
```

### Memory-Constrained Environment

```typescript
import { parseString, EnginePresets } from 'web-csv-toolbox';

const config = EnginePresets.balanced({
  backpressureCheckInterval: {
    lexer: 10,       // Check every 10 tokens (frequent checks)
    assembler: 5     // Check every 5 records (frequent checks)
  },
  queuingStrategy: {
    // Minimal buffers throughout entire pipeline
    lexerWritable: new CountQueuingStrategy({ highWaterMark: 1 }),
    lexerReadable: new CountQueuingStrategy({ highWaterMark: 1 }),
    assemblerWritable: new CountQueuingStrategy({ highWaterMark: 1 }),
    assemblerReadable: new CountQueuingStrategy({ highWaterMark: 1 })
  }
});

for await (const record of parseString(csv, { engine: config })) {
  console.log(record);
}
```

## ⚠️ Experimental Status

These APIs are marked as **experimental** and may change in future versions based on ongoing performance research. The default values are designed to work well for most use cases, but optimal values may vary depending on your specific environment and workload.

**Recommendation:** Only adjust these settings if you're experiencing specific performance issues with large streaming operations or have specific memory/throughput requirements.

## Design Philosophy

These options belong to `engine` configuration because they affect **performance and behavior only**, not the parsing result specification. This follows the design principle:

- **Top-level options**: Affect specification (result changes)
- **Engine options**: Affect performance/behavior (same result, different execution)
