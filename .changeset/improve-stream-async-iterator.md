---
web-csv-toolbox: patch
---

Improve ReadableStream to AsyncIterableIterator conversion with native async iteration support

**Performance Improvements:**

- `convertStreamToAsyncIterableIterator` now preferentially uses native `Symbol.asyncIterator` when available
- Provides better performance in modern browsers and runtimes
- Falls back to manual reader-based iteration for Safari and older environments
- Improved condition check to verify async iterator is actually callable

**Resource Management Improvements:**

- Added proper error handling with `reader.cancel(error)` to release underlying resources on error
- Cancel errors are gracefully ignored when already in error state
- `reader.releaseLock()` is always called in `finally` block for reliable cleanup
- Prevents potential memory leaks from unreleased stream locks
