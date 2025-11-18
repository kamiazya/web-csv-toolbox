/**
 * Lite version of web-csv-toolbox with smaller bundle size (Browser/Web version).
 *
 * **Key Differences from main entry:**
 * - Does NOT include base64-inlined WASM (~110KB saved)
 * - Requires manual WASM initialization via `loadWASM(wasmUrl)`
 * - Uses streaming WASM loading instead of synchronous base64 loading
 *
 * **Trade-offs:**
 * - ✅ ~110KB smaller bundle size
 * - ✅ Uses streaming WASM loading (better for production)
 * - ❌ Requires manual `await loadWASM(wasmUrl)` before using WASM-based APIs
 * - ❌ No automatic WASM initialization
 *
 * **Note:** This file has an identical implementation to `lite.node.ts`, but they must be
 * kept separate because:
 * - Build-time resolution: Vite plugin resolves `#/wasm/loaders/*` imports differently based on entry file name
 * - WASM loader selection: `.web.ts` → uses `loadWASM.web.ts` (streaming fetch)
 *                          `.node.ts` → uses `loadWASM.node.ts` (fs.readFile)
 * - The import paths are embedded during build, so runtime conditional exports alone cannot fix this
 *
 * @example Basic usage (recommended)
 * ```ts
 * import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox/lite';
 * import wasmUrl from 'web-csv-toolbox/csv.wasm?url';
 *
 * // REQUIRED: Manual initialization with WASM URL
 * await loadWASM(wasmUrl);
 *
 * // Now you can use WASM-based APIs
 * const result = parseStringToArraySyncWASM(csv);
 * ```
 *
 * @example Custom WASM URL
 * ```ts
 * import { loadWASM, parseStringToArraySyncWASM } from 'web-csv-toolbox/lite';
 *
 * // Load from custom URL (e.g., CDN)
 * await loadWASM('https://cdn.example.com/csv.wasm');
 *
 * const result = parseStringToArraySyncWASM(csv);
 * ```
 *
 * @packageDocumentation
 */
/** biome-ignore-all assist/source/organizeImports: For sort by category */

// ============================================================================
// Shared exports (common to both main and lite versions)
// ============================================================================
export * from "@/_shared.ts";

// ============================================================================
// Worker helpers (Web-specific imports)
// ============================================================================
export * from "@/worker/helpers/ReusableWorkerPool.web.ts";
export * from "@/worker/helpers/WorkerSession.ts";

// ============================================================================
// Lite-specific: Sync WASM APIs - Require manual loadWASM() first
// ============================================================================
export { parseStringToArraySyncWASM } from "@/parser/api/string/parseStringToArraySyncWASM.lite.ts";

// ============================================================================
// Lite-specific: WASM - Streaming initialization only (no base64 inlining)
// ============================================================================
export {
  ensureWASMInitialized,
  isWASMReady,
  loadWASM,
  resetInit,
} from "@/wasm/WasmInstance.lite.ts";

// Re-export all WASM functions from WasmInstance.lite.ts
export * from "@/wasm/WasmInstance.lite.ts";
