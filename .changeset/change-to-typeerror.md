---
web-csv-toolbox: minor
---

**BREAKING CHANGE**: Change error types from RangeError to TypeError for consistency with Web Standards

- Change all `RangeError` to `TypeError` for consistency
- This affects error handling in:
  - `getOptionsFromResponse()`: Invalid MIME type, unsupported/multiple content-encodings
  - `parseResponse()`: Null response body
  - `parseResponseToStream()`: Null response body
- Aligns with Web Standard APIs behavior (DecompressionStream throws TypeError)
- Improves consistency for error handling with `catch (error instanceof TypeError)`

**Migration guide:**
If you were catching `RangeError` from `getOptionsFromResponse()`, update to catch `TypeError` instead:

```diff
- } catch (error) {
-   if (error instanceof RangeError) {
+ } catch (error) {
+   if (error instanceof TypeError) {
      // Handle invalid content type or encoding
    }
  }
```

### New feature: Experimental compression format support
- Add `allowExperimentalCompressions` option to enable experimental/non-standard compression formats
- **Browsers**: By default, only `gzip` and `deflate` are supported (cross-browser compatible)
- **Node.js**: By default, `gzip`, `deflate`, and `br` (Brotli) are supported
- When enabled, allows platform-specific formats like `deflate-raw` (Chrome/Edge only)
- Provides flexibility for environment-specific compression formats
- See documentation for browser compatibility details and usage examples

**Other improvements in this release:**
- Add Content-Encoding header validation with RFC 7231 compliance
- Normalize Content-Encoding header: convert to lowercase, trim whitespace
- Ignore empty or whitespace-only Content-Encoding headers
- Add comprehensive tests for Content-Encoding validation (23 tests)
- Add security documentation with TransformStream size limit example
- Error messages now guide users to `allowExperimentalCompressions` option when needed
