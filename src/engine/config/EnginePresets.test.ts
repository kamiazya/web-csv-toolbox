import { describe, expect, it, vi } from "vitest";
import type { WorkerEngineConfig } from "@/core/types.ts";
import { EnginePresets } from "@/engine/config/EnginePresets.ts";
import { ReusableWorkerPool as WorkerPool } from "@/worker/helpers/ReusableWorkerPool.node.ts";

describe("EnginePresets", () => {
  it("should be frozen (immutable)", () => {
    expect(Object.isFrozen(EnginePresets)).toBe(true);
  });

  it("should throw when attempting to add new presets", () => {
    expect(() => {
      // @ts-expect-error - Intentionally trying to mutate frozen object
      EnginePresets.custom = () => ({ worker: false });
    }).toThrow(TypeError);
  });

  it("should throw when attempting to delete presets", () => {
    expect(() => {
      // @ts-expect-error - Intentionally trying to mutate frozen object
      delete EnginePresets.stable;
    }).toThrow(TypeError);
  });

  // ============================================
  // Main Presets (stable, recommended, turbo)
  // ============================================

  describe("stable", () => {
    it("should return correct configuration without options", () => {
      expect(EnginePresets.stable()).toEqual({
        worker: false,
        wasm: false,
        gpu: false,
        optimizationHint: "responsive",
      });
    });

    it("should accept onFallback callback", () => {
      const onFallback = vi.fn();
      const config = EnginePresets.stable({ onFallback });
      expect(config.onFallback).toBe(onFallback);
    });

    it("should allow overriding optimizationHint", () => {
      const config = EnginePresets.stable({ optimizationHint: "speed" });
      expect(config.optimizationHint).toBe("speed");
    });

    it("should match inline snapshot", () => {
      expect(EnginePresets.stable()).toMatchInlineSnapshot(`
        {
          "gpu": false,
          "optimizationHint": "responsive",
          "wasm": false,
          "worker": false,
        }
      `);
    });
  });

  describe("recommended", () => {
    it("should return correct configuration without options", () => {
      expect(EnginePresets.recommended()).toEqual({
        worker: true,
        wasm: true,
        gpu: false,
        workerStrategy: "stream-transfer",
        optimizationHint: "balanced",
      });
    });

    it("should accept workerPool option", () => {
      const pool = new WorkerPool({ maxWorkers: 4 });
      const config = EnginePresets.recommended({ workerPool: pool });
      expect(config).toEqual({
        worker: true,
        wasm: true,
        gpu: false,
        workerStrategy: "stream-transfer",
        optimizationHint: "balanced",
        workerPool: pool,
      });
    });

    it("should accept workerURL option", () => {
      const config = EnginePresets.recommended({
        workerURL: "/custom-worker.js",
      });
      expect(config).toEqual({
        worker: true,
        wasm: true,
        gpu: false,
        workerStrategy: "stream-transfer",
        optimizationHint: "balanced",
        workerURL: "/custom-worker.js",
      });
    });

    it("should accept onFallback callback", () => {
      const onFallback = vi.fn();
      const config = EnginePresets.recommended({
        onFallback,
      }) as WorkerEngineConfig;
      expect(config.onFallback).toBe(onFallback);
    });

    it("should allow overriding optimizationHint", () => {
      const config = EnginePresets.recommended({ optimizationHint: "speed" });
      expect(config.optimizationHint).toBe("speed");
    });

    it("should match inline snapshot", () => {
      expect(EnginePresets.recommended()).toMatchInlineSnapshot(`
        {
          "gpu": false,
          "optimizationHint": "balanced",
          "wasm": true,
          "worker": true,
          "workerStrategy": "stream-transfer",
        }
      `);
    });
  });

  describe("turbo", () => {
    it("should return correct configuration without options", () => {
      expect(EnginePresets.turbo()).toEqual({
        worker: false,
        wasm: true,
        gpu: true,
        optimizationHint: "speed",
      });
    });

    it("should accept onFallback callback", () => {
      const onFallback = vi.fn();
      const config = EnginePresets.turbo({ onFallback });
      expect(config.onFallback).toBe(onFallback);
    });

    it("should allow overriding optimizationHint", () => {
      const config = EnginePresets.turbo({ optimizationHint: "balanced" });
      expect(config.optimizationHint).toBe("balanced");
    });

    it("should match inline snapshot", () => {
      expect(EnginePresets.turbo()).toMatchInlineSnapshot(`
        {
          "gpu": true,
          "optimizationHint": "speed",
          "wasm": true,
          "worker": false,
        }
      `);
    });
  });

  // ============================================
  // Deprecated Aliases
  // ============================================

  describe("deprecated aliases", () => {
    describe("balanced (alias for recommended)", () => {
      it("should return same configuration as recommended", () => {
        expect(EnginePresets.balanced()).toEqual(EnginePresets.recommended());
      });

      it("should pass options through", () => {
        const onFallback = vi.fn();
        expect(EnginePresets.balanced({ onFallback })).toEqual(
          EnginePresets.recommended({ onFallback }),
        );
      });
    });

    describe("responsive (alias for recommended)", () => {
      it("should return same configuration as recommended", () => {
        expect(EnginePresets.responsive()).toEqual(EnginePresets.recommended());
      });
    });

    describe("memoryEfficient (alias for recommended)", () => {
      it("should return same configuration as recommended", () => {
        expect(EnginePresets.memoryEfficient()).toEqual(
          EnginePresets.recommended(),
        );
      });
    });

    describe("fast (alias for turbo)", () => {
      it("should return same configuration as turbo", () => {
        expect(EnginePresets.fast()).toEqual(EnginePresets.turbo());
      });
    });

    describe("responsiveFast (alias for turbo)", () => {
      it("should return same configuration as turbo", () => {
        expect(EnginePresets.responsiveFast()).toEqual(EnginePresets.turbo());
      });
    });

    describe("gpuAccelerated (alias for turbo)", () => {
      it("should return same configuration as turbo", () => {
        expect(EnginePresets.gpuAccelerated()).toEqual(EnginePresets.turbo());
      });
    });

    describe("ultraFast (alias for turbo)", () => {
      it("should return same configuration as turbo", () => {
        expect(EnginePresets.ultraFast()).toEqual(EnginePresets.turbo());
      });
    });
  });

  // ============================================
  // Integration Tests
  // ============================================

  describe("Integration tests", () => {
    it("should create new config objects each call (not cached)", () => {
      const config1 = EnginePresets.recommended();
      const config2 = EnginePresets.recommended();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects
    });

    it("should allow customization per call", () => {
      const pool1 = new WorkerPool({ maxWorkers: 2 });
      const pool2 = new WorkerPool({ maxWorkers: 4 });

      const config1 = EnginePresets.recommended({
        workerPool: pool1,
      }) as WorkerEngineConfig;
      const config2 = EnginePresets.recommended({
        workerPool: pool2,
      }) as WorkerEngineConfig;

      expect(config1.workerPool).toBe(pool1);
      expect(config2.workerPool).toBe(pool2);
    });

    it("should support all main preset names", () => {
      const mainPresets: Array<"stable" | "recommended" | "turbo"> = [
        "stable",
        "recommended",
        "turbo",
      ];

      for (const presetName of mainPresets) {
        const config = EnginePresets[presetName]();
        expect(config).toBeDefined();
        expect(typeof config).toBe("object");
      }
    });

    it("should support all deprecated preset names", () => {
      const deprecatedPresets: Array<keyof typeof EnginePresets> = [
        "balanced",
        "responsive",
        "memoryEfficient",
        "fast",
        "responsiveFast",
        "gpuAccelerated",
        "ultraFast",
      ];

      for (const presetName of deprecatedPresets) {
        const config = EnginePresets[presetName]();
        expect(config).toBeDefined();
        expect(typeof config).toBe("object");
      }
    });
  });

  // ============================================
  // Real-world Usage Patterns
  // ============================================

  describe("Real-world usage patterns", () => {
    it("should work in server environment with shared pool", () => {
      // Simulating a server with a shared worker pool
      const sharedPool = new WorkerPool({ maxWorkers: 4 });

      // Request 1
      const config1 = EnginePresets.recommended({
        workerPool: sharedPool,
      }) as WorkerEngineConfig;
      expect(config1.workerPool).toBe(sharedPool);

      // Request 2
      const config2 = EnginePresets.recommended({
        workerPool: sharedPool,
      }) as WorkerEngineConfig;
      expect(config2.workerPool).toBe(sharedPool);

      // Different config objects but same pool
      expect(config1).not.toBe(config2);
      expect(config1.workerPool).toBe(config2.workerPool);
    });

    it("should work with custom worker URL", () => {
      const config = EnginePresets.recommended({
        workerURL: new URL("/workers/csv-parser.js", "https://example.com"),
      }) as WorkerEngineConfig;

      expect(config.workerURL).toBeInstanceOf(URL);
      expect(config.workerURL?.toString()).toBe(
        "https://example.com/workers/csv-parser.js",
      );
    });

    it("should work with fallback callback for turbo preset", () => {
      const fallbacks: any[] = [];

      const config = EnginePresets.turbo({
        onFallback: (info) => fallbacks.push(info),
      });

      // Simulate fallback
      config.onFallback?.({
        requestedConfig: {
          worker: false,
          wasm: true,
          gpu: true,
        },
        actualConfig: {
          worker: false,
          wasm: true,
          gpu: false,
        },
        reason: "WebGPU not supported",
      });

      expect(fallbacks).toHaveLength(1);
      expect(fallbacks[0].reason).toBe("WebGPU not supported");
    });

    it("should work with fallback callback for recommended preset", () => {
      const fallbacks: any[] = [];

      const config = EnginePresets.recommended({
        onFallback: (info) => fallbacks.push(info),
      }) as WorkerEngineConfig;

      // Simulate fallback
      config.onFallback?.({
        requestedConfig: {
          worker: true,
          wasm: true,
          workerStrategy: "stream-transfer",
        },
        actualConfig: {
          worker: false,
          wasm: true,
        },
        reason: "Transferable streams not supported",
      });

      expect(fallbacks).toHaveLength(1);
      expect(fallbacks[0].reason).toBe("Transferable streams not supported");
    });
  });
});
