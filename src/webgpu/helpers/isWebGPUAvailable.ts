/**
 * Checks if WebGPU is available in the current environment
 *
 * @returns true if WebGPU is supported
 *
 * @example
 * ```ts
 * import { isWebGPUAvailable } from 'web-csv-toolbox';
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
