# ColumnCountStrategy Guide

`columnCountStrategy` controls how the parser handles rows whose column counts differ from the header. The available strategies depend on the output format and whether a header is known in advance.

## Compatibility Matrix

| Strategy   | Short rows                         | Long rows                     | Object / Record-View | Array (explicit header) | Array (header inferred) | Headerless (`header: []`) |
|------------|------------------------------------|------------------------------|----------------------|-------------------------|-------------------------|----------------------------|
| `fill`     | Pad with `""`                     | Trim excess columns          | ✅                    | ✅                       | ✅                       | ❌                        |
| `strict`   | Throw error                        | Throw error                  | ✅                    | ✅                       | ✅                       | ❌                        |
| `keep`     | Keep as-is (ragged rows)           | Keep as-is                   | ❌                    | ✅                       | ✅                       | ✅ (mandatory)            |
| `truncate` | Keep as-is                         | Trim to header length        | ❌                    | ✅                       | ❌ (requires header)     | ❌                        |
| `sparse`   | Pad with `undefined`               | Trim excess columns          | ❌                    | ✅                       | ❌ (requires header)     | ❌                        |

## Strategy Details

### `fill` (default)
- Guarantees fixed-length records matching the header.
- Object / record-view: missing values become `""`, enabling consistent string-based models.
- Array output: missing values also become empty strings.

### `strict`
- Treats any column-count mismatch as a fatal error, useful for schema validation.
- Requires a header (explicit or inferred).

### `keep`
- Leaves each row untouched. Arrays can vary in length, making it ideal for ragged data or headerless CSVs.
- Headerless mode (`header: []`) enforces `keep`.

### `truncate`
- Drops trailing columns that exceed the header length while leaving short rows untouched.
- Only available when a header is provided (array output).

### `sparse`
- Similar to `fill`, but pads missing entries with `undefined`. This is useful when you want to distinguish between missing and empty values.
- Requires an explicit header to determine the target length.

## Choosing a Strategy

1. **Need strict schema enforcement?** Use `strict`.
2. **Need consistent string values?** Use `fill` (object/record-view default).
3. **Need ragged rows / headerless CSV?** Use `keep` (array output).
4. **Need to ignore trailing columns?** Use `truncate` (array output with header).
5. **Need optional columns?** Use `sparse` (array output with header).

Pair this guide with the [Output Format Guide](./output-format-guide.md) to decide which combination best fits your workload.
