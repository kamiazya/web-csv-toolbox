import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EnvironmentCapabilities,
  WorkerEnvironmentCapabilities,
} from "@/execution/EnvironmentCapabilities.ts";

describe("EnvironmentCapabilities", () => {
  beforeEach(() => {
    EnvironmentCapabilities.reset();
  });

  afterEach(() => {
    EnvironmentCapabilities.reset();
    vi.restoreAllMocks();
  });

  describe("getInstance", () => {
    it("should return singleton instance", async () => {
      const instance1 = await EnvironmentCapabilities.getInstance();
      const instance2 = await EnvironmentCapabilities.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should detect WASM availability", async () => {
      const instance = await EnvironmentCapabilities.getInstance();
      // WebAssembly is available in Node.js
      expect(instance.wasm).toBe(true);
    });

    it("should detect GPU unavailability in Node.js", async () => {
      const instance = await EnvironmentCapabilities.getInstance();
      // navigator.gpu is not available in Node.js
      expect(instance.gpu).toBe(false);
    });

    it("should detect TransferableStreams availability", async () => {
      const instance = await EnvironmentCapabilities.getInstance();
      // TransferableStreams detection may vary by environment
      expect(typeof instance.transferableStreams).toBe("boolean");
    });

    it("should only initialize once even with concurrent calls", async () => {
      // Call getInstance multiple times concurrently
      const [instance1, instance2, instance3] = await Promise.all([
        EnvironmentCapabilities.getInstance(),
        EnvironmentCapabilities.getInstance(),
        EnvironmentCapabilities.getInstance(),
      ]);

      expect(instance1).toBe(instance2);
      expect(instance2).toBe(instance3);
    });
  });

  describe("getInstanceSync", () => {
    it("should return conservative values when not initialized", () => {
      // Not initialized yet
      expect(EnvironmentCapabilities.isInitialized()).toBe(false);

      const instance = EnvironmentCapabilities.getInstanceSync();

      // Conservative values
      expect(instance.gpu).toBe(false); // GPU unknown, assume false
      expect(instance.wasm).toBe(true); // WebAssembly available in Node.js
    });

    it("should return cached instance when already initialized", async () => {
      // First initialize async
      const asyncInstance = await EnvironmentCapabilities.getInstance();

      // Then get sync
      const syncInstance = EnvironmentCapabilities.getInstanceSync();

      expect(syncInstance).toBe(asyncInstance);
    });
  });

  describe("isInitialized", () => {
    it("should return false before initialization", () => {
      expect(EnvironmentCapabilities.isInitialized()).toBe(false);
    });

    it("should return true after initialization", async () => {
      await EnvironmentCapabilities.getInstance();
      expect(EnvironmentCapabilities.isInitialized()).toBe(true);
    });
  });

  describe("reset", () => {
    it("should clear singleton instance", async () => {
      const instance1 = await EnvironmentCapabilities.getInstance();
      expect(EnvironmentCapabilities.isInitialized()).toBe(true);

      EnvironmentCapabilities.reset();

      expect(EnvironmentCapabilities.isInitialized()).toBe(false);

      const instance2 = await EnvironmentCapabilities.getInstance();
      // After reset, new instance is created
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("GPU detection with mock", () => {
    it("should detect GPU when navigator.gpu is available", async () => {
      // Mock navigator.gpu
      const mockAdapter = { name: "mock-adapter" };
      const mockGpu = {
        requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
      };

      // Save original navigator
      const originalNavigator = globalThis.navigator;

      // Mock navigator
      Object.defineProperty(globalThis, "navigator", {
        value: { gpu: mockGpu },
        configurable: true,
      });

      try {
        const instance = await EnvironmentCapabilities.getInstance();
        expect(instance.gpu).toBe(true);
        expect(mockGpu.requestAdapter).toHaveBeenCalled();
      } finally {
        // Restore navigator
        Object.defineProperty(globalThis, "navigator", {
          value: originalNavigator,
          configurable: true,
        });
      }
    });

    it("should return false when requestAdapter returns null", async () => {
      // Mock navigator.gpu returning null adapter
      const mockGpu = {
        requestAdapter: vi.fn().mockResolvedValue(null),
      };

      const originalNavigator = globalThis.navigator;

      Object.defineProperty(globalThis, "navigator", {
        value: { gpu: mockGpu },
        configurable: true,
      });

      try {
        const instance = await EnvironmentCapabilities.getInstance();
        expect(instance.gpu).toBe(false);
      } finally {
        Object.defineProperty(globalThis, "navigator", {
          value: originalNavigator,
          configurable: true,
        });
      }
    });

    it("should return false when requestAdapter throws", async () => {
      // Mock navigator.gpu that throws
      const mockGpu = {
        requestAdapter: vi.fn().mockRejectedValue(new Error("GPU error")),
      };

      const originalNavigator = globalThis.navigator;

      Object.defineProperty(globalThis, "navigator", {
        value: { gpu: mockGpu },
        configurable: true,
      });

      try {
        const instance = await EnvironmentCapabilities.getInstance();
        expect(instance.gpu).toBe(false);
      } finally {
        Object.defineProperty(globalThis, "navigator", {
          value: originalNavigator,
          configurable: true,
        });
      }
    });
  });

  describe("Capability properties", () => {
    it("should have readonly properties", async () => {
      const instance = await EnvironmentCapabilities.getInstance();

      // Properties should exist
      expect("gpu" in instance).toBe(true);
      expect("wasm" in instance).toBe(true);
      expect("transferableStreams" in instance).toBe(true);

      // Properties should be boolean
      expect(typeof instance.gpu).toBe("boolean");
      expect(typeof instance.wasm).toBe("boolean");
      expect(typeof instance.transferableStreams).toBe("boolean");
    });
  });
});

describe("WorkerEnvironmentCapabilities", () => {
  beforeEach(() => {
    WorkerEnvironmentCapabilities.reset();
  });

  afterEach(() => {
    WorkerEnvironmentCapabilities.reset();
    vi.restoreAllMocks();
  });

  describe("getInstance", () => {
    it("should return singleton instance", async () => {
      const instance1 = await WorkerEnvironmentCapabilities.getInstance();
      const instance2 = await WorkerEnvironmentCapabilities.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should detect WASM availability", async () => {
      const instance = await WorkerEnvironmentCapabilities.getInstance();
      expect(instance.wasm).toBe(true);
    });

    it("should detect GPU unavailability in Node.js", async () => {
      const instance = await WorkerEnvironmentCapabilities.getInstance();
      expect(instance.gpu).toBe(false);
    });
  });

  describe("isInitialized", () => {
    it("should return false before initialization", () => {
      expect(WorkerEnvironmentCapabilities.isInitialized()).toBe(false);
    });

    it("should return true after initialization", async () => {
      await WorkerEnvironmentCapabilities.getInstance();
      expect(WorkerEnvironmentCapabilities.isInitialized()).toBe(true);
    });
  });

  describe("reset", () => {
    it("should clear singleton instance", async () => {
      await WorkerEnvironmentCapabilities.getInstance();
      expect(WorkerEnvironmentCapabilities.isInitialized()).toBe(true);

      WorkerEnvironmentCapabilities.reset();

      expect(WorkerEnvironmentCapabilities.isInitialized()).toBe(false);
    });
  });

  describe("Capability properties", () => {
    it("should have gpu and wasm properties", async () => {
      const instance = await WorkerEnvironmentCapabilities.getInstance();

      expect("gpu" in instance).toBe(true);
      expect("wasm" in instance).toBe(true);

      expect(typeof instance.gpu).toBe("boolean");
      expect(typeof instance.wasm).toBe("boolean");
    });

    it("should not have transferableStreams property", async () => {
      const instance = await WorkerEnvironmentCapabilities.getInstance();
      // WorkerEnvironmentCapabilities doesn't track transferableStreams
      expect("transferableStreams" in instance).toBe(false);
    });
  });
});
