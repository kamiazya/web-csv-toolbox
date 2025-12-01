# Output Format Guide

Many APIs (e.g. `parseString`, `createCSVRecordAssembler`, stream transformers) expose an `outputFormat` option so you can choose the most suitable record representation for your workload. This guide summarizes each format's behavior, strengths, and constraints.

## Quick Comparison

| Format        | Representation                       | Best for                                | ColumnCountStrategy support | Headerless (`header: []`) | `includeHeader` | Notes |
|---------------|--------------------------------------|-----------------------------------------|-----------------------------|---------------------------|-----------------|-------|
| `object`      | Plain object `{ headerKey: value }`  | JSON interoperability, downstream libs  | `fill`, `strict`            | ❌                       | ❌             | Default output. Values are always strings. |
| `record-view` | Hybrid (`CSVRecordView`: array + keys) | Zero-copy workloads, iterative transforms | `fill`, `strict`            | ❌                       | ❌             | Numeric indices remain enumerable (`Object.keys` includes `"0"`, `"1"`, ...). |
| `array`       | Readonly array / named tuple          | Maximum throughput, flexible schemas    | All strategies (`fill`, `keep`, `truncate`, `sparse`, `strict`) | ✅ (with `keep`) | ✅             | Headerless mode requires `outputFormat: "array"` + `columnCountStrategy: "keep"`. |

## Object Format (`"object"`)
- Produces pure objects keyed by header names.
- Missing columns are padded with empty strings in `fill` mode, or rejected in `strict`.
- Recommended when you plan to serialize to JSON, access fields by name exclusively, or hand records to other libraries.

```ts
const assembler = createCSVRecordAssembler({
  header: ["name", "age"] as const,
  // outputFormat defaults to "object"
});
for (const record of assembler.assemble(tokens)) {
  record.name; // string
}
```

## Record View Format (`"record-view"`)
- Returns `CSVRecordView`: the backing row array plus header getters. Array indices and named properties stay in sync without cloning.
- Ideal for streaming or compute-heavy workloads where you read a record once and discard it.
- Reflective operations (`Object.keys`, spread) list numeric indices before header names.

```ts
const assembler = createCSVRecordAssembler({
  header: ["name", "age"] as const,
  outputFormat: "record-view",
});
const [record] = assembler.assemble(tokens);
record[0];   // "Alice"
record.name; // "Alice"
```

## Array Format (`"array"`)
- Emits header-ordered arrays (typed as named tuples when a header is provided).
- Supports every columnCountStrategy, including `keep` for ragged rows and `sparse` for optional columns.
- Only format that supports headerless mode.

```ts
const assembler = createCSVRecordAssembler({
  header: ["name", "age"] as const,
  outputFormat: "array",
  columnCountStrategy: "truncate",
});
const [row] = assembler.assemble(tokens);
row[0]; // "Alice"
```

## Choosing the Right Format

1. **Need plain JS objects / JSON serialization?** Use `object`.
2. **Need zero-copy reads with both index and key access?** Use `record-view`.
3. **Need the fastest throughput or ragged rows?** Use `array` with the appropriate `columnCountStrategy`.

For more details on column-count handling, see the [ColumnCountStrategy guide](./column-count-strategy-guide.md).
