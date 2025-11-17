# Vite Bundle Example - Main Version

This example demonstrates bundling web-csv-toolbox's main entry point with auto-initialized WASM.

## Features

- Auto-initialization with base64-inlined WASM
- No manual `loadWASM()` call required
- Synchronous WASM parser available immediately
- **Browser test included**

## Bundle Size

```
dist/index.html    2.05 kB │ gzip:  0.88 kB
dist/bundle.js   115.31 kB │ gzip: 55.38 kB
```

## Usage

```typescript
import { parseStringToArraySyncWASM } from 'web-csv-toolbox';

// No loadWASM() needed - auto-initialized!
const csv = 'name,age\nAlice,30\nBob,25';
const result = parseStringToArraySyncWASM(csv);
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
1. No `csv.wasm` fetch (WASM is inlined in bundle.js)
2. Bundle size is ~115 kB
3. WASM parser works immediately without initialization

## Trade-offs

- ✅ Convenience: No manual initialization required
- ✅ Immediate availability: WASM parser works right away
- ❌ Bundle size: +112 KB due to base64-inlined WASM
- ❌ Not optimal for production: Consider using [lite version](../vite-bundle-lite/) instead

## Comparison with Lite Version

| Metric | Main | Lite | Difference |
|--------|------|------|------------|
| Bundle size | 115.31 kB | 3.43 kB | -111.88 kB (-97.0%) |
| Gzipped | 55.38 kB | 1.53 kB | -53.85 kB (-97.2%) |
| Initialization | Automatic | Manual (`await loadWASM()`) | - |
| WASM loading | Base64-inlined | Streaming fetch | - |
| Best for | Development/Prototyping | Production | - |
