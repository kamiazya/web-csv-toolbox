/**
 * Shared exports between main and lite versions.
 *
 * This file contains all common exports that are available in both
 * the main entry point (main.ts) and the lite version (lite.ts).
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
export * from "@/parser/api/binary/parseUint8ArrayStream.ts";
export * from "@/parser/api/file/parseBlob.ts";
export * from "@/parser/api/file/parseFile.ts";
export * from "@/parser/api/file/parseFileToArray.ts";
export * from "@/parser/api/file/parseFileToStream.ts";
export * from "@/parser/api/network/parseRequest.ts";
export * from "@/parser/api/network/parseResponse.ts";
export * from "@/parser/api/parse.ts";
export * from "@/parser/api/string/parseString.ts";
export * from "@/parser/api/string/parseStringStream.ts";

// ============================================================================
// Parser models and transformers
// ============================================================================
export * from "@/parser/models/DefaultCSVRecordAssembler.ts";
export * from "@/parser/models/DefaultStringCSVLexer.ts";
export * from "@/parser/models/FlexibleCSVRecordAssembler.ts";
export * from "@/parser/models/FlexibleStringCSVLexer.ts";
export * from "@/parser/stream/CSVLexerTransformer.ts";
export * from "@/parser/stream/CSVRecordAssemblerTransformer.ts";

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
