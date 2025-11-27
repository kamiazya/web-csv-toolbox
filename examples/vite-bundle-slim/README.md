# Vite Bundle Example - Slim Entry

This example demonstrates bundling web-csv-toolbox's slim entry point with streaming WASM loading.

## Features

- Streaming WASM loading (no base64 inlining)
- Requires manual `loadWASM()` call
- ~110KB smaller bundle size
- **Browser test included to verify WASM streaming**

## Bundle Size

```
dist/bundle.js  2.08 kB │ gzip: 0.96 kB
```

**Bundle Size Comparison:**
- Main entry: 113.98 kB (gzip: 54.70 kB)
- Slim entry: 2.08 kB (gzip: 0.96 kB)
- **Smaller main bundle by loading WASM externally**

## Usage

```typescript
import { loadWASM, parseString } from 'web-csv-toolbox/slim';

// Manual WASM initialization required (streaming load)
await loadWASM();

const csv = 'name,age\nAlice,30\nBob,25';
const result = parseString.toArraySync(csv, { engine: { wasm: true } });
console.log(result);
```

## Build

```bash
pnpm install
pnpm run build
```

## Test in Browser

### Development Server

```bash
pnpm run dev
```

Then open http://localhost:5173 in your browser.

### Preview Built Bundle

```bash
pnpm run build
pnpm run preview
```

Then open http://localhost:4173 in your browser.

### What to Check

Open DevTools Network tab and verify:
1. `csv.wasm` is loaded via **fetch** (not inlined in bundle.js)
2. WASM file is **streamed** and compiled during download
3. Bundle size is ~2 kB (not ~114 kB like main version)

## Trade-offs

- ✅ Smaller main bundle (WASM external)
- ✅ Better for production: WASM loaded via streaming
- ❌ Manual initialization: Must call `await loadWASM()` first
- ❌ Async requirement: Cannot use sync WASM parser immediately

## WASM Streaming Verification

The slim entry loads WASM via streaming fetch, which is more efficient for production use:

1. WASM binary is fetched separately (not inlined)
2. WASM module is compiled during streaming
3. Smaller initial bundle size
4. Better caching behavior

You can verify this by:
1. Opening the browser DevTools Network tab
2. Running the example
3. Looking for `csv.wasm` request
4. Checking that `bundle.js` is only ~2 kB
