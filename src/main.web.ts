/**
 * Main entry point for web-csv-toolbox with auto-initialization (Browser/Web version).
 *
 * This version includes base64-inlined WASM for automatic initialization.
 *
 * **Architecture:**
 * - Common exports are in `main.shared.ts`
 * - This file only contains Web-specific exports
 * - Build-time resolution: Vite plugin resolves `#/wasm/loaders/*` imports based on entry file name
 * - WASM loader selection: `.web.ts` → uses `loadWASM.web.ts` (Uint8Array.fromBase64 + fetch)
 *
 * @packageDocumentation
 */
/** biome-ignore-all assist/source/organizeImports: For sort by category */

// ============================================================================
// Shared exports (re-export from main.shared.ts)
// ============================================================================
export * from "@/main.shared.ts";

// ============================================================================
// Web-specific: WASM functions
// ============================================================================
export * from "@/parser/api/string/parseStringToArraySyncWASM.main.web.ts";

// ============================================================================
// Web-specific: Worker helpers
// ============================================================================
export * from "@/worker/helpers/ReusableWorkerPool.web.ts";
