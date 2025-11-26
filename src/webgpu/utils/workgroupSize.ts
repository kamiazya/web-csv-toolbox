/**
 * WebGPU Workgroup Size Utilities
 *
 * Generic utilities for workgroup size selection and validation.
 * Workgroup size affects GPU compute shader performance and must be
 * within device limits.
 */

/**
 * Supported workgroup sizes for GPU compute (must be power of 2)
 */
export type WorkgroupSize = 32 | 64 | 128 | 256 | 512;

/**
 * Default workgroup size for GPU compute (used before device is available)
 */
export const DEFAULT_WORKGROUP_SIZE: WorkgroupSize = 256;

/**
 * Supported workgroup sizes (must be power of 2)
 */
export const SUPPORTED_WORKGROUP_SIZES: readonly WorkgroupSize[] = [
  32, 64, 128, 256, 512,
];

/**
 * Validate workgroup size
 *
 * @param size - Size to validate
 * @throws Error if size is not a supported workgroup size
 */
export function validateWorkgroupSize(
  size: number,
): asserts size is WorkgroupSize {
  if (!SUPPORTED_WORKGROUP_SIZES.includes(size as WorkgroupSize)) {
    throw new Error(
      `Invalid workgroup size: ${size}. Must be one of: ${SUPPORTED_WORKGROUP_SIZES.join(", ")}`,
    );
  }
}

/**
 * Select optimal workgroup size based on GPU device limits.
 *
 * Returns the largest supported workgroup size that fits within the device's
 * maxComputeWorkgroupSizeX limit.
 *
 * @param device - GPUDevice to query limits from
 * @returns Optimal workgroup size
 *
 * @example
 * ```ts
 * const device = await adapter.requestDevice();
 * const workgroupSize = selectOptimalWorkgroupSize(device);
 * // workgroupSize: 256 (or smaller if device doesn't support 256)
 * ```
 */
export function selectOptimalWorkgroupSize(device: GPUDevice): WorkgroupSize {
  const maxSize = device.limits.maxComputeWorkgroupSizeX;

  // Find the largest supported workgroup size that fits
  for (let i = SUPPORTED_WORKGROUP_SIZES.length - 1; i >= 0; i--) {
    const size = SUPPORTED_WORKGROUP_SIZES[i]!;
    if (size <= maxSize) {
      return size;
    }
  }

  // Fallback to smallest size (should never happen with standard GPUs)
  return SUPPORTED_WORKGROUP_SIZES[0]!;
}

/**
 * Select optimal workgroup size from a GPU instance.
 *
 * Requests a temporary adapter to query limits without creating a device.
 * Useful for determining workgroup size before device initialization.
 *
 * @param gpu - GPU instance
 * @returns Promise resolving to optimal workgroup size
 *
 * @example
 * ```ts
 * const gpu = navigator.gpu;
 * const workgroupSize = await selectOptimalWorkgroupSizeFromGPU(gpu);
 * // workgroupSize: 256 (or smaller based on adapter limits)
 * ```
 */
export async function selectOptimalWorkgroupSizeFromGPU(
  gpu: GPU,
): Promise<WorkgroupSize> {
  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    // Default to most compatible size if adapter unavailable
    return DEFAULT_WORKGROUP_SIZE;
  }

  // Query adapter limits (device-independent max limits)
  const maxSize = adapter.limits.maxComputeWorkgroupSizeX;

  // Find the largest supported workgroup size that fits
  for (let i = SUPPORTED_WORKGROUP_SIZES.length - 1; i >= 0; i--) {
    const size = SUPPORTED_WORKGROUP_SIZES[i]!;
    if (size <= maxSize) {
      return size;
    }
  }

  return SUPPORTED_WORKGROUP_SIZES[0]!;
}

/**
 * Select optimal workgroup size from adapter limits.
 *
 * @param adapter - GPUAdapter to query limits from
 * @returns Optimal workgroup size
 */
export function selectOptimalWorkgroupSizeFromAdapter(
  adapter: GPUAdapter,
): WorkgroupSize {
  const maxSize = adapter.limits.maxComputeWorkgroupSizeX;

  // Find the largest supported workgroup size that fits
  for (let i = SUPPORTED_WORKGROUP_SIZES.length - 1; i >= 0; i--) {
    const size = SUPPORTED_WORKGROUP_SIZES[i]!;
    if (size <= maxSize) {
      return size;
    }
  }

  return SUPPORTED_WORKGROUP_SIZES[0]!;
}
