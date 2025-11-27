---
title: Main vs Slim Entry Points
group: Explanation
---

# Main vs Slim Entry Points

This guide helps you choose between the two distribution entry points:

- `web-csv-toolbox` (Main) — automatic WASM initialization with the WASM embedded in the bundle
- `web-csv-toolbox/slim` (Slim) — manual WASM initialization with the WASM loaded as a separate asset

> Important: There are no feature limitations in Slim. Both Main and Slim export the same full API and support the same functionality. The only differences are WASM initialization strategy and how the WASM binary is delivered/cached.

## TL;DR (Quick Pick)

- Choose **Main** for prototyping and simplicity. WASM is auto-initialized on first use; to minimize first‑parse latency, call `loadWASM()` once at startup (optional but recommended).
- Choose **Slim** for production when you care about smaller JS bundle size and better caching (requires `await loadWASM()` before using WASM).

## Comparison

| Aspect | Main | Slim |
|--------|------|------|
| Initialization | Automatic (first-use) | Manual (`await loadWASM()`) |
| Bundle Size | Larger (WASM embedded) | Smaller (WASM external) |
| Caching | Together with JS | WASM separately cacheable |
| First Parse | Simple but may include auto-init cost | Preload WASM to avoid first-parse cost |
| Synchronous APIs | Available; first use may include auto‑init cost (preload recommended) | Available after `loadWASM()` |
| Worker + WASM | Supported | Supported |
| Typical Use | Dev/prototyping | Production / bundle optimization |

Notes:
- Both entries expose the same APIs. The primary difference is **WASM initialization strategy** and **bundle size/caching**.
- The WASM parser has limitations (UTF-8 only, `"` as quotation). The JavaScript parser supports broader options.

## When to Use Main

Use the main entry (`web-csv-toolbox`) when:
- You want “just works” behavior without extra steps
- Bundle size is less critical than simplicity
- You want to call sync WASM APIs without first awaiting `loadWASM()`

Example (with optional preloading for faster first parse):

```ts
import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox';

// Optional but recommended: preload at app startup to avoid first‑use init cost
await loadWASM();

const rows = parseStringToArraySyncWASM(csv);
```

## When to Use Slim

Use the slim entry (`web-csv-toolbox/slim`) when:
- You care about smaller JS bundles (WASM loaded separately)
- You want better caching strategies for WASM
- You prefer explicit control over WASM initialization timing

Example (Node.js):

```ts
import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox/slim';

await loadWASM();
const rows = parseStringToArraySyncWASM(csv);
```

Example (Vite):

```ts
import { loadWASM, parseString, EnginePresets } from 'web-csv-toolbox/slim';
import workerUrl from 'web-csv-toolbox/worker?url';
import wasmUrl from 'web-csv-toolbox/csv.wasm?url';

await loadWASM(wasmUrl);

for await (const r of parseString(csv, {
  engine: EnginePresets.turbo({ workerURL: workerUrl })
})) {
  // ...
}
```

## Bundlers: Worker + WASM

When using **Workers** and **WASM** together (e.g., `EnginePresets.recommended()`):

1. Provide `workerURL` to your bundler’s worker asset
2. For slim, provide `wasmUrl` to `loadWASM()`

See: [How to Use with Bundlers](../how-to-guides/using-with-bundlers.md)

## Node.js Notes

- Main: No required setup; however, calling `await loadWASM()` at startup reduces first‑parse latency
- Slim: `await loadWASM()` is required; on Node 20.6+ the loader resolves the WASM internally
  - On older Node, pass an explicit URL/Buffer to `loadWASM()`

## Presets and Cleanup

- Prefer `EnginePresets` for common execution modes (e.g., `recommended()`, `turbo()`)
- Use a `ReusableWorkerPool` to bound concurrent workers; prefer `using` if your environment supports Explicit Resource Management, otherwise call `pool.terminate()`

## Migration

Main → Slim:
1. Switch imports to `web-csv-toolbox/slim`
2. Add `await loadWASM()` at app start (with bundlers, pass the emitted `wasmUrl`)
3. (If using Worker) Provide `workerURL` to your bundler’s worker asset

Slim → Main:
1. Switch imports to `web-csv-toolbox`
2. Remove explicit `loadWASM()` (optional: keep it to reduce first-parse latency)

## Troubleshooting

- Worker fails to load (404): Check bundler import (`?url` with Vite, `new URL()` with Webpack)
- WASM compile error: Ensure your WASM file is included and served with a correct URL and MIME type
- CSP: If using data URLs, adjust CSP or configure bundler to emit files instead of data URLs

See: [How to Use with Bundlers](../how-to-guides/using-with-bundlers.md)
