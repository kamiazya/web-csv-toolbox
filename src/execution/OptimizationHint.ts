/**
 * Optimization hints and priority mappings.
 *
 * @module
 */

import type {
  BackendType,
  ContextType,
  GPUBackendConfig,
} from "@/execution/ExecutionPlan.ts";

/**
 * Optimization hint for execution path selection.
 *
 * - `speed`: Maximize throughput (GPU > WASM > JS)
 * - `memory`: Minimize memory usage (JS > WASM > GPU)
 * - `balanced`: Balance speed and compatibility (WASM > GPU > JS)
 * - `responsive`: Minimize initial response time (JS > WASM > GPU)
 */
export type OptimizationHint = "speed" | "memory" | "balanced" | "responsive";

/**
 * Backend priority by optimization hint.
 *
 * ### Rationale
 *
 * - **speed**: GPU achieves GB/s throughput for large files, WASM is 1-2x faster than JS
 * - **memory**: JS streaming has O(1) memory per record, GPU has initialization overhead,
 *   WASM uses batch processing with higher memory peaks
 * - **balanced**: WASM is consistently fast and widely available, GPU is environment-dependent
 * - **responsive**: JS has fastest initialization, no async setup overhead
 */
export const BACKEND_PRIORITY: Record<OptimizationHint, BackendType[]> = {
  speed: ["gpu", "wasm", "js"],
  memory: ["js", "wasm", "gpu"],
  balanced: ["wasm", "gpu", "js"],
  responsive: ["js", "wasm", "gpu"],
};

/**
 * Context priority by optimization hint.
 *
 * ### Rationale
 *
 * - **speed**: Main thread is fastest (no worker communication overhead)
 * - **memory**: Main thread minimizes memory (no worker overhead), stream-transfer as fallback
 * - **balanced/responsive**: Worker prevents UI blocking, stream-transfer preferred for efficiency
 */
export const CONTEXT_PRIORITY: Record<OptimizationHint, ContextType[]> = {
  speed: ["main", "worker-stream-transfer", "worker-message"],
  memory: ["main", "worker-stream-transfer", "worker-message"],
  balanced: ["worker-stream-transfer", "worker-message", "main"],
  responsive: ["worker-stream-transfer", "worker-message", "main"],
};

/**
 * GPU configuration by optimization hint.
 *
 * ### Rationale
 *
 * - **speed**: 128 workgroup size for high throughput with high-performance GPU
 * - **memory**: 32 workgroup size to minimize GPU memory usage
 * - **balanced/responsive**: 64 (recommended default) for general use
 */
export const GPU_CONFIG: Record<OptimizationHint, GPUBackendConfig> = {
  speed: { workgroupSize: 128, devicePreference: "high-performance" },
  memory: { workgroupSize: 32, devicePreference: "low-power" },
  balanced: { workgroupSize: 64, devicePreference: "balanced" },
  responsive: { workgroupSize: 64, devicePreference: "balanced" },
};

/**
 * Default optimization hint.
 */
export const DEFAULT_OPTIMIZATION_HINT: OptimizationHint = "balanced";
