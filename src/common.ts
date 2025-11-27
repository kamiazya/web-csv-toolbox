/**
 * Common exports shared across all entry points and variants.
 *
 * This file contains core functionality that is available in both:
 * - Main and slim variants
 * - Node.js and Web environments
 *
 * **Architecture Pattern:**
 * - `common.ts` - Core APIs shared across all variants (this file)
 * - `*.shared.ts` - Variant-specific shared code (e.g., main.shared.ts, slim.shared.ts)
 * - `*.node.ts` - Node.js-specific code
 * - `*.web.ts` - Web-specific code
 *
 * @internal
 */
/** biome-ignore-all assist/source/organizeImports: For sort by category */

// ============================================================================
// Core types, constants, and errors
// ============================================================================
export * from "@/core/constants.ts";
export * from "@/core/errors.ts";
export * from "@/core/types.ts";

// ============================================================================
// Engine configuration
// ============================================================================
export * from "@/engine/config/EnginePresets.ts";

// ============================================================================
// Parser APIs - All async APIs
// ============================================================================
export * from "@/parser/api/binary/parseBinary.ts";
export * from "@/parser/api/binary/parseBinaryStream.ts";
export * from "@/parser/api/file/parseBlob.ts";
export * from "@/parser/api/file/parseFile.ts";
export * from "@/parser/api/file/parseFileToArray.ts";
export * from "@/parser/api/file/parseFileToStream.ts";
export * from "@/parser/api/network/parseRequest.ts";
export * from "@/parser/api/network/parseResponse.ts";
export * from "@/parser/api/parse.ts";
export * from "@/parser/api/string/parseString.ts";
export * from "@/parser/api/string/parseStringStream.ts";
export * from "@/parser/api/model/createBinaryCSVParser.ts";
export * from "@/parser/api/model/createCSVRecordAssembler.ts";
export * from "@/parser/api/model/createStringCSVLexer.ts";
export * from "@/parser/api/model/createStringCSVParser.ts";
export * from "@/parser/models/FlexibleBinaryArrayCSVParser.ts";
export * from "@/parser/models/FlexibleBinaryObjectCSVParser.ts";
// ============================================================================
// Parser models and transformers
// ============================================================================
export * from "@/parser/models/FlexibleCSVArrayRecordAssembler.ts";
export * from "@/parser/models/FlexibleCSVObjectRecordAssembler.ts";
export * from "@/parser/models/FlexibleStringArrayCSVParser.ts";
export * from "@/parser/models/FlexibleStringObjectCSVParser.ts";
export * from "@/parser/stream/BinaryCSVParserStream.ts";
export * from "@/parser/stream/CSVLexerTransformer.ts";
export * from "@/parser/stream/CSVRecordAssemblerTransformer.ts";
export * from "@/parser/stream/StringCSVParserStream.ts";

// ============================================================================
// Utility functions
// ============================================================================
export * from "@/utils/file/getOptionsFromFile.ts";

// ============================================================================
// WASM Parser Models and Stream Transformers
// ============================================================================
// Note: These require WASM to be initialized. In main variants, WASM is
// auto-initialized. In slim variants, call loadWASM() first.
export * from "@/parser/models/WASMBinaryObjectCSVParser.ts";
export * from "@/parser/models/WASMBinaryCSVArrayParser.ts";
export * from "@/parser/models/WASMStringObjectCSVParser.ts";
export * from "@/parser/models/WASMStringCSVArrayParser.ts";
export * from "@/parser/stream/WASMBinaryCSVStreamTransformer.ts";

// ============================================================================
// Worker helpers
// ============================================================================
// Note: ReusableWorkerPool and WorkerSession are exported separately in
// main.node.ts and main.web.ts to ensure correct environment-specific
// createWorker implementation is used
