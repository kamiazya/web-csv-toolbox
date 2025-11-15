import { describe, expect, it, vi } from "vitest";
import type { WorkerEngineConfig } from "@/core/types.ts";
import { EnginePresets } from "@/engine/config/EnginePresets.ts";
import { ReusableWorkerPool as WorkerPool } from "@/worker/helpers/ReusableWorkerPool.ts";

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
      });
    });

    it("should ignore options (main thread doesn't use them)", () => {
      const pool = new WorkerPool({ maxWorkers: 4 });
      const config = EnginePresets.stable({ workerPool: pool } as any);
      expect(config).toEqual({
        worker: false,
        wasm: false,
        workerPool: pool,
      });
    });
  });

  describe("responsive", () => {
    it("should return correct configuration without options", () => {
      expect(EnginePresets.responsive()).toEqual({
        worker: true,
        wasm: false,
        workerStrategy: "message-streaming",
      });
    });

    it("should accept workerPool option", () => {
      const pool = new WorkerPool({ maxWorkers: 4 });
      const config = EnginePresets.responsive({ workerPool: pool });
      expect(config).toEqual({
        worker: true,
        wasm: false,
        workerStrategy: "message-streaming",
        workerPool: pool,
      });
    });

    it("should accept workerURL option", () => {
      const config = EnginePresets.responsive({
        workerURL: "/custom-worker.js",
      });
      expect(config).toEqual({
        worker: true,
        wasm: false,
        workerStrategy: "message-streaming",
        workerURL: "/custom-worker.js",
      });
    });

    it("should accept onFallback callback", () => {
      const onFallback = vi.fn();
      const config = EnginePresets.responsive({
        onFallback,
      }) as WorkerEngineConfig;
      expect(config.onFallback).toBe(onFallback);
    });
  });

  describe("memoryEfficient", () => {
    it("should return correct configuration without options", () => {
      expect(EnginePresets.memoryEfficient()).toEqual({
        worker: true,
        wasm: false,
        workerStrategy: "stream-transfer",
      });
    });

    it("should accept all options", () => {
      const pool = new WorkerPool({ maxWorkers: 4 });
      const onFallback = vi.fn();
      const config = EnginePresets.memoryEfficient({
        workerPool: pool,
        workerURL: "/worker.js",
        onFallback,
      });
      expect(config).toEqual({
        worker: true,
        wasm: false,
        workerStrategy: "stream-transfer",
        workerPool: pool,
        workerURL: "/worker.js",
        onFallback,
      });
    });
  });

  describe("fast", () => {
    it("should return correct configuration without options", () => {
      expect(EnginePresets.fast()).toEqual({
        worker: false,
        wasm: true,
      });
    });
  });

  describe("responsiveFast", () => {
    it("should return correct configuration without options", () => {
      expect(EnginePresets.responsiveFast()).toEqual({
        worker: true,
        wasm: true,
        workerStrategy: "message-streaming",
      });
    });

    it("should accept workerPool option", () => {
      const pool = new WorkerPool({ maxWorkers: 4 });
      const config = EnginePresets.responsiveFast({ workerPool: pool });
      expect(config).toEqual({
        worker: true,
        wasm: true,
        workerStrategy: "message-streaming",
        workerPool: pool,
      });
    });
  });

  describe("balanced", () => {
    it("should return correct configuration without options", () => {
      expect(EnginePresets.balanced()).toEqual({
        worker: true,
        wasm: false,
        workerStrategy: "stream-transfer",
      });
    });

    it("should accept workerPool option", () => {
      const pool = new WorkerPool({ maxWorkers: 4 });
      const config = EnginePresets.balanced({ workerPool: pool });
      expect(config).toEqual({
        worker: true,
        wasm: false,
        workerStrategy: "stream-transfer",
        workerPool: pool,
      });
    });

    it("should match inline snapshot", () => {
      expect(EnginePresets.balanced()).toMatchInlineSnapshot(`
        {
          "wasm": false,
          "worker": true,
          "workerStrategy": "stream-transfer",
        }
      `);
    });
  });

  describe("Integration tests", () => {
    it("should create new config objects each call (not cached)", () => {
      const config1 = EnginePresets.responsiveFast();
      const config2 = EnginePresets.responsiveFast();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects
    });

    it("should allow customization per call", () => {
      const pool1 = new WorkerPool({ maxWorkers: 2 });
      const pool2 = new WorkerPool({ maxWorkers: 4 });

      const config1 = EnginePresets.responsiveFast({
        workerPool: pool1,
      }) as WorkerEngineConfig;
      const config2 = EnginePresets.responsiveFast({
        workerPool: pool2,
      }) as WorkerEngineConfig;

      expect(config1.workerPool).toBe(pool1);
      expect(config2.workerPool).toBe(pool2);
    });

    it("should support all preset names as type", () => {
      const presets: Array<keyof typeof EnginePresets> = [
        "stable",
        "responsive",
        "memoryEfficient",
        "fast",
        "responsiveFast",
        "balanced",
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
      const config1 = EnginePresets.balanced({
        workerPool: sharedPool,
      }) as WorkerEngineConfig;
      expect(config1.workerPool).toBe(sharedPool);

      // Request 2
      const config2 = EnginePresets.balanced({
        workerPool: sharedPool,
      }) as WorkerEngineConfig;
      expect(config2.workerPool).toBe(sharedPool);

      // Different config objects but same pool
      expect(config1).not.toBe(config2);
      expect(config1.workerPool).toBe(config2.workerPool);
    });

    it("should work with custom worker URL", () => {
      const config = EnginePresets.responsiveFast({
        workerURL: new URL("/workers/csv-parser.js", "https://example.com"),
      }) as WorkerEngineConfig;

      expect(config.workerURL).toBeInstanceOf(URL);
      expect(config.workerURL?.toString()).toBe(
        "https://example.com/workers/csv-parser.js",
      );
    });

    it("should work with fallback callback", () => {
      const fallbacks: any[] = [];

      const config = EnginePresets.responsiveFast({
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
  });
});
