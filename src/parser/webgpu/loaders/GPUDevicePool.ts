/**
 * GPU Device Pool for resource sharing
 *
 * Manages GPU device lifecycle for multiple concurrent parse operations.
 * Similar to WorkerPool pattern for consistency.
 */

import type { GPUDevicePool as IGPUDevicePool } from "@/core/types.ts";
import type { GPUInitOptions } from "./loadGPU.ts";
import { loadGPU, getSharedGPUDevice } from "./loadGPU.ts";

/**
 * GPU Device Pool configuration
 */
export interface GPUDevicePoolConfig {
  /**
   * GPU initialization options
   * Used when creating the shared device
   */
  initOptions?: GPUInitOptions;

  /**
   * Enable automatic disposal
   * If true, disposes device when pool is no longer needed
   *
   * @default true
   */
  autoDispose?: boolean;
}

/**
 * GPU Device Pool for sharing GPU resources
 *
 * Manages a shared GPU device for multiple parse operations.
 * Automatically initializes on first use.
 *
 * @example Basic usage
 * ```ts
 * import { GPUDevicePool, parseString } from 'web-csv-toolbox';
 *
 * const pool = new GPUDevicePool();
 *
 * // Use in multiple operations
 * await parseString(csv1, { engine: { gpu: true, gpuDevicePool: pool } });
 * await parseString(csv2, { engine: { gpu: true, gpuDevicePool: pool } });
 *
 * // Cleanup when done
 * await pool.dispose();
 * ```
 *
 * @example With using syntax
 * ```ts
 * {
 *   using pool = new GPUDevicePool();
 *
 *   await parseString(csv, {
 *     engine: { gpu: true, gpuDevicePool: pool }
 *   });
 *
 *   // Auto-disposed when leaving scope
 * }
 * ```
 */
export class GPUDevicePool implements IGPUDevicePool {
  private readonly config: Required<GPUDevicePoolConfig>;
  private activeOperations = 0;
  private disposed = false;

  constructor(config?: GPUDevicePoolConfig) {
    this.config = {
      initOptions: config?.initOptions || {},
      autoDispose: config?.autoDispose !== false,
    };
  }

  /**
   * Get or initialize the shared GPU device
   *
   * @returns GPU device instance
   * @throws Error if pool is disposed or GPU unavailable
   */
  async getDevice(): Promise<GPUDevice> {
    if (this.disposed) {
      throw new Error("GPUDevicePool has been disposed");
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
   * Get the number of active operations using this pool
   */
  get activeCount(): number {
    return this.activeOperations;
  }

  /**
   * Check if the pool is disposed
   */
  get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose the pool
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
        `GPUDevicePool disposed with ${this.activeOperations} active operations`,
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

/**
 * Reusable GPU Device Pool
 *
 * Similar to ReusableWorkerPool - keeps device alive across operations.
 * Use this when you need persistent GPU access.
 *
 * @example
 * ```ts
 * import { ReusableGPUDevicePool } from 'web-csv-toolbox';
 *
 * using pool = new ReusableGPUDevicePool();
 *
 * // Device stays alive for all operations
 * for (const file of files) {
 *   await parseFile(file, {
 *     engine: { gpu: true, gpuDevicePool: pool }
 *   });
 * }
 *
 * // Auto-cleanup on scope exit
 * ```
 */
export class ReusableGPUDevicePool extends GPUDevicePool {
  constructor(config?: Omit<GPUDevicePoolConfig, "autoDispose">) {
    super({
      ...config,
      autoDispose: true,
    });
  }
}

/**
 * Transient GPU Device Pool
 *
 * Similar to TransientWorkerPool - for single-use scenarios.
 * Automatically disposes after use.
 *
 * @internal
 */
export class TransientGPUDevicePool extends GPUDevicePool {
  constructor(config?: Omit<GPUDevicePoolConfig, "autoDispose">) {
    super({
      ...config,
      autoDispose: false,
    });
  }

  /**
   * Release and auto-dispose if no active operations
   */
  override releaseDevice(): void {
    super.releaseDevice();

    // Auto-dispose when no operations are active
    if (this.activeCount === 0 && !this.isDisposed) {
      void this.dispose();
    }
  }
}
