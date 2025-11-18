/**
 * Lite entry point for web-csv-toolbox with manual initialization (Node.js version).
 *
 * This version requires manual WASM initialization via `loadWASM()`,
 * providing smaller bundle size by fetching WASM at runtime,
 * optimized for Node.js environment.
 *
 * **Note:** This file has an identical implementation to `lite.web.ts`, but they must be
 * kept separate because:
 * - Build-time resolution: Vite plugin resolves `#/wasm/loaders/*` imports differently based on entry file name
 * - WASM loader selection: `.web.ts` → uses `loadWASM.web.ts` (streaming fetch)
 *                          `.node.ts` → uses `loadWASM.node.ts` (fs.readFile)
 * - The import paths are embedded during build, so runtime conditional exports alone cannot fix this
 *
 * @packageDocumentation
 */
/** biome-ignore-all assist/source/organizeImports: For sort by category */

// ============================================================================
// Shared exports (common to both main and lite versions)
// ============================================================================
export * from "@/_shared.ts";

// ============================================================================
// Worker helpers (Node.js-specific imports)
// ============================================================================
export * from "@/worker/helpers/ReusableWorkerPool.node.ts";
export * from "@/worker/helpers/WorkerSession.ts";

// ============================================================================
// Lite-specific: Manual WASM initialization
// ============================================================================
export { parseStringToArraySyncWASM } from "@/parser/api/string/parseStringToArraySyncWASM.lite.ts";

/**
 * WASM initialization functions (Node.js optimized)
 *
 * The lite version requires manual WASM initialization.
 * Call loadWASM() before using WASM-powered functions like parseStringToArraySyncWASM.
 */
export {
  ensureWASMInitialized,
  isWASMReady,
  loadWASM,
  resetInit,
} from "@/wasm/WasmInstance.lite.node.ts";

// Re-export all other WASM functions for unified API
export * from "@/wasm/WasmInstance.lite.node.ts";
