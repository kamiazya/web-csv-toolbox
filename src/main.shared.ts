/**
 * Shared exports for main entry point (both Node.js and Web versions).
 *
 * This file contains all exports that are common between main.node.ts and main.web.ts.
 * Environment-specific exports (like ReusableWorkerPool) are handled in the respective
 * .node.ts and .web.ts files.
 *
 * **Architecture Pattern:**
 * - `main.shared.ts` - Common exports (this file)
 * - `main.node.ts` - Node.js-specific exports + re-exports from main.shared.ts
 * - `main.web.ts` - Web-specific exports + re-exports from main.shared.ts
 *
 * This pattern eliminates duplication while maintaining clear separation of
 * environment-specific code.
 *
 * @packageDocumentation
 */
/** biome-ignore-all assist/source/organizeImports: For sort by category */

// ============================================================================
// Shared exports (common to both main and slim versions)
// ============================================================================
export * from "@/common.ts";

// ============================================================================
// Worker helpers (shared across environments)
// ============================================================================
export * from "@/worker/helpers/WorkerSession.ts";

// ============================================================================
// Main-specific: WASM with auto-initialization
// ============================================================================
// Note: WasmInstance and parseStringToArraySyncWASM are exported from
// environment-specific files (main.node.ts and main.web.ts) to ensure
// correct WASM loader selection based on build target
