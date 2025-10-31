---
web-csv-toolbox: minor
---

Add environment-specific compression format support for better cross-browser and Node.js compatibility

This release adjusts the supported compression formats based on the runtime environment to ensure reliability and prevent errors across different browsers and Node.js versions.

**Changes:**

- **Browser environments**: Support `gzip` and `deflate` only (universal cross-browser support)
- **Node.js 20+ environments**: Support `gzip`, `deflate`, and `br` (Brotli)

**Rationale:**

Previously, browser builds included `deflate-raw` in the default supported formats. However, `deflate-raw` is only supported in Chromium-based browsers (Chrome, Edge) and not in Firefox or Safari. To ensure the library works reliably across all modern browsers by default, we now only include universally supported formats.

**Browser Compatibility:**

| Format | Chrome/Edge | Firefox | Safari | Included by Default |
|--------|-------------|---------|--------|---------------------|
| `gzip` | ✅ | ✅ | ✅ | ✅ Yes |
| `deflate` | ✅ | ✅ | ✅ | ✅ Yes |
| `deflate-raw` | ✅ | ❌ | ❌ | ❌ No (experimental) |

**Using Experimental Compressions:**

If you need to use `deflate-raw` or other non-standard compression formats in Chromium-based browsers, you can enable them with the `allowExperimentalCompressions` option:

```typescript
// Use deflate-raw in Chrome/Edge (may fail in Firefox/Safari)
const response = await fetch('data.csv'); // Content-Encoding: deflate-raw
await parseResponse(response, {
  allowExperimentalCompressions: true
});
```

You can also detect browser support at runtime:

```typescript
// Browser-aware usage
const isChromium = navigator.userAgent.includes('Chrome');
await parseResponse(response, {
  allowExperimentalCompressions: isChromium
});
```

**Migration Guide:**

For users who were relying on `deflate-raw` in browser environments:

1. **Option 1**: Use `gzip` or `deflate` compression instead (recommended for cross-browser compatibility)
   ```typescript
   // Server-side: Use gzip instead of deflate-raw
   response.headers.set('content-encoding', 'gzip');
   ```

2. **Option 2**: Enable experimental compressions for Chromium-only deployments
   ```typescript
   await parseResponse(response, {
     allowExperimentalCompressions: true
   });
   // Works in Chrome/Edge, may fail in Firefox/Safari
   ```

3. **Option 3**: Detect browser support and handle fallbacks
   ```typescript
   try {
     await parseResponse(response, {
       allowExperimentalCompressions: true
     });
   } catch (error) {
     // Fallback for browsers that don't support the format
     console.warn('Compression format not supported, using uncompressed');
   }
   ```

**Implementation:**

The supported compressions are now determined at build time using package.json `imports` field:
- Browser/Web builds use `getOptionsFromResponse.constants.web.js`
- Node.js builds use `getOptionsFromResponse.constants.node.js`

This ensures type-safe, environment-appropriate compression support.

**No changes required** for users already using `gzip` or `deflate` compression in browsers, or `gzip`, `deflate`, or `br` in Node.js.
