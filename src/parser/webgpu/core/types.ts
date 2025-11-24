/**
 * WebGPU CSV Parser Type Definitions
 *
 * This module defines the types for the WebGPU-accelerated CSV parser
 * that performs parallel index construction rather than full parsing.
 */

/**
 * Separator type constants
 */
export const SEP_TYPE_COMMA = 0;
export const SEP_TYPE_LF = 1;

/**
 * Represents a CSV separator with its position and type
 */
export interface Separator {
  /** Byte offset in the input buffer */
  readonly offset: number;
  /** Separator type: 0 for comma, 1 for line feed */
  readonly type: typeof SEP_TYPE_COMMA | typeof SEP_TYPE_LF;
}

/**
 * Result from GPU parsing operation
 */
export interface GPUParseResult {
  /** Array of separator positions (packed as u32: offset | type << 31) */
  readonly sepIndices: Uint32Array;
  /** Quote state at the end of the chunk (0: false, 1: true) */
  readonly endInQuote: number;
  /** Total number of separators found */
  readonly sepCount: number;
}

/**
 * Configuration for WebGPU parser
 */
export interface WebGPUParserConfig {
  /** Size of each chunk to process (default: 1MB) */
  readonly chunkSize?: number;
  /** Maximum number of separators per chunk (default: chunkSize / 2) */
  readonly maxSeparators?: number;
  /** Reuse GPU device if provided */
  readonly device?: GPUDevice;
}

/**
 * Internal uniforms passed to GPU shader
 */
export interface ParseUniforms {
  /** Size of the chunk being processed */
  chunkSize: number;
  /** Quote state from previous chunk (0: false, 1: true) */
  prevInQuote: number;
}

/**
 * Metadata returned from GPU computation
 */
export interface ResultMeta {
  /** Quote state at end of chunk */
  endInQuote: number;
  /** Number of separators found */
  sepCount: number;
}

/**
 * Internal GPU buffer state
 */
export interface GPUBuffers {
  /** Input buffer for CSV bytes */
  inputBuffer: GPUBuffer;
  /** Output buffer for separator indices */
  sepIndicesBuffer: GPUBuffer;
  /** Atomic counter for write position */
  atomicIndexBuffer: GPUBuffer;
  /** Uniform buffer for shader parameters */
  uniformsBuffer: GPUBuffer;
  /** Result metadata buffer */
  resultMetaBuffer: GPUBuffer;
  /** Bind group for all buffers */
  bindGroup: GPUBindGroup;
}

/**
 * CSV field extracted from indexed data
 */
export interface CSVField {
  /** Start offset in input buffer */
  readonly start: number;
  /** End offset in input buffer */
  readonly end: number;
  /** Field content (lazy-loaded) */
  readonly value: string;
}

/**
 * CSV record (row) composed of fields
 */
export interface CSVRecord {
  /** Array of fields in this record */
  readonly fields: CSVField[];
  /** Record number (0-indexed) */
  readonly recordIndex: number;
}

/**
 * Options for streaming parser
 */
export interface StreamingParserOptions {
  /** Parser configuration */
  readonly config?: WebGPUParserConfig;
  /** Callback for each parsed record */
  readonly onRecord?: (record: CSVRecord) => void | Promise<void>;
  /** Callback for errors */
  readonly onError?: (error: Error) => void;
  /** Whether to skip BOM detection (default: false) */
  readonly skipBOM?: boolean;
}

/**
 * Internal state for streaming parser
 */
export interface StreamingState {
  /** Leftover bytes from previous chunk */
  leftover: Uint8Array;
  /** Quote state from previous chunk */
  prevInQuote: number;
  /** Whether this is the first chunk */
  isFirstChunk: boolean;
  /** Current record index */
  recordIndex: number;
  /** Current field start position in global stream */
  globalOffset: number;
}
