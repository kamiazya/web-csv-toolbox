/**
 * Main entry point for web-csv-toolbox with auto-initialization (Node.js version).
 *
 * This version includes base64-inlined WASM for automatic initialization,
 * optimized for Node.js environment.
 *
 * **Note:** This file has an identical implementation to `main.web.ts`, but they must be
 * kept separate because:
 * - Build-time resolution: Vite plugin resolves `#/wasm/loaders/*` imports differently based on entry file name
 * - WASM loader selection: `.web.ts` → uses `loadWASM.web.ts` (Uint8Array.fromBase64)
 *                          `.node.ts` → uses `loadWASM.node.ts` (Buffer.from)
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
export * from "@/worker/helpers/ReusableWorkerPool.ts";
export * from "@/worker/helpers/WorkerSession.ts";

// ============================================================================
// Main-specific: WASM with auto-initialization
// ============================================================================
export * from "@/parser/api/string/parseStringToArraySyncWASM.main.ts";
export * from "@/wasm/WasmInstance.main.ts";
