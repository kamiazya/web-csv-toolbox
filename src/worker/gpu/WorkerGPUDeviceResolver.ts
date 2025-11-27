import type { SerializableGPUOptions } from "@/core/types.ts";

/**
 * Configuration for WorkerGPUDeviceResolver
 */
export interface WorkerGPUDeviceResolverConfig {
  /**
   * Serializable GPU options for device selection.
   */
  options?: SerializableGPUOptions;

  /**
   * GPU interface to use. Defaults to navigator.gpu.
   * This is primarily for testing purposes.
   * @internal
   */
  gpu?: GPU;
}

/**
 * Resolves GPU device in worker context using SerializableGPUOptions.
 *
 * This is a lightweight implementation specifically for workers that cannot
 * receive GPUDeviceManager instances (non-serializable) but can receive
 * gpuOptions (serializable configuration).
 *
 * @remarks
 * Unlike SharedGPUDeviceManager which supports custom deviceSelector functions,
 * this resolver only supports policy-based device selection via devicePreference.
 *
 * @example
 * ```typescript
 * const resolver = new WorkerGPUDeviceResolver({
 *   options: {
 *     devicePreference: 'high-performance',
 *     deviceDescriptor: { label: 'CSV Parser' }
 *   }
 * });
 *
 * try {
 *   const device = await resolver.getDevice();
 *   // Use device for GPU parsing
 * } finally {
 *   resolver.dispose();
 * }
 * ```
 *
 * @internal
 */
export class WorkerGPUDeviceResolver implements Disposable {
  private device: GPUDevice | null = null;
  private readonly options: SerializableGPUOptions;
  private readonly gpuInterface: GPU | undefined;

  constructor(config?: SerializableGPUOptions | WorkerGPUDeviceResolverConfig) {
    // Support both legacy (SerializableGPUOptions) and new (WorkerGPUDeviceResolverConfig) signatures
    // Check for "gpu" or "options" property to detect new config format
    if (config && ("gpu" in config || "options" in config)) {
      const cfg = config as WorkerGPUDeviceResolverConfig;
      this.options = cfg.options ?? {};
      this.gpuInterface = cfg.gpu;
    } else {
      // Legacy signature: config is SerializableGPUOptions or undefined
      this.options = (config as SerializableGPUOptions | undefined) ?? {};
      this.gpuInterface = undefined;
    }
  }

  /**
   * Get or create a GPU device based on the configured options.
   *
   * @throws Error if WebGPU is not available or no adapter found
   */
  async getDevice(): Promise<GPUDevice> {
    if (this.device) {
      return this.device;
    }

    const gpu = this.gpuInterface ?? navigator.gpu;
    if (!gpu) {
      throw new Error("WebGPU is not available in this worker context");
    }

    const adapterOptions = this.resolveAdapterOptions();
    const adapter = await gpu.requestAdapter(adapterOptions);
    if (!adapter) {
      throw new Error(
        `No GPU adapter available for preference: ${this.options.devicePreference ?? "default"}`,
      );
    }

    this.device = await adapter.requestDevice(this.options.deviceDescriptor);
    return this.device;
  }

  /**
   * Check if a device has already been created.
   */
  hasDevice(): boolean {
    return this.device !== null;
  }

  /**
   * Dispose the GPU device and release resources.
   */
  dispose(): void {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
  }

  /**
   * Disposable interface implementation.
   * Allows usage with `using` statement.
   */
  [Symbol.dispose](): void {
    this.dispose();
  }

  /**
   * Resolve adapter options from devicePreference and adapterOptions.
   *
   * devicePreference takes precedence over adapterOptions.powerPreference
   * unless adapterOptions.powerPreference is explicitly set.
   */
  private resolveAdapterOptions(): GPURequestAdapterOptions {
    const { devicePreference, adapterOptions } = this.options;

    // If adapterOptions already has powerPreference, use it as-is
    if (adapterOptions?.powerPreference) {
      return adapterOptions;
    }

    // Map devicePreference to powerPreference
    const powerPreference =
      this.mapDevicePreferenceToPowerPreference(devicePreference);

    if (powerPreference) {
      return {
        ...adapterOptions,
        powerPreference,
      };
    }

    return adapterOptions ?? {};
  }

  /**
   * Map GPUDevicePreference to GPUPowerPreference.
   */
  private mapDevicePreferenceToPowerPreference(
    preference?: string,
  ): GPUPowerPreference | undefined {
    switch (preference) {
      case "high-performance":
        return "high-performance";
      case "low-power":
        return "low-power";
      default:
        return undefined;
    }
  }
}
