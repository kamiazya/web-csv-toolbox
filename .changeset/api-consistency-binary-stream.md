---
"web-csv-toolbox": minor
---

feat!: rename binary stream APIs for consistency and add BufferSource support

## Summary

This release standardizes the naming of binary stream parsing APIs to match the existing `parseBinary*` family, and extends support to accept any BufferSource type (ArrayBuffer, Uint8Array, and other TypedArray views).

## Breaking Changes

### API Renaming for Consistency

All `parseUint8Array*` functions have been renamed to `parseBinary*` to maintain consistency with existing binary parsing APIs:

**Function Names:**
- `parseUint8ArrayStream()` → `parseBinaryStream()`
- `parseUint8ArrayStreamToStream()` → `parseBinaryStreamToStream()`

**Type Names:**
- `ParseUint8ArrayStreamOptions` → `ParseBinaryStreamOptions`

**Internal Functions (for reference):**
- `parseUint8ArrayStreamInMain()` → `parseBinaryStreamInMain()`
- `parseUint8ArrayStreamInWorker()` → `parseBinaryStreamInWorker()`
- `parseUint8ArrayStreamInWorkerWASM()` → `parseBinaryStreamInWorkerWASM()`

**Rationale:**
The previous naming was inconsistent with the rest of the binary API family (`parseBinary`, `parseBinaryToArraySync`, `parseBinaryToIterableIterator`, `parseBinaryToStream`). The new naming provides:
- Perfect consistency across all binary parsing APIs
- Clear indication that these functions accept any binary data format
- Better predictability for API discovery

### BufferSource Support

`FlexibleBinaryCSVParser` and `BinaryCSVParserStream` now accept `BufferSource` (= `ArrayBuffer | ArrayBufferView`) instead of just `Uint8Array`:

**Before:**
```typescript
const parser = new FlexibleBinaryCSVParser({ header: ['name', 'age'] });
const data = new Uint8Array([...]); // Only Uint8Array
const records = parser.parse(data);
```

**After:**
```typescript
const parser = new FlexibleBinaryCSVParser({ header: ['name', 'age'] });

// Uint8Array still works
const uint8Data = new Uint8Array([...]);
const records1 = parser.parse(uint8Data);

// ArrayBuffer now works directly
const buffer = await fetch('data.csv').then(r => r.arrayBuffer());
const records2 = parser.parse(buffer);

// Other TypedArray views also work
const int8Data = new Int8Array([...]);
const records3 = parser.parse(int8Data);
```

**Benefits:**
- Direct use of `fetch().then(r => r.arrayBuffer())` without conversion
- Flexibility to work with any TypedArray view
- Alignment with Web API standards (BufferSource is widely used)

## Migration Guide

### Automatic Migration

Use find-and-replace in your codebase:

```bash
# Function calls
parseUint8ArrayStream → parseBinaryStream
parseUint8ArrayStreamToStream → parseBinaryStreamToStream

# Type references
ParseUint8ArrayStreamOptions → ParseBinaryStreamOptions
```

### TypeScript Users

If you were explicitly typing with `Uint8Array`, you can now use the more general `BufferSource`:

```typescript
// Before
function processCSV(data: Uint8Array) {
  return parseBinaryStream(data);
}

// After (more flexible)
function processCSV(data: BufferSource) {
  return parseBinaryStream(data);
}
```

## Updated API Consistency

All binary parsing APIs now follow a consistent naming pattern:

```typescript
// Single-value binary data
parseBinary()                   // Binary → AsyncIterableIterator<Record>
parseBinaryToArraySync()        // Binary → Array<Record> (sync)
parseBinaryToIterableIterator() // Binary → IterableIterator<Record>
parseBinaryToStream()           // Binary → ReadableStream<Record>

// Streaming binary data
parseBinaryStream()             // ReadableStream<Uint8Array> → AsyncIterableIterator<Record>
parseBinaryStreamToStream()     // ReadableStream<Uint8Array> → ReadableStream<Record>
```

**Note:** While the stream input type remains `ReadableStream<Uint8Array>` (Web Streams API standard), the internal parsers now accept `BufferSource` for individual chunks.

## Documentation Updates

### README.md
- Updated Low-level APIs section to reflect `parseBinaryStream*` naming
- Added flush procedure documentation for streaming mode
- Added BufferSource examples

### API Reference (docs/reference/package-exports.md)
- Added comprehensive Low-level API Reference section
- Documented all Parser Models (Tier 1) and Lexer + Assembler (Tier 2)
- Included usage examples and code snippets

### Architecture Guide (docs/explanation/parsing-architecture.md)
- Updated Binary CSV Parser section to document BufferSource support
- Added detailed streaming mode examples with flush procedures
- Clarified multi-byte character handling across chunk boundaries

## Flush Procedure Clarification

Documentation now explicitly covers the requirement to call `parse()` without arguments when using streaming mode:

```typescript
const parser = createBinaryCSVParser({ header: ['name', 'age'] });
const encoder = new TextEncoder();

// Process chunks
const records1 = parser.parse(encoder.encode('Alice,30\nBob,'), { stream: true });
const records2 = parser.parse(encoder.encode('25\n'), { stream: true });

// IMPORTANT: Flush remaining data (required!)
const records3 = parser.parse();
```

This prevents data loss from incomplete records or multi-byte character buffers.

## Type Safety

All changes maintain full TypeScript strict mode compliance with proper type inference and generic constraints.
