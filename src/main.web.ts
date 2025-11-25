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
// Web-specific: Worker helpers
// ============================================================================
export * from "@/worker/helpers/ReusableWorkerPool.web.ts";

// ============================================================================
// Web-specific: WebGPU CSV Parser
// ============================================================================
// GPU Compute Infrastructure (generic)
export type {
  ComputeDispatchResult,
  ComputeTiming,
  GPUComputeBackend,
  GPUComputeBackendConfig,
  MultiPassComputeConfig,
  MultiPassGPUComputeBackend,
} from "@/webgpu/compute/GPUComputeBackend.ts";
export { GPUBufferAllocator } from "@/webgpu/compute/GPUBufferAllocator.ts";
export type { GPUBufferConfig } from "@/webgpu/compute/GPUBufferAllocator.ts";
export { GPUShaderLoader } from "@/webgpu/compute/GPUShaderLoader.ts";
export type {
  CompiledShader,
  ShaderSource,
} from "@/webgpu/compute/GPUShaderLoader.ts";
// CSV Indexing Backend (CSV-specific)
export { CSVIndexingBackend } from "@/parser/webgpu/indexing/CSVIndexingBackend.ts";
export type { CSVIndexingBackendConfig } from "@/parser/webgpu/indexing/CSVIndexingBackend.ts";
// Core types
export type {
  GPUParseResult,
  ParseUniforms,
  ResultMeta,
  Separator,
  StreamingParserOptions,
  StreamingState,
  WebGPUParserConfig,
} from "@/parser/webgpu/indexing/types.ts";
export { SEP_TYPE_COMMA, SEP_TYPE_LF } from "@/parser/webgpu/indexing/types.ts";
// GPU Device Manager
export type {
  BufferPoolingConfig,
  GPUDeviceManagerConfig,
  GPUDeviceSelectionContext,
  GPUDeviceSelector,
} from "@/webgpu/helpers/SharedGPUDeviceManager.ts";
export { SharedGPUDeviceManager } from "@/webgpu/helpers/SharedGPUDeviceManager.ts";
export { ReusableGPUDeviceManager } from "@/webgpu/helpers/ReusableGPUDeviceManager.ts";
export { TransientGPUDeviceManager } from "@/webgpu/helpers/TransientGPUDeviceManager.ts";
// GPU Device Lifecycle
export type { GPUInitOptions } from "@/webgpu/helpers/loadGPU.ts";
export { loadGPU } from "@/webgpu/helpers/loadGPU.ts";
export { ensureGPUInitialized } from "@/webgpu/helpers/ensureGPUInitialized.ts";
export { isGPUReady } from "@/webgpu/helpers/isGPUReady.ts";
export { getSharedGPUDevice } from "@/webgpu/helpers/getSharedGPUDevice.ts";
export { disposeGPU } from "@/webgpu/helpers/disposeGPU.ts";
// Streaming parser
export {
  parseCSVStream,
  StreamParser,
} from "@/parser/webgpu/streaming/stream-parser.ts";
// Buffer utilities (generic)
export { concatUint8Arrays } from "@/webgpu/utils/concatUint8Arrays.ts";
export { alignToU32 } from "@/webgpu/utils/alignToU32.ts";
export { padToU32Aligned } from "@/webgpu/utils/padToU32Aligned.ts";
export { toUint32View } from "@/webgpu/utils/toUint32View.ts";
export { BufferPool } from "@/webgpu/utils/BufferPool.ts";
// Buffer utilities (CSV-specific)
export { hasBOM } from "@/parser/webgpu/utils/hasBOM.ts";
export { stripBOM } from "@/parser/webgpu/utils/stripBOM.ts";
export { isCR } from "@/parser/webgpu/utils/isCR.ts";
export { isLF } from "@/parser/webgpu/utils/isLF.ts";
export { adjustForCRLF } from "@/parser/webgpu/utils/adjustForCRLF.ts";
export { decodeUTF8 } from "@/parser/webgpu/utils/decodeUTF8.ts";
// Separator utilities
export {
  findLastLineFeed,
  getProcessedBytesCount,
  getValidSeparators,
  isComma,
  isLineFeed,
  packSeparator,
  unpackSeparator,
} from "@/parser/webgpu/utils/separator-utils.ts";
// WebGPU availability check
export { isWebGPUAvailable } from "@/parser/execution/gpu/isGPUAvailable.ts";
