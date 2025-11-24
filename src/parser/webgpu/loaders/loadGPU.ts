/**
 * GPU device loader for web-csv-toolbox
 *
 * Provides initialization and lifecycle management for WebGPU device.
 * Similar pattern to loadWASM for consistency.
 */

import {
  isInitialized,
  markInitialized,
  setInitPromise,
  getInitPromise,
  getGPUDevice,
  resetInit,
  disposeGPU as internalDisposeGPU,
} from "./gpuState.ts";

/**
 * GPU initialization options
 */
export interface GPUInitOptions {
  /**
   * Custom GPU adapter
   * If provided, uses this adapter instead of requesting one
   */
  adapter?: GPUAdapter;

  /**
   * GPU device descriptor
   * Allows customizing required features and limits
   */
  deviceDescriptor?: GPUDeviceDescriptor;

  /**
   * Adapter request options
   * Used when adapter is not provided
   */
  adapterOptions?: GPURequestAdapterOptions;
}

/**
 * Load and initialize WebGPU device (async)
 *
 * GPU will auto-initialize on first use if not preloaded.
 * This function is useful for:
 * - Warming up the GPU device before first use
 * - Custom device configuration (advanced use case)
 * - Ensuring GPU is available before parsing
 *
 * @param options - Optional GPU initialization options
 * @throws Error if WebGPU is not available or initialization fails
 *
 * @example Basic initialization
 * ```ts
 * import { loadGPU } from 'web-csv-toolbox';
 *
 * // Optional preload
 * await loadGPU();
 *
 * // Now GPU is ready for parsing
 * ```
 *
 * @example Check before loading
 * ```ts
 * import { loadGPU, isWebGPUAvailable } from 'web-csv-toolbox';
 *
 * if (isWebGPUAvailable()) {
 *   await loadGPU();
 *   console.log('GPU ready');
 * } else {
 *   console.warn('WebGPU not available');
 * }
 * ```
 *
 * @example Custom device descriptor
 * ```ts
 * await loadGPU({
 *   deviceDescriptor: {
 *     requiredFeatures: ['shader-f16'],
 *     requiredLimits: {
 *       maxBufferSize: 1024 * 1024 * 1024 // 1GB
 *     }
 *   }
 * });
 * ```
 */
export async function loadGPU(options?: GPUInitOptions): Promise<void> {
  // Already initialized
  if (isInitialized()) {
    return;
  }

  // Concurrent initialization protection
  const existingPromise = getInitPromise();
  if (existingPromise) {
    return existingPromise;
  }

  // Check WebGPU availability
  if (!navigator.gpu) {
    throw new Error("WebGPU is not available in this browser");
  }

  // Create initialization promise
  const initPromise = (async () => {
    try {
      // Get or create adapter
      let adapter: GPUAdapter;
      if (options?.adapter) {
        adapter = options.adapter;
      } else {
        const requestedAdapter = await navigator.gpu.requestAdapter(
          options?.adapterOptions,
        );
        if (!requestedAdapter) {
          throw new Error("Failed to get GPU adapter");
        }
        adapter = requestedAdapter;
      }

      // Request device
      const device = await adapter.requestDevice(options?.deviceDescriptor);

      // Handle device lost
      device.lost.then((info) => {
        console.error("GPU device lost:", info.message);
        resetInit();
      });

      // Mark as initialized
      markInitialized(device, adapter);
    } catch (error) {
      // Reset state on error
      resetInit();
      throw error;
    }
  })();

  // Store promise
  setInitPromise(initPromise);

  // Wait for initialization
  await initPromise;
}

/**
 * Ensure GPU is initialized
 *
 * Auto-initializes if not already initialized.
 * Used internally by parser functions.
 *
 * @internal
 */
export async function ensureGPUInitialized(): Promise<void> {
  if (!isInitialized()) {
    await loadGPU();
  }
}

/**
 * Check if GPU is ready
 *
 * @returns True if GPU device is initialized and ready
 *
 * @example
 * ```ts
 * import { isGPUReady } from 'web-csv-toolbox';
 *
 * if (isGPUReady()) {
 *   console.log('GPU is ready');
 * }
 * ```
 */
export function isGPUReady(): boolean {
  return isInitialized();
}

/**
 * Get the shared GPU device
 *
 * Returns null if GPU is not initialized.
 * Use loadGPU() to initialize first.
 *
 * @returns GPU device or null
 *
 * @example
 * ```ts
 * import { getSharedGPUDevice, loadGPU } from 'web-csv-toolbox';
 *
 * await loadGPU();
 * const device = getSharedGPUDevice();
 *
 * if (device) {
 *   // Use device for custom GPU operations
 * }
 * ```
 */
export function getSharedGPUDevice(): GPUDevice | null {
  return getGPUDevice();
}

/**
 * Dispose GPU resources
 *
 * Destroys the GPU device and releases resources.
 * After calling this, you must call loadGPU() again to use GPU.
 *
 * @remarks
 * Useful for:
 * - Manual cleanup when GPU is no longer needed
 * - Testing scenarios
 * - Memory management in long-running applications
 *
 * @example
 * ```ts
 * import { disposeGPU, loadGPU } from 'web-csv-toolbox';
 *
 * // Use GPU
 * await loadGPU();
 * // ... parse CSV files ...
 *
 * // Cleanup when done
 * disposeGPU();
 *
 * // Later, reinitialize if needed
 * await loadGPU();
 * ```
 */
export function disposeGPU(): void {
  internalDisposeGPU();
}

/**
 * Reset GPU initialization state
 *
 * Similar to disposeGPU but doesn't destroy the device.
 * Useful for testing.
 *
 * @internal
 */
export function resetGPUInit(): void {
  resetInit();
}
