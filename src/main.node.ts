/**
 * Main entry point for web-csv-toolbox with auto-initialization (Node.js version).
 *
 * This version includes base64-inlined WASM for automatic initialization,
 * optimized for Node.js environment.
 *
 * **Architecture:**
 * - Common exports are in `main.shared.ts`
 * - This file only contains Node.js-specific exports
 * - Build-time resolution: Vite plugin resolves `#/wasm/loaders/*` imports based on entry file name
 * - WASM loader selection: `.node.ts` → uses `loadWASM.node.ts` (Buffer.from + fs.readFile)
 *
 * @packageDocumentation
 */
/** biome-ignore-all assist/source/organizeImports: For sort by category */

// ============================================================================
// Shared exports (re-export from main.shared.ts)
// ============================================================================
export * from "@/main.shared.ts";

// ============================================================================
// Node.js-specific: WASM functions
// ============================================================================
export * from "@/wasm/WasmInstance.main.node.ts";

// ============================================================================
// Node.js-specific: Worker helpers
// ============================================================================
export * from "@/worker/helpers/ReusableWorkerPool.node.ts";
