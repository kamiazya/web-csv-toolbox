import { describe, expect, it, vi } from "vitest";
import { EnginePresets } from "./EnginePresets.ts";
import { ReusableWorkerPool as WorkerPool } from "./worker/helpers/ReusableWorkerPool.ts";

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
      // biome-ignore lint/performance/noDelete: Testing immutability
      delete EnginePresets.fastest;
    }).toThrow(TypeError);
  });

  describe("mainThread", () => {
    it("should return correct configuration without options", () => {
      expect(EnginePresets.mainThread()).toEqual({
        worker: false,
        wasm: false,
      });
    });

    it("should ignore options (main thread doesn't use them)", () => {
      const pool = new WorkerPool({ maxWorkers: 4 });
      const config = EnginePresets.mainThread({ workerPool: pool });
      expect(config).toEqual({
        worker: false,
        wasm: false,
        workerPool: pool,
      });
    });
  });

  describe("worker", () => {
    it("should return correct configuration without options", () => {
      expect(EnginePresets.worker()).toEqual({
        worker: true,
        wasm: false,
        workerStrategy: "message-streaming",
      });
    });

    it("should accept workerPool option", () => {
      const pool = new WorkerPool({ maxWorkers: 4 });
      const config = EnginePresets.worker({ workerPool: pool });
      expect(config).toEqual({
        worker: true,
        wasm: false,
        workerStrategy: "message-streaming",
        workerPool: pool,
      });
    });

    it("should accept workerURL option", () => {
      const config = EnginePresets.worker({ workerURL: "/custom-worker.js" });
      expect(config).toEqual({
        worker: true,
        wasm: false,
        workerStrategy: "message-streaming",
        workerURL: "/custom-worker.js",
      });
    });

    it("should accept onFallback callback", () => {
      const onFallback = vi.fn();
      const config = EnginePresets.worker({ onFallback });
      expect(config.onFallback).toBe(onFallback);
    });
  });

  describe("workerStreamTransfer", () => {
    it("should return correct configuration without options", () => {
      expect(EnginePresets.workerStreamTransfer()).toEqual({
        worker: true,
        wasm: false,
        workerStrategy: "stream-transfer",
      });
    });

    it("should accept all options", () => {
      const pool = new WorkerPool({ maxWorkers: 4 });
      const onFallback = vi.fn();
      const config = EnginePresets.workerStreamTransfer({
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

  describe("wasm", () => {
    it("should return correct configuration without options", () => {
      expect(EnginePresets.wasm()).toEqual({
        worker: false,
        wasm: true,
      });
    });
  });

  describe("workerWasm", () => {
    it("should return correct configuration without options", () => {
      expect(EnginePresets.workerWasm()).toEqual({
        worker: true,
        wasm: true,
        workerStrategy: "message-streaming",
      });
    });

    it("should accept workerPool option", () => {
      const pool = new WorkerPool({ maxWorkers: 4 });
      const config = EnginePresets.workerWasm({ workerPool: pool });
      expect(config).toEqual({
        worker: true,
        wasm: true,
        workerStrategy: "message-streaming",
        workerPool: pool,
      });
    });
  });

  describe("fastest", () => {
    it("should return correct configuration without options", () => {
      expect(EnginePresets.fastest()).toEqual({
        worker: true,
        wasm: true,
        workerStrategy: "stream-transfer",
      });
    });

    it("should accept workerPool option", () => {
      const pool = new WorkerPool({ maxWorkers: 4 });
      const config = EnginePresets.fastest({ workerPool: pool });
      expect(config).toEqual({
        worker: true,
        wasm: true,
        workerStrategy: "stream-transfer",
        workerPool: pool,
      });
    });

    it("should match inline snapshot", () => {
      expect(EnginePresets.fastest()).toMatchInlineSnapshot(`
        {
          "wasm": true,
          "worker": true,
          "workerStrategy": "stream-transfer",
        }
      `);
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

  describe("strict", () => {
    it("should return correct configuration without options", () => {
      expect(EnginePresets.strict()).toEqual({
        worker: true,
        wasm: false,
        workerStrategy: "stream-transfer",
        strict: true,
      });
    });

    it("should accept workerPool option", () => {
      const pool = new WorkerPool({ maxWorkers: 4 });
      const config = EnginePresets.strict({ workerPool: pool });
      expect(config).toEqual({
        worker: true,
        wasm: false,
        workerStrategy: "stream-transfer",
        strict: true,
        workerPool: pool,
      });
    });

    it("should match inline snapshot", () => {
      expect(EnginePresets.strict()).toMatchInlineSnapshot(`
        {
          "strict": true,
          "wasm": false,
          "worker": true,
          "workerStrategy": "stream-transfer",
        }
      `);
    });
  });

  describe("Integration tests", () => {
    it("should create new config objects each call (not cached)", () => {
      const config1 = EnginePresets.fastest();
      const config2 = EnginePresets.fastest();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects
    });

    it("should allow customization per call", () => {
      const pool1 = new WorkerPool({ maxWorkers: 2 });
      const pool2 = new WorkerPool({ maxWorkers: 4 });

      const config1 = EnginePresets.fastest({ workerPool: pool1 });
      const config2 = EnginePresets.fastest({ workerPool: pool2 });

      expect(config1.workerPool).toBe(pool1);
      expect(config2.workerPool).toBe(pool2);
    });

    it("should support all preset names as type", () => {
      const presets: Array<keyof typeof EnginePresets> = [
        "mainThread",
        "worker",
        "workerStreamTransfer",
        "wasm",
        "workerWasm",
        "fastest",
        "balanced",
        "strict",
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
      const config1 = EnginePresets.balanced({ workerPool: sharedPool });
      expect(config1.workerPool).toBe(sharedPool);

      // Request 2
      const config2 = EnginePresets.balanced({ workerPool: sharedPool });
      expect(config2.workerPool).toBe(sharedPool);

      // Different config objects but same pool
      expect(config1).not.toBe(config2);
      expect(config1.workerPool).toBe(config2.workerPool);
    });

    it("should work with custom worker URL", () => {
      const config = EnginePresets.fastest({
        workerURL: new URL("/workers/csv-parser.js", "https://example.com"),
      });

      expect(config.workerURL).toBeInstanceOf(URL);
      expect(config.workerURL?.toString()).toBe(
        "https://example.com/workers/csv-parser.js",
      );
    });

    it("should work with fallback callback", () => {
      const fallbacks: any[] = [];

      const config = EnginePresets.fastest({
        onFallback: (info) => fallbacks.push(info),
      });

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
