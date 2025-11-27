# Vite Bundle Worker (Slim Variant) Example

This example demonstrates how to use `web-csv-toolbox` **slim variant** with Vite, featuring Worker-based parsing and WASM support for browser applications.

## Features Demonstrated

- ✅ **Slim variant** usage (`web-csv-toolbox/slim`)
- ✅ **Manual WASM initialization** (slim variant requires explicit `loadWASM()`)
- ✅ **Worker-based parsing** for non-blocking CSV processing
- ✅ **WASM acceleration** in Web Workers
- ✅ **Parallel processing** with multiple Workers
- ✅ **Smaller bundle size** compared to main variant

## Main vs Slim Variant

### Main Variant (`web-csv-toolbox`)
- **Pros**: Auto-initialization, WASM embedded (base64 inline)
- **Cons**: Larger bundle size (~100KB+ for WASM)
- **Use case**: Convenience, when bundle size is not critical

### Slim Variant (`web-csv-toolbox/slim`)
- **Pros**: Smaller initial bundle, WASM loaded on-demand
- **Cons**: Requires manual WASM initialization with `loadWASM()`
- **Use case**: **This example** - optimized bundle size, WASM loaded as separate asset

## Key Configuration Points

### 1. Import from Slim Entry Point

```typescript
import { parseString, ReusableWorkerPool, loadWASM } from "web-csv-toolbox/slim";
```

**Important**: Use `web-csv-toolbox/slim` instead of `web-csv-toolbox`.

### 2. Import WASM and Worker URLs

```typescript
// Import slim worker bundle
import workerUrl from "web-csv-toolbox/worker/slim?url";

// Import WASM file as asset
import wasmUrl from "web-csv-toolbox/csv.wasm?url";
```

**Important**: The `?url` suffix tells Vite to emit the file as an asset and return its URL.

### 3. Initialize WASM Before Use

```typescript
// Call loadWASM() before using WASM features
await loadWASM(wasmUrl);

// Now you can use WASM-accelerated parsing
for await (const record of parseString(csv, {
  engine: {
    worker: true,
    wasm: true,  // WASM must be initialized first
    workerPool: pool,
  }
})) {
  // Process records...
}
```

**Important**: Slim variant requires explicit WASM initialization. Without it, WASM-based parsing will fail.

### 4. Vite Configuration

```typescript
// vite.config.ts
export default defineConfig({
  resolve: {
    // Ensure browser build is selected for web-csv-toolbox
    conditions: ['browser', 'import', 'module', 'default'],
    mainFields: ['browser', 'module', 'main'],
  },
  // Include WASM files in build output
  assetsInclude: ['**/*.wasm'],
});
```

**Key points**:
- **`resolve.conditions`**: Ensures Vite uses browser-compatible builds
- **`assetsInclude`**: Required to include `.wasm` files in the build output

## Running This Example

### Development Mode

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173 in your browser and test the features:

1. **Test 0**: Basic parsing (no Worker, no WASM)
2. **Test 1**: Worker with JavaScript engine (non-blocking)
3. **Test 2**: Worker + WASM (non-blocking, accelerated)
4. **Test 3**: Parallel processing with multiple Workers

### Production Build

```bash
pnpm build
pnpm preview
```

Check the `dist/` folder to verify:
- Worker bundle is included (`worker.slim.web.bundle-*.js`)
- WASM file is included (`csv-*.wasm`)

## Bundle Size Comparison

### Slim Variant (This Example)
```
dist/assets/index-[hash].js          ~15-20 KB (gzip)
dist/assets/worker.slim.web.bundle-[hash].js  ~40-45 KB (gzip)
dist/assets/csv-[hash].wasm           ~41 KB (gzip)
Total: ~96-106 KB (gzip)
```

**Benefit**: WASM is loaded only when needed (lazy loading possible).

### Main Variant (Alternative)
```
dist/assets/index-[hash].js          ~55-60 KB (gzip, includes inlined WASM)
dist/assets/worker.web.bundle-[hash].js  ~85-90 KB (gzip, includes inlined WASM)
Total: ~140-150 KB (gzip)
```

**Trade-off**: Larger bundle, but no separate WASM file management needed.

## Common Pitfalls

### ❌ Forgetting WASM Initialization

```typescript
// This will FAIL with slim variant!
for await (const record of parseString(csv, {
  engine: { worker: true, wasm: true, workerPool: pool }
})) {
  // Error: WASM not initialized
}
```

**Fix**: Call `await loadWASM(wasmUrl)` first.

### ❌ Missing `assetsInclude` Configuration

Without `assetsInclude: ['**/*.wasm']`, Vite may not include the WASM file in the build output, causing runtime errors.

**Fix**: Add `assetsInclude` to `vite.config.ts`.

### ❌ Importing from Wrong Entry Point

```typescript
// Wrong - using main variant
import { parseString } from "web-csv-toolbox";

// Correct - using slim variant
import { parseString, loadWASM } from "web-csv-toolbox/slim";
```

## Worker Configuration

The example uses `ReusableWorkerPool` to manage Workers:

```typescript
// TODO: When Node.js 24 becomes the minimum supported version, use:
// using pool = new ReusableWorkerPool({ maxWorkers: 2, workerURL: workerUrl });
const pool = new ReusableWorkerPool({
  maxWorkers: 2,
  workerURL: workerUrl,
});

try {
  for await (const record of parseString(csv, {
    engine: {
      worker: true,
      wasm: true,
      workerPool: pool,
    }
  })) {
    // Process record
  }
} finally {
  pool.terminate();
}
```

**Note**: When Node.js 24 becomes the minimum supported version, you can use `using` syntax for automatic resource management instead of try-finally.

## Related Examples

- **[vite-bundle-worker](../vite-bundle-worker/)** - Main variant with auto-initialization
- **[webpack-bundle-worker](../webpack-bundle-worker/)** - Webpack equivalent
- **[deno-bundle-worker](../deno-bundle-worker/)** - Deno equivalent

## Learn More

- [web-csv-toolbox Documentation](../../README.md)
- [Source Code Architecture](../../src/README.md)
- [Vite Documentation](https://vitejs.dev/)
