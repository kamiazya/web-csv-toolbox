/**
 * GPU state management for web-csv-toolbox
 *
 * Manages GPU device lifecycle and initialization state.
 * Similar to WASM state management pattern.
 *
 * @internal This module is internal and should not be imported directly.
 * Use the public API functions instead:
 * - loadGPU() - Initialize GPU
 * - isGPUReady() - Check if initialized
 * - getSharedGPUDevice() - Get the GPU device
 * - disposeGPU() - Clean up resources
 */

/**
 * GPU initialization state
 */
interface GPUState {
  /** Whether GPU has been initialized */
  initialized: boolean;
  /** Shared GPU device instance */
  device: GPUDevice | null;
  /** GPU adapter instance */
  adapter: GPUAdapter | null;
  /** Initialization promise (for handling concurrent initializations) */
  initPromise: Promise<void> | null;
}

/**
 * Global GPU state
 */
const state: GPUState = {
  initialized: false,
  device: null,
  adapter: null,
  initPromise: null,
};

/**
 * Check if GPU is initialized
 *
 * @returns True if GPU device is ready
 * @internal
 */
export function isInitialized(): boolean {
  return state.initialized && state.device !== null;
}

/**
 * Get the shared GPU device
 *
 * @returns GPU device or null if not initialized
 * @internal
 */
export function getGPUDevice(): GPUDevice | null {
  return state.device;
}

/**
 * Get the GPU adapter
 *
 * @returns GPU adapter or null if not initialized
 * @internal
 */
export function getGPUAdapter(): GPUAdapter | null {
  return state.adapter;
}

/**
 * Mark GPU as initialized
 *
 * @param device - GPU device instance
 * @param adapter - GPU adapter instance
 * @internal
 */
export function markInitialized(device: GPUDevice, adapter: GPUAdapter): void {
  state.initialized = true;
  state.device = device;
  state.adapter = adapter;
  state.initPromise = null;
}

/**
 * Set initialization promise
 *
 * Used to prevent concurrent initialization attempts
 *
 * @param promise - Initialization promise
 * @internal
 */
export function setInitPromise(promise: Promise<void>): void {
  state.initPromise = promise;
}

/**
 * Get current initialization promise
 *
 * @returns Current initialization promise or null
 * @internal
 */
export function getInitPromise(): Promise<void> | null {
  return state.initPromise;
}

/**
 * Reset GPU state
 *
 * Useful for testing or manual cleanup
 *
 * @remarks
 * This does not destroy the GPU device. Call disposeGPU() first if needed.
 * @internal
 */
export function resetInit(): void {
  state.initialized = false;
  state.device = null;
  state.adapter = null;
  state.initPromise = null;
}

/**
 * Dispose GPU resources
 *
 * Destroys the GPU device and resets state
 * @internal
 */
export function disposeGPUInternal(): void {
  if (state.device) {
    state.device.destroy();
  }
  resetInit();
}
