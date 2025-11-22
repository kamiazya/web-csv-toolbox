---
"web-csv-toolbox": minor
---

feat: introduce "slim" entry point for optimized bundle size

This release introduces a new `slim` entry point that significantly reduces bundle size by excluding the inlined WebAssembly binary.

### New Entry Points

The package now offers two distinct entry points:

1.  **Main (`web-csv-toolbox`)**: The default entry point.
    * **Features:** Zero-configuration, works out of the box.
    * **Trade-off:** Includes the WASM binary inlined as base64 (~110KB), resulting in a larger bundle size.
    * **Best for:** Prototyping, quick starts, or when bundle size is not a critical constraint.

2.  **Slim (`web-csv-toolbox/slim`)**: The new optimized entry point.
    * **Features:** Smaller bundle size, streaming WASM loading.
    * **Trade-off:** Requires manual initialization of the WASM binary.
    * **Best for:** Production applications where bundle size and load performance are critical.

### How to use the "Slim" version

When using the slim version, you must manually load the WASM binary before using any WASM-dependent features (like `parseStringToArraySyncWASM` or high-performance parsing presets).

```typescript
import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox/slim';
// You need to provide the URL to the WASM file
import wasmUrl from 'web-csv-toolbox/csv.wasm?url';

async function init() {
  // 1. Manually initialize WASM
  await loadWASM(wasmUrl);

  // 2. Now you can use WASM-powered functions
  const data = parseStringToArraySyncWASM('a,b,c\n1,2,3');
  console.log(data);
}

init();
```

### Worker Exports

Corresponding worker exports are also available:
* `web-csv-toolbox/worker` (Main)
* `web-csv-toolbox/worker/slim` (Slim)
