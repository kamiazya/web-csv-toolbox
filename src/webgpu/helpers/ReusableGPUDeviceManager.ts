/**
 * Reusable GPU Device Manager
 *
 * Keeps device alive across operations.
 * Use this when you need persistent GPU access.
 */

import type {
  GPUDeviceManagerConfig,
  GPUDevicePreference,
  GPUDeviceSelector,
} from "@/webgpu/helpers/SharedGPUDeviceManager.ts";
import { SharedGPUDeviceManager } from "@/webgpu/helpers/SharedGPUDeviceManager.ts";

/**
 * Configuration for ReusableGPUDeviceManager with preference-based selection
 */
interface ReusableGPUDeviceManagerConfigWithPreference
  extends Omit<GPUDeviceManagerConfig, "autoDispose" | "deviceSelector"> {
  devicePreference?: GPUDevicePreference;
  deviceSelector?: never;
}

/**
 * Configuration for ReusableGPUDeviceManager with custom selector
 */
interface ReusableGPUDeviceManagerConfigWithSelector
  extends Omit<GPUDeviceManagerConfig, "autoDispose" | "devicePreference"> {
  devicePreference?: never;
  deviceSelector?: GPUDeviceSelector;
}

/**
 * Configuration type for ReusableGPUDeviceManager
 */
type ReusableGPUDeviceManagerConfig =
  | ReusableGPUDeviceManagerConfigWithPreference
  | ReusableGPUDeviceManagerConfigWithSelector;

/**
 * Reusable GPU Device Manager
 *
 * Keeps device alive across operations.
 * Use this when you need persistent GPU access.
 *
 * @example
 * ```ts
 * import { ReusableGPUDeviceManager } from 'web-csv-toolbox';
 *
 * using manager = new ReusableGPUDeviceManager();
 *
 * // Device stays alive for all operations
 * for (const file of files) {
 *   await parseFile(file, {
 *     engine: { gpu: true, gpuDeviceManager: manager }
 *   });
 * }
 *
 * // Auto-cleanup on scope exit
 * ```
 */
export class ReusableGPUDeviceManager extends SharedGPUDeviceManager {
  constructor(config?: ReusableGPUDeviceManagerConfig) {
    super({
      ...config,
      autoDispose: true,
    } as GPUDeviceManagerConfig);
  }
}
