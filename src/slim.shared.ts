/**
 * Shared exports for slim entry point (both Node.js and Web versions).
 *
 * This file contains all exports that are common between slim.node.ts and slim.web.ts.
 * Environment-specific exports (like ReusableWorkerPool and WasmInstance variants)
 * are handled in the respective .node.ts and .web.ts files.
 *
 * **Architecture Pattern:**
 * - `slim.shared.ts` - Common exports (this file)
 * - `slim.node.ts` - Node.js-specific exports + re-exports from slim.shared.ts
 * - `slim.web.ts` - Web-specific exports + re-exports from slim.shared.ts
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
// Slim-specific: Manual WASM initialization
// ============================================================================
export { parseStringToArraySyncWasm } from "@/parser/api/string/parseStringToArraySyncWasm.slim.ts";
