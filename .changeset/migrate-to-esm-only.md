---
"web-csv-toolbox": minor
---

Migrate to ESM-only distribution

This release removes CommonJS (CJS) and UMD build outputs, distributing only ES modules (ESM). All build artifacts are now placed directly in the `dist/` directory for a simpler and cleaner structure.

### Breaking Changes

- **Removed CommonJS support**: The package no longer provides `.cjs` files. Node.js projects must use ES modules.
- **Removed UMD bundle**: The UMD build (`dist/web-csv-toolbox.umd.js`) has been removed. For CDN usage, use ESM via `<script type="module">`.
- **Changed distribution structure**: Build outputs moved from `dist/es/`, `dist/cjs/`, and `dist/types/` to `dist/` root directory.
- **Removed `build:browser` command**: The separate UMD build step is no longer needed.

### Migration Guide

**For Node.js users:**
- Ensure your project uses `"type": "module"` in `package.json`, or use `.mjs` file extensions
- Update any CommonJS `require()` calls to ESM `import` statements
- Node.js 20.x or later is required (already the minimum supported version)

**For CDN users:**
Before:
```html
<script src="https://unpkg.com/web-csv-toolbox"></script>
```

After:
```html
<script type="module">
import { parse } from 'https://unpkg.com/web-csv-toolbox';
</script>
```

**For bundler users:**
No changes required - modern bundlers handle ESM correctly.

### Benefits

- Simpler build configuration and faster build times
- Smaller package size
- Cleaner distribution structure
- Alignment with modern JavaScript ecosystem standards
