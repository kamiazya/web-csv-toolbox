/**
 * Tests for WebGPU fixture in Node.js environment
 */

import { describe } from "vitest";

import { expect, skipIfNoWebGPU, test } from "./webgpu-fixture.ts";

describe("WebGPU Fixture", () => {
  test("should provide gpu context", async ({ gpu }) => {
    // gpu can be null if WebGPU is not available
    // This test just verifies the fixture works
    expect(gpu === null || typeof gpu === "object").toBe(true);
  });

  test("should report WebGPU availability", async ({ isWebGPUAvailable }) => {
    expect(typeof isWebGPUAvailable).toBe("boolean");
    console.log(`WebGPU available: ${isWebGPUAvailable}`);
  });

  test("should create device when available", async ({
    gpu,
    createDevice,
    skip,
  }) => {
    skipIfNoWebGPU(gpu, skip);

    const device = await createDevice();
    expect(device).not.toBeNull();

    if (device) {
      // Verify it's a valid GPU device
      expect(typeof device.createBuffer).toBe("function");
      expect(typeof device.createShaderModule).toBe("function");
    }
  });

  test("should run simple compute shader", async ({
    gpu,
    createDevice,
    skip,
  }) => {
    skipIfNoWebGPU(gpu, skip);

    const device = await createDevice();
    if (!device) {
      skip("Failed to create GPU device");
      return;
    }

    // Simple compute shader that doubles values
    const shaderCode = `
      @group(0) @binding(0) var<storage, read_write> data: array<u32>;

      @compute @workgroup_size(1)
      fn main(@builtin(global_invocation_id) id: vec3<u32>) {
        data[id.x] = data[id.x] * 2u;
      }
    `;

    const shaderModule = device.createShaderModule({
      code: shaderCode,
    });

    const pipeline = device.createComputePipeline({
      layout: "auto",
      compute: {
        module: shaderModule,
        entryPoint: "main",
      },
    });

    // Create buffer with test data
    const inputData = new Uint32Array([1, 2, 3, 4]);
    const buffer = device.createBuffer({
      size: inputData.byteLength,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    new Uint32Array(buffer.getMappedRange()).set(inputData);
    buffer.unmap();

    // Create staging buffer for reading results
    const stagingBuffer = device.createBuffer({
      size: inputData.byteLength,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer } }],
    });

    // Run compute pass
    const commandEncoder = device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(pipeline);
    computePass.setBindGroup(0, bindGroup);
    computePass.dispatchWorkgroups(4);
    computePass.end();

    // Copy results to staging buffer
    commandEncoder.copyBufferToBuffer(
      buffer,
      0,
      stagingBuffer,
      0,
      inputData.byteLength,
    );

    device.queue.submit([commandEncoder.finish()]);

    // Read results
    await stagingBuffer.mapAsync(GPUMapMode.READ);
    const result = new Uint32Array(stagingBuffer.getMappedRange());

    expect(Array.from(result)).toEqual([2, 4, 6, 8]);

    stagingBuffer.unmap();
  });
});
