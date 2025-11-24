/**
 * WebGPU CSV Parser - Parallel Index Construction for High-Performance CSV Parsing
 *
 * This module provides a WebGPU-accelerated CSV parser that uses GPU compute
 * shaders to identify separator positions in parallel, dramatically reducing
 * CPU load for large CSV files.
 *
 * ## Architecture
 *
 * The parser uses a two-phase approach:
 *
 * 1. **GPU Phase (Index Construction)**
 *    - Parallel scan of CSV bytes using compute shaders
 *    - Quote state tracking via prefix XOR algorithm
 *    - Output: Lightweight u32 array of separator positions
 *
 * 2. **CPU Phase (Record Assembly)**
 *    - Minimal JavaScript processing to extract field values
 *    - Zero-copy subarray operations where possible
 *    - Streaming support with carry-over buffer management
 *
 * ## Features
 *
 * - **High Throughput**: Memory bandwidth-limited performance (GB/s on modern GPUs)
 * - **Low CPU Usage**: Offloads heavy computation to GPU
 * - **Memory Efficient**: Only stores separator indices, not full parse tree
 * - **Streaming Ready**: Handles chunked data with proper state management
 * - **Robust**: Full support for quoted fields, CRLF, BOM, and edge cases
 *
 * ## Usage
 *
 * ### Basic Streaming
 *
 * ```ts
 * import { parseCSVStream } from './parser/webgpu';
 *
 * const response = await fetch('large-file.csv');
 * const records = await parseCSVStream(response.body);
 *
 * for (const record of records) {
 *   console.log(record.fields.map(f => f.value));
 * }
 * ```
 *
 * ### Advanced with Custom Options
 *
 * ```ts
 * import { StreamParser } from './parser/webgpu';
 *
 * const parser = new StreamParser({
 *   config: {
 *     chunkSize: 2 * 1024 * 1024, // 2MB chunks
 *   },
 *   onRecord: async (record) => {
 *     await processRecord(record);
 *   },
 *   onError: (error) => {
 *     console.error('Parse error:', error);
 *   },
 * });
 *
 * await parser.initialize();
 * await parser.parseStream(stream);
 * await parser.destroy();
 * ```
 *
 * ## Browser Compatibility
 *
 * Requires WebGPU support:
 * - Chrome/Edge 113+
 * - Firefox (experimental, behind flag)
 * - Safari Technology Preview
 *
 * Check availability:
 * ```ts
 * if (navigator.gpu) {
 *   // WebGPU is available
 * }
 * ```
 *
 * @module parser/webgpu
 */

// GPU backend
export { GPUBackend } from "./core/gpu-backend.ts";
// Core types
// Note: CSVField and CSVRecord are already exported from @/common.ts
// to avoid duplication in main.web.ts
export type {
  GPUParseResult,
  ParseUniforms,
  ResultMeta,
  Separator,
  StreamingParserOptions,
  StreamingState,
  WebGPUParserConfig,
} from "./core/types.ts";
export { SEP_TYPE_COMMA, SEP_TYPE_LF } from "./core/types.ts";
// GPU Device Manager (for lifecycle management)
// Note: GPUDevicePreference and GPUDeviceManager are already exported from @/core/types.ts
// to avoid duplication in main.web.ts
export type {
  BufferPoolingConfig,
  GPUDeviceManagerConfig,
  GPUDeviceSelectionContext,
  GPUDeviceSelector,
} from "./loaders/GPUDeviceManager.ts";
export {
  ReusableGPUDeviceManager,
  TransientGPUDeviceManager,
} from "./loaders/GPUDeviceManager.ts";
// GPU Device Lifecycle (similar to loadWASM pattern)
export type { GPUInitOptions } from "./loaders/loadGPU.ts";
export {
  disposeGPU,
  ensureGPUInitialized,
  getSharedGPUDevice,
  isGPUReady,
  loadGPU,
} from "./loaders/loadGPU.ts";
// Streaming parser
export { parseCSVStream, StreamParser } from "./streaming/stream-parser.ts";
// Utilities
export {
  adjustForCRLF,
  alignToU32,
  BufferPool,
  concatUint8Arrays,
  decodeUTF8,
  hasBOM,
  isCR,
  isLF,
  padToU32Aligned,
  stripBOM,
  toUint32View,
} from "./utils/buffer-utils.ts";
export {
  findLastLineFeed,
  getProcessedBytesCount,
  getValidSeparators,
  isComma,
  isLineFeed,
  packSeparator,
  unpackSeparator,
} from "./utils/separator-utils.ts";

/**
 * Checks if WebGPU is available in the current environment
 *
 * @returns true if WebGPU is supported
 *
 * @example
 * ```ts
 * import { isWebGPUAvailable } from './parser/webgpu';
 *
 * if (isWebGPUAvailable()) {
 *   // Use WebGPU parser
 * } else {
 *   // Fall back to WASM parser
 * }
 * ```
 */
export function isWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}
