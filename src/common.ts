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
export * from "@/parser/models/createBinaryCSVParser.ts";
export * from "@/parser/models/createCSVRecordAssembler.ts";
export * from "@/parser/models/createStringCSVLexer.ts";
export * from "@/parser/models/createStringCSVParser.ts";
export * from "@/parser/models/FlexibleBinaryCSVParser.ts";
// ============================================================================
// Parser models and transformers
// ============================================================================
export * from "@/parser/models/FlexibleCSVArrayRecordAssembler.ts";
export * from "@/parser/models/FlexibleCSVObjectRecordAssembler.ts";
export * from "@/parser/models/FlexibleStringCSVParser.ts";
export * from "@/parser/stream/BinaryCSVParserStream.ts";
export * from "@/parser/stream/CSVLexerTransformer.ts";
export * from "@/parser/stream/CSVRecordAssemblerTransformer.ts";
export * from "@/parser/stream/StringCSVParserStream.ts";

// ============================================================================
// Utility functions
// ============================================================================
export * from "@/utils/file/getOptionsFromFile.ts";

// ============================================================================
// Worker helpers
// ============================================================================
// Note: ReusableWorkerPool and WorkerSession are exported separately in
// main.node.ts and main.web.ts to ensure correct environment-specific
// createWorker implementation is used
