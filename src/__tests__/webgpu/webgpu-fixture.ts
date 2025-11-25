/**
 * Vitest fixture for WebGPU testing in Node.js
 *
 * Provides WebGPU context via the `webgpu` npm package (Google Dawn).
 * Use this fixture in Node.js tests to access GPU functionality.
 *
 * @example
 * ```typescript
 * import { test, expect } from './webgpu-fixture';
 *
 * test('my GPU test', async ({ gpu }) => {
 *   if (!gpu) {
 *     // GPU not available, skip test logic
 *     return;
 *   }
 *   const adapter = await gpu.requestAdapter();
 *   // ...
 * });
 * ```
 */

import { test as baseTest } from "vitest";

// Import webgpu package for Node.js WebGPU support
let webgpuModule: typeof import("webgpu") | null = null;
let globalsInstalled = false;

/**
 * Lazily loads the webgpu module and installs globals
 */
async function loadWebGPU(): Promise<typeof import("webgpu") | null> {
  if (webgpuModule !== null) {
    return webgpuModule;
  }

  try {
    webgpuModule = await import("webgpu");

    // Install WebGPU globals (GPUBufferUsage, GPUMapMode, etc.)
    if (!globalsInstalled && webgpuModule.globals) {
      Object.assign(globalThis, webgpuModule.globals);
      globalsInstalled = true;
    }

    return webgpuModule;
  } catch {
    // webgpu package not available (e.g., unsupported platform)
    return null;
  }
}

/**
 * WebGPU fixture context
 */
export interface WebGPUFixture {
  /**
   * GPU interface (navigator.gpu equivalent).
   * Will be null if WebGPU is not available.
   */
  gpu: GPU | null;

  /**
   * Whether WebGPU is available in this environment
   */
  isWebGPUAvailable: boolean;

  /**
   * Create a GPU device for testing.
   * Returns null if WebGPU is not available.
   */
  createDevice: () => Promise<GPUDevice | null>;
}

/**
 * Extended test with WebGPU fixture
 */
export const test = baseTest.extend<WebGPUFixture>({
  // biome-ignore lint/correctness/noEmptyPattern: Vitest fixture pattern requires destructuring
  gpu: async ({}, use) => {
    const webgpu = await loadWebGPU();

    if (!webgpu) {
      await use(null);
      return;
    }

    try {
      // Create GPU instance using Dawn backend
      const gpu = webgpu.create([]) as unknown as GPU;
      await use(gpu);
    } catch {
      // GPU creation failed
      await use(null);
    }
  },

  isWebGPUAvailable: async ({ gpu }, use) => {
    if (!gpu) {
      await use(false);
      return;
    }

    try {
      const adapter = await gpu.requestAdapter();
      await use(adapter !== null);
    } catch {
      await use(false);
    }
  },

  createDevice: async ({ gpu }, use) => {
    const devices: GPUDevice[] = [];

    const createDevice = async (): Promise<GPUDevice | null> => {
      if (!gpu) {
        return null;
      }

      try {
        const adapter = await gpu.requestAdapter();
        if (!adapter) {
          return null;
        }

        const device = await adapter.requestDevice();
        devices.push(device);
        return device;
      } catch {
        return null;
      }
    };

    await use(createDevice);

    // Cleanup: destroy all created devices
    for (const device of devices) {
      device.destroy();
    }
  },
});

/**
 * Re-export expect for convenience
 */
export { expect } from "vitest";

/**
 * Skip test if WebGPU is not available
 *
 * @example
 * ```typescript
 * test('requires GPU', async ({ gpu, skip }) => {
 *   skipIfNoWebGPU(gpu, skip);
 *   // Rest of test...
 * });
 * ```
 */
export function skipIfNoWebGPU(
  gpu: GPU | null,
  skip: (note?: string) => void,
): asserts gpu is GPU {
  if (!gpu) {
    skip("WebGPU not available in this environment");
  }
}
