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

  describe("stable", () => {
    it("should return correct configuration without options", () => {
      expect(EnginePresets.stable()).toEqual({
        worker: false,
        wasm: false,
        optimizationHint: "responsive",
      });
    });

    it("should accept custom optimizationHint", () => {
      const config = EnginePresets.stable({ optimizationHint: "consistency" });
      expect(config).toEqual({
        worker: false,
        wasm: false,
        optimizationHint: "consistency",
      });
    });
  });

  describe("recommended", () => {
    it("should return correct configuration without options", () => {
      expect(EnginePresets.recommended()).toEqual({
        worker: true,
        wasm: false, // JS is faster than WASM
        workerStrategy: "stream-transfer",
        optimizationHint: "balanced",
      });
    });

    it("should accept workerPool option", () => {
      const pool = new WorkerPool({ maxWorkers: 4 });
      const config = EnginePresets.recommended({ workerPool: pool });
      expect(config).toEqual({
        worker: true,
        wasm: false,
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
        wasm: false,
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

    it("should accept all options together", () => {
      const pool = new WorkerPool({ maxWorkers: 4 });
      const onFallback = vi.fn();
      const config = EnginePresets.recommended({
        workerPool: pool,
        workerURL: "/worker.js",
        onFallback,
        optimizationHint: "speed",
      });
      expect(config).toEqual({
        worker: true,
        wasm: false,
        workerStrategy: "stream-transfer",
        optimizationHint: "speed",
        workerPool: pool,
        workerURL: "/worker.js",
        onFallback,
      });
    });

    it("should match inline snapshot", () => {
      expect(EnginePresets.recommended()).toMatchInlineSnapshot(`
        {
          "optimizationHint": "balanced",
          "wasm": false,
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
        wasm: false, // JS is faster than WASM
        gpu: true,
        optimizationHint: "speed",
      });
    });

    it("should accept custom optimizationHint", () => {
      const config = EnginePresets.turbo({ optimizationHint: "balanced" });
      expect(config).toEqual({
        worker: false,
        wasm: false,
        gpu: true,
        optimizationHint: "balanced",
      });
    });
  });

  describe("Integration tests", () => {
    it("should create new config objects each call (not cached)", () => {
      const config1 = EnginePresets.turbo();
      const config2 = EnginePresets.turbo();

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

    it("should support all preset names as type", () => {
      const presets: Array<keyof typeof EnginePresets> = [
        "stable",
        "recommended",
        "turbo",
      ];

      for (const presetName of presets) {
        const config = EnginePresets[presetName]();
        expect(config).toBeDefined();
        expect(typeof config).toBe("object");
      }
    });
  });

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

    it("should work with fallback callback", () => {
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
          worker: true,
          wasm: true,
          workerStrategy: "message-streaming",
        },
        reason: "Transferable streams not supported",
      });

      expect(fallbacks).toHaveLength(1);
      expect(fallbacks[0].reason).toBe("Transferable streams not supported");
    });

    it("should allow overriding defaults with custom optimization hints", () => {
      // stable with speed optimization
      const stableSpeed = EnginePresets.stable({ optimizationHint: "speed" });
      expect(stableSpeed.optimizationHint).toBe("speed");

      // recommended with consistency optimization
      const recommendedConsistency = EnginePresets.recommended({
        optimizationHint: "consistency",
      });
      expect(recommendedConsistency.optimizationHint).toBe("consistency");

      // turbo with responsive optimization
      const turboResponsive = EnginePresets.turbo({
        optimizationHint: "responsive",
      });
      expect(turboResponsive.optimizationHint).toBe("responsive");
    });
  });
});
