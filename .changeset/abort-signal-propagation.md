---
web-csv-toolbox: patch
---

Fix AbortSignal propagation in Transform Stream components

This release fixes a security vulnerability where AbortSignal was not properly propagated through the Transform Stream pipeline, allowing processing to continue even after abort requests.

**Fixed Issues:**

- Fixed `LexerTransformer` to accept and propagate `AbortSignal` to internal `Lexer` instance
- Fixed `RecordAssemblerTransformer` to properly propagate `AbortSignal` to internal `RecordAssembler` instance
- Added comprehensive tests for AbortSignal propagation in Transform Stream components
- Added `waitAbort` helper function to handle race conditions in AbortSignal tests
- Improved constructor initialization order in both Transformer classes for better code clarity

**Code Quality Improvements:**

- Added `LexerTransformerOptions` type definition for better type consistency across Transformer classes
- Refactored constructors to initialize local variables before `super()` calls, improving code readability
- Removed redundant type intersections in `RecordAssemblerTransformer`
- Eliminated code duplication by moving test helpers to shared location

**Security Impact:**

This fix addresses a medium-severity security issue where attackers could bypass abort signals in streaming CSV processing. Without this fix, malicious actors could send large CSV payloads and continue consuming system resources (CPU, memory) even after cancellation attempts, potentially causing service degradation or temporary resource exhaustion.

**Before this fix:**
```ts
const controller = new AbortController();
const stream = largeCSVStream
  .pipeThrough(new LexerTransformer({ signal: controller.signal }))
  .pipeThrough(new RecordAssemblerTransformer({ signal: controller.signal }));

controller.abort(); // Signal was ignored - processing continued!
```

**After this fix:**
```ts
const controller = new AbortController();
const stream = largeCSVStream
  .pipeThrough(new LexerTransformer({ signal: controller.signal }))
  .pipeThrough(new RecordAssemblerTransformer({ signal: controller.signal }));

controller.abort(); // Processing stops immediately with AbortError
```

Users processing untrusted CSV streams should ensure they implement proper timeout and abort signal handling to prevent resource exhaustion.
