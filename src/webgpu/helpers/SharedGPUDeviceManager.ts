/**
 * GPU Device Manager for lifecycle management
 *
 * Manages GPU device lifecycle for parse operations.
 * Handles device initialization, configuration, and disposal.
 */

import { getSharedGPUDevice } from "@/webgpu/helpers/getSharedGPUDevice.ts";
import type { GPUInitOptions } from "@/webgpu/helpers/loadGPU.ts";
import { loadGPU } from "@/webgpu/helpers/loadGPU.ts";

/**
 * GPU device selection preference
 */
export type GPUDevicePreference = "auto" | "low-power" | "high-performance";

/**
 * Context provided to custom device selector
 */
export interface GPUDeviceSelectionContext {
  /**
   * Available GPU adapters
   */
  adapters: GPUAdapter[];

  /**
   * Expected file size (if known)
   */
  fileSize?: number;

  /**
   * Expected workload intensity
   */
  expectedWorkload?: "light" | "medium" | "heavy";
}

/**
 * Custom device selection strategy
 *
 * @param context - Selection context
 * @returns Selected adapter or array of adapters for multi-GPU
 */
export type GPUDeviceSelector = (
  context: GPUDeviceSelectionContext,
) => Promise<GPUAdapter> | GPUAdapter;

/**
 * Buffer pooling configuration
 */
export interface BufferPoolingConfig {
  /**
   * Enable buffer pooling
   *
   * @default false
   */
  enabled?: boolean;

  /**
   * Maximum buffer size to pool (bytes)
   *
   * @default 256 * 1024 * 1024 (256MB)
   */
  maxBufferSize?: number;

  /**
   * Size to preallocate (bytes)
   *
   * @default undefined (no preallocation)
   */
  preallocateSize?: number;
}

/**
 * Base GPU Device Manager configuration (common properties)
 */
interface BaseGPUDeviceManagerConfig {
  /**
   * GPU initialization options
   * Used when creating the shared device
   */
  initOptions?: GPUInitOptions;

  /**
   * Enable automatic disposal
   * If true, disposes device when manager is no longer needed
   *
   * @default true
   */
  autoDispose?: boolean;

  /**
   * Buffer pooling configuration
   */
  bufferPooling?: BufferPoolingConfig;
}

/**
 * GPU Device Manager configuration with preference-based selection
 */
interface GPUDeviceManagerConfigWithPreference
  extends BaseGPUDeviceManagerConfig {
  /**
   * GPU device selection preference (policy-based)
   *
   * @default 'auto'
   */
  devicePreference?: GPUDevicePreference;

  /**
   * Custom device selector is not allowed with devicePreference
   */
  deviceSelector?: never;
}

/**
 * GPU Device Manager configuration with custom selector
 */
interface GPUDeviceManagerConfigWithSelector
  extends BaseGPUDeviceManagerConfig {
  /**
   * Device preference is not allowed with deviceSelector
   */
  devicePreference?: never;

  /**
   * Custom device selection strategy
   *
   * Overrides default preference-based selection
   */
  deviceSelector?: GPUDeviceSelector;
}

/**
 * GPU Device Manager configuration
 *
 * Either use `devicePreference` (policy-based) or `deviceSelector` (custom),
 * but not both simultaneously.
 */
export type GPUDeviceManagerConfig =
  | GPUDeviceManagerConfigWithPreference
  | GPUDeviceManagerConfigWithSelector;

/**
 * Shared GPU Device Manager for device lifecycle management
 *
 * Manages a shared GPU device for multiple parse operations.
 * Automatically initializes on first use.
 *
 * @example Basic usage
 * ```ts
 * import { SharedGPUDeviceManager, parseString } from 'web-csv-toolbox';
 *
 * const manager = new SharedGPUDeviceManager();
 *
 * // Use in multiple operations
 * await parseString(csv1, { engine: { gpu: true, gpuDeviceManager: manager } });
 * await parseString(csv2, { engine: { gpu: true, gpuDeviceManager: manager } });
 *
 * // Cleanup when done
 * await manager.dispose();
 * ```
 *
 * @example With using syntax
 * ```ts
 * {
 *   using manager = new SharedGPUDeviceManager();
 *
 *   await parseString(csv, {
 *     engine: { gpu: true, gpuDeviceManager: manager }
 *   });
 *
 *   // Auto-disposed when leaving scope
 * }
 * ```
 */
export class SharedGPUDeviceManager {
  private readonly config: {
    initOptions: GPUInitOptions;
    autoDispose: boolean;
    devicePreference: GPUDevicePreference;
    deviceSelector?: GPUDeviceSelector;
    bufferPooling: {
      enabled: boolean;
      maxBufferSize: number;
      preallocateSize?: number;
    };
  };
  private activeOperations = 0;
  private disposed = false;

  constructor(config?: GPUDeviceManagerConfig) {
    // Runtime validation: devicePreference and deviceSelector are mutually exclusive
    if (config?.devicePreference && config?.deviceSelector) {
      throw new Error(
        "GPUDeviceManagerConfig: Cannot specify both 'devicePreference' and 'deviceSelector'. " +
          "Use either policy-based selection (devicePreference) or custom selection (deviceSelector), not both.",
      );
    }

    this.config = {
      initOptions: config?.initOptions || {},
      autoDispose: config?.autoDispose !== false,
      devicePreference: config?.devicePreference || "auto",
      deviceSelector: config?.deviceSelector,
      bufferPooling: {
        enabled: config?.bufferPooling?.enabled ?? false,
        maxBufferSize:
          config?.bufferPooling?.maxBufferSize ?? 256 * 1024 * 1024,
        preallocateSize: config?.bufferPooling?.preallocateSize,
      },
    };
  }

  /**
   * Get or initialize the shared GPU device
   *
   * @returns GPU device instance
   * @throws Error if manager is disposed or GPU unavailable
   */
  async getDevice(): Promise<GPUDevice> {
    if (this.disposed) {
      throw new Error("SharedGPUDeviceManager has been disposed");
    }

    // Initialize if needed
    await loadGPU(this.config.initOptions);

    const device = getSharedGPUDevice();
    if (!device) {
      throw new Error("Failed to get GPU device");
    }

    this.activeOperations++;
    return device;
  }

  /**
   * Release the device (mark operation as complete)
   *
   * @remarks
   * This doesn't actually destroy the device, just decrements the counter.
   * Call dispose() to clean up the device.
   */
  releaseDevice(): void {
    if (this.activeOperations > 0) {
      this.activeOperations--;
    }
  }

  /**
   * Get the number of active operations using this manager
   */
  get activeCount(): number {
    return this.activeOperations;
  }

  /**
   * Check if the manager is disposed
   */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose the manager
   *
   * If autoDispose is enabled, also disposes the GPU device when no operations are active.
   *
   * @param force - Force disposal even if operations are active
   */
  async dispose(force = false): Promise<void> {
    if (this.disposed) {
      return;
    }

    if (!force && this.activeOperations > 0) {
      console.warn(
        `SharedGPUDeviceManager disposed with ${this.activeOperations} active operations`,
      );
    }

    this.disposed = true;

    // Auto-dispose device if configured
    if (this.config.autoDispose) {
      const device = getSharedGPUDevice();
      if (device) {
        device.destroy();
      }
    }
  }

  /**
   * Symbol.dispose for explicit resource management
   * Enables `using` syntax for automatic cleanup
   */
  [Symbol.dispose](): void {
    // Synchronous dispose for using syntax
    if (!this.disposed) {
      this.disposed = true;
      if (this.config.autoDispose) {
        const device = getSharedGPUDevice();
        if (device) {
          device.destroy();
        }
      }
    }
  }
}
