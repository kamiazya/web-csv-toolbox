/**
 * Optimization hints for execution path selection
 *
 * These hints guide the ExecutionPathResolver to select the best combination
 * of backend (JS/WASM/GPU) and execution context (main/worker) based on
 * the user's performance goals.
 */

import type { ExecutionPlan, GPUBackendConfig } from "./ExecutionPlan.ts";

/**
 * Optimization hint for execution path selection
 *
 * - `speed`: Maximize throughput (GPU > WASM > JS, prefer main thread)
 * - `consistency`: Predictable performance (WASM preferred, no GC pauses, main thread)
 * - `balanced`: Balance between speed and responsiveness (JS + worker)
 * - `responsive`: Keep UI responsive (JS for fast init, worker contexts prioritized)
 */
export type OptimizationHint =
  | "speed"
  | "consistency"
  | "balanced"
  | "responsive";

/**
 * Backend priority order for each optimization hint
 *
 * Determines which backend (JS/WASM/GPU) to try first based on the hint.
 */
export const BACKEND_PRIORITY: Record<
  OptimizationHint,
  ExecutionPlan["backends"]
> = {
  speed: ["gpu", "js", "wasm"], // GPU first, then JS (27% faster than WASM)
  consistency: ["wasm", "js", "gpu"], // WASM first - no GC pauses
  balanced: ["js", "gpu", "wasm"], // JS first, then GPU
  responsive: ["js", "wasm", "gpu"], // JS first, WASM second - fastest initialization
};

/**
 * Context priority order for each optimization hint
 *
 * Determines which execution context (main/worker) to try first.
 */
export const CONTEXT_PRIORITY: Record<
  OptimizationHint,
  ExecutionPlan["contexts"]
> = {
  speed: ["main", "worker-stream-transfer", "worker-message"], // Main thread fastest - no worker overhead
  consistency: ["main", "worker-stream-transfer", "worker-message"], // Main thread - simpler, more predictable
  balanced: ["worker-stream-transfer", "worker-message", "main"], // Worker contexts first - balance responsiveness
  responsive: ["worker-stream-transfer", "worker-message", "main"], // Worker first - keep UI responsive
};

/**
 * GPU configuration for each optimization hint
 *
 * Workgroup size and device preference tuned for each hint.
 */
export const GPU_CONFIG: Record<OptimizationHint, GPUBackendConfig> = {
  speed: {
    workgroupSize: 128, // Larger workgroups for throughput
    devicePreference: "high-performance",
  },
  consistency: {
    workgroupSize: 64, // Predictable workgroup size
    devicePreference: "low-power",
  },
  balanced: {
    workgroupSize: 64, // Balanced workgroup size
    devicePreference: "balanced",
  },
  responsive: {
    workgroupSize: 64, // Smaller workgroups for responsiveness
    devicePreference: "balanced",
  },
};

/**
 * Default optimization hint
 */
export const DEFAULT_OPTIMIZATION_HINT: OptimizationHint = "balanced";
