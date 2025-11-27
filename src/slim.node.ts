/**
 * Slim entry point for web-csv-toolbox with manual initialization (Node.js version).
 *
 * This version requires manual WASM initialization via `loadWASM()`,
 * providing smaller bundle size by fetching WASM at runtime,
 * optimized for Node.js environment.
 *
 * **Architecture:**
 * - Common exports are in `slim.shared.ts`
 * - This file only contains Node.js-specific exports
 * - Build-time resolution: Vite plugin resolves `#/wasm/loaders/*` imports based on entry file name
 * - WASM loader selection: `.node.ts` → uses `loadWASM.node.ts` (fs.readFile)
 *
 * @packageDocumentation
 */
/** biome-ignore-all assist/source/organizeImports: For sort by category */

// ============================================================================
// Shared exports (re-export from slim.shared.ts)
// ============================================================================
export * from "@/slim.shared.ts";

// ============================================================================
// Node.js-specific: Worker helpers
// ============================================================================
export * from "@/worker/helpers/ReusableWorkerPool.node.ts";

// ============================================================================
// Node.js-specific: WASM initialization
// ============================================================================

/**
 * WASM initialization functions (Node.js optimized)
 *
 * The slim version requires manual WASM initialization.
 * Call loadWASM() before using WASM-powered functions with { engine: { wasm: true } }.
 */
export {
  ensureWASMInitialized,
  isWASMReady,
  loadWASM,
  resetInit,
} from "@/wasm/WasmInstance.slim.node.ts";

// Re-export all other WASM functions for unified API
export * from "@/wasm/WasmInstance.slim.node.ts";
