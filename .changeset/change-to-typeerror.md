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
- Add `allowExperimentalCompressions` option to enable future/experimental compression formats
- By default, only known formats are allowed: gzip, deflate, deflate-raw
- When enabled, unknown formats are passed to runtime (e.g., Brotli if runtime supports it)
- Provides forward compatibility with future compression formats without library updates
- See documentation for usage examples and cautions

**Other improvements in this release:**
- Add Content-Encoding header validation with RFC 7231 compliance
- Normalize Content-Encoding header: convert to lowercase, trim whitespace
- Ignore empty or whitespace-only Content-Encoding headers
- Add comprehensive tests for Content-Encoding validation (23 tests)
- Add security documentation with TransformStream size limit example
- Error messages now guide users to `allowExperimentalCompressions` option when needed
