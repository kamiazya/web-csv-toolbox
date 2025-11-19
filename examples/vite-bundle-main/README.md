# Vite Bundle Example - Main Version

This example demonstrates bundling web-csv-toolbox's main entry point with auto-initialized WASM.

## Features

- Auto-initialization with base64-inlined WASM
- No manual `loadWASM()` call required
- Synchronous WASM parser available immediately
- **Browser test included**

## Bundle Size

Actual bundle sizes vary by bundler and configuration. The main entry embeds WASM and typically produces a larger bundle than the slim entry.

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
1. No `csv.wasm` fetch (WASM is inlined in the bundle)
2. WASM parser works immediately without initialization

## Trade-offs

- ✅ Convenience: No manual initialization required
- ✅ Immediate availability: WASM parser works right away
- ❌ Larger bundle size due to base64-inlined WASM
- ❌ Not optimal for production: Consider using [slim entry](../vite-bundle-slim/) instead

## Comparison with Slim Entry

| Metric | Main | Slim | Difference |
|--------|------|------|------------|
| Bundle size | (varies) | (varies) | Smaller with slim (varies) |
| Gzipped | (varies) | (varies) | Smaller with slim (varies) |
| Initialization | Automatic | Manual (`await loadWASM()`) | - |
| WASM loading | Base64-inlined | Streaming fetch | - |
| Best for | Development/Prototyping | Production | - |
