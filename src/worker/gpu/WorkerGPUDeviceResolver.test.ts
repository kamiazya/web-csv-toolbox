import { describe, expect, it } from "vitest";
import { skipIfNoWebGPU, test } from "@/__tests__/webgpu/webgpu-fixture.ts";
import { WorkerGPUDeviceResolver } from "./WorkerGPUDeviceResolver.ts";

describe("WorkerGPUDeviceResolver", () => {
  describe("construction", () => {
    it("should accept undefined options", () => {
      const resolver = new WorkerGPUDeviceResolver();
      expect(resolver.hasDevice()).toBe(false);
      resolver.dispose();
    });

    it("should accept empty options", () => {
      const resolver = new WorkerGPUDeviceResolver({});
      expect(resolver.hasDevice()).toBe(false);
      resolver.dispose();
    });

    it("should accept devicePreference option", () => {
      const resolver = new WorkerGPUDeviceResolver({
        devicePreference: "high-performance",
      });
      expect(resolver.hasDevice()).toBe(false);
      resolver.dispose();
    });
  });

  describe("getDevice", () => {
    test("should create and return GPU device", async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      const resolver = new WorkerGPUDeviceResolver({ gpu });
      try {
        const device = await resolver.getDevice();
        expect(device).toBeDefined();
        expect(resolver.hasDevice()).toBe(true);
      } finally {
        resolver.dispose();
      }
    });

    test("should return cached device on subsequent calls", async ({
      gpu,
      skip,
    }) => {
      skipIfNoWebGPU(gpu, skip);

      const resolver = new WorkerGPUDeviceResolver({ gpu });
      try {
        const device1 = await resolver.getDevice();
        const device2 = await resolver.getDevice();
        expect(device1).toBe(device2);
      } finally {
        resolver.dispose();
      }
    });

    test("should respect devicePreference: high-performance", async ({
      gpu,
      skip,
    }) => {
      skipIfNoWebGPU(gpu, skip);

      const resolver = new WorkerGPUDeviceResolver({
        gpu,
        options: { devicePreference: "high-performance" },
      });
      try {
        const device = await resolver.getDevice();
        expect(device).toBeDefined();
      } finally {
        resolver.dispose();
      }
    });

    test("should respect devicePreference: low-power", async ({
      gpu,
      skip,
    }) => {
      skipIfNoWebGPU(gpu, skip);

      const resolver = new WorkerGPUDeviceResolver({
        gpu,
        options: { devicePreference: "low-power" },
      });
      try {
        const device = await resolver.getDevice();
        expect(device).toBeDefined();
      } finally {
        resolver.dispose();
      }
    });

    test("should use adapterOptions when provided", async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      const resolver = new WorkerGPUDeviceResolver({
        gpu,
        options: {
          adapterOptions: {
            powerPreference: "high-performance",
          },
        },
      });
      try {
        const device = await resolver.getDevice();
        expect(device).toBeDefined();
      } finally {
        resolver.dispose();
      }
    });

    test("should use deviceDescriptor when provided", async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      const resolver = new WorkerGPUDeviceResolver({
        gpu,
        options: {
          deviceDescriptor: {
            label: "Test Device",
          },
        },
      });
      try {
        const device = await resolver.getDevice();
        expect(device).toBeDefined();
        expect(device.label).toBe("Test Device");
      } finally {
        resolver.dispose();
      }
    });
  });

  describe("dispose", () => {
    test("should destroy device on dispose", async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      const resolver = new WorkerGPUDeviceResolver({ gpu });
      await resolver.getDevice();
      expect(resolver.hasDevice()).toBe(true);

      resolver.dispose();
      expect(resolver.hasDevice()).toBe(false);
    });

    it("should be safe to call dispose without device", () => {
      const resolver = new WorkerGPUDeviceResolver();
      expect(() => resolver.dispose()).not.toThrow();
    });

    test("should be safe to call dispose multiple times", async ({
      gpu,
      skip,
    }) => {
      skipIfNoWebGPU(gpu, skip);

      const resolver = new WorkerGPUDeviceResolver({ gpu });
      await resolver.getDevice();

      resolver.dispose();
      expect(() => resolver.dispose()).not.toThrow();
    });
  });

  describe("Disposable interface", () => {
    test("should support using statement", async ({ gpu, skip }) => {
      skipIfNoWebGPU(gpu, skip);

      let resolverRef: WorkerGPUDeviceResolver | undefined;
      {
        using resolver = new WorkerGPUDeviceResolver({ gpu });
        await resolver.getDevice();
        expect(resolver.hasDevice()).toBe(true);
        resolverRef = resolver;
      }
      // After using block, device should be disposed
      expect(resolverRef?.hasDevice()).toBe(false);
    });
  });
});
