/**
 * Internal types for WASM interoperability.
 *
 * These types define the interfaces used for communication between
 * TypeScript and WASM components. They are internal and not exported
 * from the main package.
 *
 * **Why separate from src/core/types.ts?**
 *
 * While some types appear similar to public API types in `src/core/types.ts`,
 * they serve different purposes:
 *
 * - **WASM internal types**: Minimal types for WASM boundary crossing
 * - **Public API types**: Full-featured types with documentation for users
 *
 * Keeping them separate allows:
 * 1. Minimal type definitions for efficient WASM boundary crossing
 * 2. Independent evolution of internal vs public interfaces
 * 3. Clear separation between implementation details and public API
 *
 * @internal
 */

// =============================================================================
// Flat Data Types (for Truly Flat optimization)
// =============================================================================

/**
 * Flat token data from WASM lexer for efficient boundary crossing.
 * Contains raw arrays that are assembled into Token objects on JS side.
 *
 * @internal
 */
export interface FlatTokenData {
  /** Token type values (TokenType enum: 0=Field, 1=FieldDelimiter, 2=RecordDelimiter) */
  types: number[];
  /** Token values (field content, delimiter chars, newline chars) */
  values: string[];
  /** Line numbers for each token */
  lines: number[];
  /** Column numbers for each token */
  columns: number[];
  /** Byte offsets for each token */
  offsets: number[];
  /** Total number of tokens */
  tokenCount: number;
}

/**
 * Flat parse result from WASM parser for intermediate processing.
 * Used by parser base classes before converting to Object or Array format.
 *
 * @internal
 */
export interface FlatParseData {
  /** Parsed header row, or null if not yet determined */
  headers: string[] | null;
  /** All field values in flat array (row-major order) */
  fieldData: string[];
  /** Actual field count per record (for undefined detection) */
  actualFieldCounts: number[];
  /** Number of records parsed */
  recordCount: number;
  /** Number of fields per record (header column count) */
  fieldCount: number;
}

// =============================================================================
// WASM Constructor Options Types
// =============================================================================

/**
 * Options for WASM CSV Parser constructor.
 * Used by WASMBinaryCSVParserBase, WASMStringCSVParserBase, and stream transformers.
 *
 * @internal
 */
export interface WASMParserOptions {
  /** Field delimiter character */
  delimiter?: string;
  /** Quote character for quoted fields */
  quotation?: string;
  /** Maximum number of fields per record */
  maxFieldCount?: number;
  /** Explicit header row */
  header?: readonly string[];
}
