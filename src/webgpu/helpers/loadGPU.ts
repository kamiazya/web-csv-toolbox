/**
 * GPU device loader for web-csv-toolbox
 *
 * Provides initialization and lifecycle management for WebGPU device.
 * Similar pattern to loadWASM for consistency.
 */

import {
  getInitPromise,
  isInitialized,
  markInitialized,
  resetInit,
  setInitPromise,
} from "@/webgpu/helpers/internal/gpuState.ts";

/**
 * Base GPU initialization options (common properties)
 */
interface BaseGPUInitOptions {
  /**
   * GPU device descriptor
   * Allows customizing required features and limits
   */
  deviceDescriptor?: GPUDeviceDescriptor;
}

/**
 * GPU initialization options with custom adapter
 */
interface GPUInitOptionsWithAdapter extends BaseGPUInitOptions {
  /**
   * Custom GPU adapter
   * If provided, uses this adapter instead of requesting one
   */
  adapter: GPUAdapter;

  /**
   * Adapter request options are not allowed with custom adapter
   */
  adapterOptions?: never;
}

/**
 * GPU initialization options with adapter request options
 */
interface GPUInitOptionsWithAdapterOptions extends BaseGPUInitOptions {
  /**
   * Custom adapter is not allowed with adapterOptions
   */
  adapter?: never;

  /**
   * Adapter request options
   * Used when requesting adapter from navigator.gpu
   */
  adapterOptions?: GPURequestAdapterOptions;
}

/**
 * GPU initialization options
 *
 * Either provide a custom `adapter` or `adapterOptions` to request one,
 * but not both simultaneously.
 */
export type GPUInitOptions =
  | GPUInitOptionsWithAdapter
  | GPUInitOptionsWithAdapterOptions
  | BaseGPUInitOptions; // Allow neither for default behavior

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
  // Cast to any for flexible property access during runtime validation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts = options as any;
  // Runtime validation: adapter and adapterOptions are mutually exclusive
  if (opts?.adapter && opts?.adapterOptions) {
    throw new Error(
      "GPUInitOptions: Cannot specify both 'adapter' and 'adapterOptions'. " +
        "Use either a custom adapter or adapter request options, not both.",
    );
  }

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
      if (opts?.adapter) {
        adapter = opts.adapter;
      } else {
        const requestedAdapter = await navigator.gpu.requestAdapter(
          opts?.adapterOptions,
        );
        if (!requestedAdapter) {
          throw new Error("Failed to get GPU adapter");
        }
        adapter = requestedAdapter;
      }

      // Request device
      const device = await adapter.requestDevice(opts?.deviceDescriptor);

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
