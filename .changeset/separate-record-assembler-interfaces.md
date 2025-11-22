---
"web-csv-toolbox": minor
---

feat!: add array output format support for CSV parsing

CSV parsing results can now be returned as arrays in addition to objects, with TypeScript Named Tuple support for type-safe column access.

## New Features

### Array Output Format

Parse CSV data into arrays instead of objects using the `outputFormat` option:

```typescript
import { parseString } from 'web-csv-toolbox';

const csv = `name,age,city
Alice,30,Tokyo
Bob,25,Osaka`;

// Array output (new)
for await (const record of parseString(csv, { outputFormat: 'array' })) {
  console.log(record); // ['Alice', '30', 'Tokyo']
  console.log(record[0]); // 'Alice' - type-safe access with Named Tuples
}

// Object output (default, unchanged)
for await (const record of parseString(csv)) {
  console.log(record); // { name: 'Alice', age: '30', city: 'Tokyo' }
}
```

### Named Tuple Type Support

When headers are provided, array output uses TypeScript Named Tuples for type-safe access:

```typescript
const csv = `name,age
Alice,30`;

for await (const record of parseString(csv, { outputFormat: 'array' })) {
  // record type: { readonly [K in keyof ['name', 'age']]: string }
  // Equivalent to: { readonly 0: string, readonly 1: string, readonly length: 2 }
  console.log(record[0]); // Type-safe: 'Alice'
  console.log(record.length); // 2
}
```

### Include Header Option

Include the header row in the output (array format only):

```typescript
for await (const record of parseString(csv, {
  outputFormat: 'array',
  includeHeader: true
})) {
  console.log(record);
}
// ['name', 'age', 'city']  ← Header row
// ['Alice', '30', 'Tokyo']
// ['Bob', '25', 'Osaka']
```

### Column Count Strategy

Control how mismatched column counts are handled (array format with header):

```typescript
const csv = `name,age,city
Alice,30        // Missing 'city'
Bob,25,Osaka,JP // Extra column`;

// Strategy: 'pad' - Pad short rows with undefined, truncate long rows
for await (const record of parseString(csv, {
  outputFormat: 'array',
  columnCountStrategy: 'pad'
})) {
  console.log(record);
}
// ['Alice', '30', undefined]
// ['Bob', '25', 'Osaka']

// Strategy: 'strict' - Throw error on mismatch
// Strategy: 'truncate' - Truncate long rows, keep short rows as-is
// Strategy: 'keep' - Keep all columns as-is (default)
```

Available strategies:
- `'keep'` (default): Return rows as-is, regardless of header length
- `'pad'`: Pad short rows with `undefined`, truncate long rows to header length
- `'strict'`: Throw `ParseError` if row length doesn't match header length
- `'truncate'`: Truncate long rows to header length, keep short rows as-is

## Breaking Changes

### CSVRecordAssembler Interface Separation

For better Rust/WASM implementation, the `CSVRecordAssembler` interface has been separated:

- `CSVObjectRecordAssembler<Header>` - For object format output
- `CSVArrayRecordAssembler<Header>` - For array format output

The unified `CSVRecordAssembler<Header, Format>` type remains as a deprecated type alias for backward compatibility.

**New specialized classes:**

```typescript
import {
  FlexibleCSVObjectRecordAssembler,
  FlexibleCSVArrayRecordAssembler,
  createCSVRecordAssembler
} from 'web-csv-toolbox';

// Option 1: Factory function (recommended)
const assembler = createCSVRecordAssembler({
  outputFormat: 'array',
  includeHeader: true
});

// Option 2: Specialized class for object output
const objectAssembler = new FlexibleCSVObjectRecordAssembler({
  header: ['name', 'age']
});

// Option 3: Specialized class for array output
const arrayAssembler = new FlexibleCSVArrayRecordAssembler({
  header: ['name', 'age'],
  columnCountStrategy: 'strict'
});
```

**Type structure:**

```typescript
// Before
type CSVRecordAssembler<Header, Format> = {
  assemble(tokens): IterableIterator<CSVRecord<Header, Format>>;
};

// After
interface CSVObjectRecordAssembler<Header> {
  assemble(tokens): IterableIterator<CSVObjectRecord<Header>>;
}

interface CSVArrayRecordAssembler<Header> {
  assemble(tokens): IterableIterator<CSVArrayRecord<Header>>;
}

// Deprecated type alias (backward compatibility)
type CSVRecordAssembler<Header, Format> =
  Format extends 'array'
    ? CSVArrayRecordAssembler<Header>
    : CSVObjectRecordAssembler<Header>;
```

## Migration Guide

### For Most Users

No changes required. All existing code continues to work:

```typescript
// Existing code works without changes
for await (const record of parseString(csv)) {
  console.log(record); // Still returns objects by default
}
```

### Using New Array Output Format

Simply add the `outputFormat` option:

```typescript
// New: Array output
for await (const record of parseString(csv, { outputFormat: 'array' })) {
  console.log(record); // Returns arrays
}
```

### For Advanced Users Using Low-Level APIs

The existing `FlexibleCSVRecordAssembler` class continues to work. Optionally migrate to specialized classes:

```typescript
// Option 1: Continue using FlexibleCSVRecordAssembler (no changes needed)
const assembler = new FlexibleCSVRecordAssembler({ outputFormat: 'array' });

// Option 2: Use factory function (recommended)
const assembler = createCSVRecordAssembler({ outputFormat: 'array' });

// Option 3: Use specialized classes directly
const assembler = new FlexibleCSVArrayRecordAssembler({
  header: ['name', 'age'],
  columnCountStrategy: 'pad'
});
```

## Use Cases

### Machine Learning / Data Science

```typescript
// Easily convert CSV to training data arrays
const features = [];
for await (const record of parseString(csv, { outputFormat: 'array' })) {
  features.push(record.map(Number));
}
```

### Headerless CSV Files

```typescript
const csv = `Alice,30,Tokyo
Bob,25,Osaka`;

for await (const record of parseString(csv, {
  outputFormat: 'array',
  header: [] // Headerless
})) {
  console.log(record); // ['Alice', '30', 'Tokyo']
}
```

### Type-Safe Column Access

```typescript
const csv = `name,age,city
Alice,30,Tokyo`;

for await (const record of parseString(csv, { outputFormat: 'array' })) {
  // TypeScript knows the tuple structure
  const name: string = record[0];  // Type-safe
  const age: string = record[1];   // Type-safe
  const city: string = record[2];  // Type-safe
}
```

## Benefits

- **Memory efficiency**: Arrays use less memory than objects for large datasets
- **Type safety**: Named Tuples provide compile-time type checking
- **Flexibility**: Choose output format based on your use case
- **Compatibility**: Easier integration with ML libraries and data processing pipelines
- **Better Rust/WASM support**: Separated interfaces simplify native implementation
