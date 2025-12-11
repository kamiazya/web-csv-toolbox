/**
 * Transient GPU Device Manager
 *
 * For single-use scenarios.
 * Automatically disposes after use.
 */

import type {
  GPUDeviceManagerConfig,
  GPUDevicePreference,
  GPUDeviceSelector,
} from "@/webgpu/helpers/SharedGPUDeviceManager.ts";
import { SharedGPUDeviceManager } from "@/webgpu/helpers/SharedGPUDeviceManager.ts";

/**
 * Configuration for TransientGPUDeviceManager with preference-based selection
 */
interface TransientGPUDeviceManagerConfigWithPreference
  extends Omit<GPUDeviceManagerConfig, "autoDispose" | "deviceSelector"> {
  devicePreference?: GPUDevicePreference;
  deviceSelector?: never;
}

/**
 * Configuration for TransientGPUDeviceManager with custom selector
 */
interface TransientGPUDeviceManagerConfigWithSelector
  extends Omit<GPUDeviceManagerConfig, "autoDispose" | "devicePreference"> {
  devicePreference?: never;
  deviceSelector?: GPUDeviceSelector;
}

/**
 * Configuration type for TransientGPUDeviceManager
 */
type TransientGPUDeviceManagerConfig =
  | TransientGPUDeviceManagerConfigWithPreference
  | TransientGPUDeviceManagerConfigWithSelector;

/**
 * Transient GPU Device Manager
 *
 * For single-use scenarios.
 * Automatically disposes after use.
 *
 * @internal
 */
export class TransientGPUDeviceManager extends SharedGPUDeviceManager {
  constructor(config?: TransientGPUDeviceManagerConfig) {
    super({
      ...config,
      autoDispose: false,
    } as GPUDeviceManagerConfig);
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
