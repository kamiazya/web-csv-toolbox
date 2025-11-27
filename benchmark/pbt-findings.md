# Property-Based Testing Findings: JS vs WASM Behavioral Differences

## Test Configuration
- **Property-Based Testing Tool**: fast-check v4.3.0
- **Test Runs**: 50 per test (seed: 42)
- **Test Date**: 2025-11-25

## Summary

Property-Based Testing revealed **3 critical behavioral differences** between JS and WASM implementations that prevent interoperability and cause inconsistent output.

---

## 1. Empty Field Tokenization (CRITICAL ⚠️)

### Problem
JS and WASM lexers produce different token sequences for empty fields.

### Test Case
```csv
"",""
```

### Behavior

**WASM Output:**
```javascript
[
  { type: "field", value: "" },
  { type: "field-delimiter", value: "," },
  { type: "field", value: "" },
  { type: "record-delimiter", value: "\n" }
]
```

**JS Output:**
```javascript
[
  { type: Symbol(web-csv-toolbox.FieldDelimiter), value: "," },
  { type: Symbol(web-csv-toolbox.RecordDelimiter), value: "\n" }
]
```

### Impact
- Token count mismatch breaks assembler expectations
- Different record structures produced from same CSV input
- Affects all CSV data containing empty fields

### Root Cause
- JS lexer skips emitting field tokens for empty values before delimiters
- WASM lexer always emits field tokens, even for empty values

---

## 2. Trailing Newline Handling (MEDIUM)

### Problem
JS strips trailing record delimiter while WASM preserves it.

### Test Case
```csv
name,city
Alice,東京
Bob,大阪
```
(Note: ends with `\n`)

### Behavior

**WASM Token Count:** 12 tokens (includes final `record-delimiter`)
**JS Token Count:** 11 tokens (final `record-delimiter` stripped)

### Impact
- Token sequence length mismatch
- Different handling of CSV with/without trailing newlines
- Affects end-to-end parsing results

### Root Cause
FlexibleStringCSVLexer.ts:116-121 explicitly strips trailing CRLF/LF:
```typescript
if (this.#flush) {
  // Trim the last CRLF or LF
  if (this.#buffer.endsWith(CRLF)) {
    this.#buffer = this.#buffer.slice(0, -2);
  } else if (this.#buffer.endsWith(LF)) {
    this.#buffer = this.#buffer.slice(0, -1);
  }
}
```

WASM lexer does not implement this stripping behavior.

---

## 3. Token Type Format Incompatibility (HIGH ⚠️)

### Problem
JS uses Symbols for token types, WASM expects strings.

### Error
```
Error: Token 'type' must be a string
  at CSVRecordAssemblerLegacy.assemble
  at WASMCSVObjectRecordAssembler.assemble
```

### Behavior

**JS Token Type:**
```javascript
{ type: Symbol(web-csv-toolbox.Field), value: "data" }
```

**WASM Expected Type:**
```javascript
{ type: "field", value: "data" }
```

### Impact
- **BLOCKS INTEROPERABILITY**: Cannot use JS Lexer output with WASM Assembler
- **BLOCKS INTEROPERABILITY**: Cannot pass JS-generated tokens to WASM components
- Prevents mixing JS and WASM components in processing pipeline

### Root Cause
- core/constants.ts defines token types as Symbols for JS:
  ```typescript
  export const Field = Symbol("web-csv-toolbox.Field");
  export const FieldDelimiter = Symbol("web-csv-toolbox.FieldDelimiter");
  export const RecordDelimiter = Symbol("web-csv-toolbox.RecordDelimiter");
  ```
- WASM Rust code uses string literals:
  ```rust
  token.type = "field"
  token.type = "field-delimiter"
  token.type = "record-delimiter"
  ```

---

## Test Results

### Lexer Comparison
| Test | Status | Notes |
|------|--------|-------|
| Simple CSV data | ❌ FAIL | Empty field handling mismatch |
| Streaming mode | ❌ FAIL | Empty field handling mismatch |
| Quoted fields with special chars | ❌ FAIL | Trailing newline mismatch |
| UTF-8 characters | ❌ FAIL | Trailing newline mismatch |

### Assembler Comparison
| Test | Status | Notes |
|------|--------|-------|
| Records from tokens | ❌ FAIL | Token type format incompatibility |
| Missing fields | ❌ FAIL | Token type format incompatibility |

### Parser Comparison (End-to-End)
| Test | Status | Notes |
|------|--------|-------|
| Simple CSV data | ❌ FAIL | Combined lexer differences |
| Streaming mode | ❌ FAIL | Combined lexer differences |
| Quoted fields | ✅ PASS | - |
| UTF-8 characters | ✅ PASS | - |

**Pass Rate**: 2/10 tests (20%)

---

## Recommendations

### Priority 1: Fix Token Type Incompatibility (Blocking)
**Option A** (Recommended): Update WASM to use Symbol-compatible types
- Modify WASM TypeScript wrappers to convert string types to Symbols on output
- Modify WASM Rust to accept both string and Symbol types on input

**Option B**: Update JS to use strings
- Breaking change, affects all existing code
- Not recommended

### Priority 2: Fix Empty Field Handling
**Option A** (Recommended): Update WASM to match JS behavior
- Skip emitting field tokens for empty values before delimiters
- Maintains consistency with established JS behavior

**Option B**: Update JS to match WASM behavior
- Potentially breaking change
- May be more semantically correct (explicit empty fields)

### Priority 3: Fix Trailing Newline Handling
**Option A** (Recommended): Update WASM to strip trailing record delimiter
- Add the same logic as FlexibleStringCSVLexer.ts:116-121
- Maintains consistency

**Option B**: Update JS to preserve trailing delimiter
- Potentially breaking change
- May affect existing consumers

---

## Action Items

1. ✅ **COMPLETED**: Implement Property-Based Testing framework
2. ✅ **COMPLETED**: Identify behavioral differences
3. ⏳ **IN PROGRESS**: Document findings (this report)
4. ⬜ **TODO**: Fix WASM implementations to match JS behavior
5. ⬜ **TODO**: Verify fixes with PBT
6. ⬜ **TODO**: Add regression tests for identified issues

---

## Test Code Location

Property-Based Test Suite: `src/parser/models/pbt-js-vs-wasm.test.ts`

Run with:
```bash
pnpm test src/parser/models/pbt-js-vs-wasm.test.ts
```
