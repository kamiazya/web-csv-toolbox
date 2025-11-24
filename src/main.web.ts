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
export * from "@/wasm/WasmInstance.main.web.ts";

// ============================================================================
// Web-specific: WASM Parser Models and Stream Transformers
// ============================================================================
export * from "@/parser/models/WASMBinaryCSVParser.ts";
export * from "@/parser/stream/WASMBinaryCSVStreamTransformer.ts";

// ============================================================================
// Web-specific: WASM Lexer and Assembler (Hybrid approach)
// ============================================================================
export * from "@/parser/models/WASMBinaryCSVLexer.ts";
export * from "@/parser/models/WASMCSVRecordAssembler.ts";

// ============================================================================
// Web-specific: Worker helpers
// ============================================================================
export * from "@/worker/helpers/ReusableWorkerPool.web.ts";
