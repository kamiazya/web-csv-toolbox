/**
 * Slim version of web-csv-toolbox with smaller bundle size (Browser/Web version).
 *
 * **Key Differences from main entry:**
 * - Does NOT include base64-inlined WASM (smaller bundle size)
 * - Requires manual WASM initialization via `loadWasm(wasmUrl)`
 * - Uses streaming WASM loading instead of synchronous base64 loading
 *
 * **Trade-offs:**
 * - ✅ Smaller bundle size
 * - ✅ Uses streaming WASM loading (better for production)
 * - ❌ Requires manual `await loadWasm(wasmUrl)` before using WASM-based APIs
 * - ❌ No automatic WASM initialization
 *
 * **Architecture:**
 * - Common exports are in `slim.shared.ts`
 * - This file only contains Web-specific exports
 * - Build-time resolution: Vite plugin resolves `#/wasm/loaders/*` imports based on entry file name
 * - WASM loader selection: `.web.ts` → uses `loadWasm.web.ts` (streaming fetch)
 *
 * @example Basic usage (recommended)
 * ```ts
 * import { loadWasm, parseStringToArraySyncWasm } from 'web-csv-toolbox/slim';
 * import wasmUrl from 'web-csv-toolbox/csv.wasm?url';
 *
 * // REQUIRED: Manual initialization with WASM URL
 * await loadWasm(wasmUrl);
 *
 * // Now you can use WASM-based APIs
 * const result = parseStringToArraySyncWasm(csv);
 * ```
 *
 * @example Custom WASM URL
 * ```ts
 * import { loadWasm, parseStringToArraySyncWasm } from 'web-csv-toolbox/slim';
 *
 * // Load from custom URL (e.g., CDN)
 * await loadWasm('https://cdn.example.com/csv.wasm');
 *
 * const result = parseStringToArraySyncWasm(csv);
 * ```
 *
 * @packageDocumentation
 */
/** biome-ignore-all assist/source/organizeImports: For sort by category */

// ============================================================================
// Shared exports (re-export from slim.shared.ts)
// ============================================================================
export * from "@/slim.shared.ts";

// ============================================================================
// Web-specific: Worker helpers
// ============================================================================
export * from "@/worker/helpers/ReusableWorkerPool.web.ts";

// ============================================================================
// Web-specific: WASM - Streaming initialization only (no base64 inlining)
// ============================================================================
export {
  ensureWasmInitialized,
  isWasmReady,
  loadWasm,
  resetInit,
} from "@/wasm/WasmInstance.slim.ts";

// Re-export all WASM functions from WasmInstance.slim.ts
export * from "@/wasm/WasmInstance.slim.ts";
