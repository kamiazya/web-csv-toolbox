/**
 * WebGPU CSV Parser Type Definitions
 *
 * This module defines the types for the WebGPU-accelerated CSV parser
 * that performs parallel index construction rather than full parsing.
 */

// Import and re-export WorkgroupSize from the generic WebGPU utilities
import type { WorkgroupSize } from "@/webgpu/utils/workgroupSize.ts";

export type { WorkgroupSize };

/**
 * Separator type constants
 */
export const SEP_TYPE_COMMA = 0 as const;
export const SEP_TYPE_LF = 1 as const;

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
 * Result from CSV separator indexing operation
 *
 * This is the new unified result type for the `run()` method.
 * Separators are sorted by offset and include processedBytes for streaming.
 */
export interface CSVSeparatorIndexResult {
  /** Array of separator positions, sorted by offset (packed as u32: offset | type << 31) */
  readonly separators: Uint32Array;
  /** Number of valid separators in the array */
  readonly sepCount: number;
  /** Byte offset after the last LF (for streaming boundary) */
  readonly processedBytes: number;
  /** Quote state at end of chunk: true = inside quote, false = outside quote */
  readonly endInQuote: boolean;
}

/**
 * Configuration for WebGPU parser
 */
export interface WebGPUParserConfig {
  /** Size of each chunk to process (default: 1MB) */
  readonly chunkSize?: number;
  /** Maximum number of separators per chunk (default: chunkSize / 2) */
  readonly maxSeparators?: number;
  /** Custom GPU instance (for Node.js testing with webgpu package) */
  readonly gpu?: GPU;
  /** Reuse GPU device if provided */
  readonly device?: GPUDevice;
  /**
   * Workgroup size for GPU compute.
   * Must be a power of 2: 32, 64, 128, 256, or 512.
   * Higher values may be more efficient on some GPUs but must not exceed
   * the device's maxComputeWorkgroupSizeX limit.
   * If not specified, automatically selects optimal size based on GPU limits.
   * @default auto (selects optimal size based on GPU limits)
   */
  readonly workgroupSize?: WorkgroupSize;
  /**
   * Enable timing instrumentation for performance profiling.
   * @default false
   */
  readonly enableTiming?: boolean;
}

/**
 * Internal uniforms passed to GPU shader
 */
export interface ParseUniforms {
  /** Size of the chunk being processed */
  chunkSize: number;
  /** Quote state from previous chunk (0: false, 1: true) */
  prevInQuote: number;
  /** Quotation character ASCII code (default: 34 for '"') */
  quotation: number;
  /** Field delimiter character ASCII code (default: 44 for ',') */
  delimiter: number;
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
  /** Workgroup XOR parities buffer (for multi-workgroup quote propagation) */
  workgroupXORsBuffer: GPUBuffer;
  /** Bind group for Pass 1 (collect quote parities) */
  pass1BindGroup: GPUBindGroup;
  /** Bind group for Pass 2 (detect separators) */
  pass2BindGroup: GPUBindGroup;
}
