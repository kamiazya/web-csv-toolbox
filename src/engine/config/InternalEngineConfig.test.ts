import { describe, expect, it } from "vitest";
import type { WorkerEngineConfig } from "@/core/types.ts";
import {
  EngineFlags,
  InternalEngineConfig,
} from "@/engine/config/InternalEngineConfig.ts";

describe("InternalEngineConfig", () => {
  describe("Constructor and parsing", () => {
    it("should create default config with no options", () => {
      const config = new InternalEngineConfig();
      expect(config.hasWorker()).toBe(false);
      expect(config.hasWasm()).toBe(false);
      expect(config.hasStreamTransfer()).toBe(false);
      expect(config.hasMessageStreaming()).toBe(false);
      expect(config.hasStrict()).toBe(false);
    });

    it("should parse worker flag", () => {
      const config = new InternalEngineConfig({ worker: true });
      expect(config.hasWorker()).toBe(true);
      expect(config.hasWasm()).toBe(false);
    });

    it("should parse wasm flag", () => {
      const config = new InternalEngineConfig({ wasm: true });
      expect(config.hasWorker()).toBe(false);
      expect(config.hasWasm()).toBe(true);
    });

    it("should parse worker + wasm", () => {
      const config = new InternalEngineConfig({ worker: true, wasm: true });
      expect(config.hasWorker()).toBe(true);
      expect(config.hasWasm()).toBe(true);
    });

    it("should parse stream-transfer strategy", () => {
      const config = new InternalEngineConfig({
        worker: true,
        workerStrategy: "stream-transfer",
      });
      expect(config.hasWorker()).toBe(true);
      expect(config.hasStreamTransfer()).toBe(true);
      expect(config.hasMessageStreaming()).toBe(false);
      expect(config.getWorkerStrategy()).toBe("stream-transfer");
    });

    it("should parse message-streaming strategy", () => {
      const config = new InternalEngineConfig({
        worker: true,
        workerStrategy: "message-streaming",
      });
      expect(config.hasWorker()).toBe(true);
      expect(config.hasMessageStreaming()).toBe(true);
      expect(config.hasStreamTransfer()).toBe(false);
      expect(config.getWorkerStrategy()).toBe("message-streaming");
    });

    it("should parse strict flag", () => {
      const config = new InternalEngineConfig({
        worker: true,
        workerStrategy: "stream-transfer",
        strict: true,
      });
      expect(config.hasStrict()).toBe(true);
    });

    it("should store workerURL", () => {
      const url = "/custom-worker.js";
      const config = new InternalEngineConfig({ worker: true, workerURL: url });
      expect(config.workerURL).toBe(url);
    });

    it("should store workerURL as URL object", () => {
      const url = new URL("/worker.js", "https://example.com");
      const config = new InternalEngineConfig({ worker: true, workerURL: url });
      expect(config.workerURL).toBe(url);
    });

    it("should store onFallback callback", () => {
      const callback = () => {};
      const config = new InternalEngineConfig({
        worker: true,
        onFallback: callback,
      });
      expect(config.onFallback).toBe(callback);
    });
  });

  describe("Default application", () => {
    it("should default to message-streaming when worker is true but no strategy specified", () => {
      const config = new InternalEngineConfig({ worker: true });
      expect(config.hasWorker()).toBe(true);
      expect(config.hasMessageStreaming()).toBe(true);
      expect(config.hasStreamTransfer()).toBe(false);
      expect(config.getWorkerStrategy()).toBe("message-streaming");
    });

    it("should not apply defaults when strategy is explicitly set", () => {
      const config = new InternalEngineConfig({
        worker: true,
        workerStrategy: "stream-transfer",
      });
      expect(config.hasStreamTransfer()).toBe(true);
      expect(config.hasMessageStreaming()).toBe(false);
    });

    it("should not apply worker defaults when worker is false", () => {
      const config = new InternalEngineConfig({ worker: false });
      expect(config.hasWorker()).toBe(false);
      expect(config.hasMessageStreaming()).toBe(false);
      expect(config.hasStreamTransfer()).toBe(false);
    });
  });

  describe("Validation", () => {
    it("should throw error if workerStrategy is set without worker", () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new InternalEngineConfig({ workerStrategy: "stream-transfer" } as any);
      }).toThrow("workerStrategy requires worker: true in engine config");
    });

    it("should throw error if strict is set without stream-transfer", () => {
      expect(() => {
        new InternalEngineConfig({
          worker: true,
          workerStrategy: "message-streaming",
          strict: true,
        });
      }).toThrow(
        'strict requires workerStrategy: "stream-transfer" in engine config',
      );
    });

    it("should throw error if strict is set without worker", () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new InternalEngineConfig({ strict: true } as any);
      }).toThrow('strict requires workerStrategy: "stream-transfer"');
    });

    it("should allow strict with stream-transfer", () => {
      expect(() => {
        new InternalEngineConfig({
          worker: true,
          workerStrategy: "stream-transfer",
          strict: true,
        });
      }).not.toThrow();
    });
  });

  describe("Bitmask operations", () => {
    it("should set correct bitmask for worker", () => {
      const config = new InternalEngineConfig({ worker: true });
      // Worker (1) + MessageStreaming (8) = 9
      expect(config.getBitmask()).toBe(
        EngineFlags.WORKER | EngineFlags.MESSAGE_STREAMING,
      );
    });

    it("should set correct bitmask for wasm", () => {
      const config = new InternalEngineConfig({ wasm: true });
      expect(config.getBitmask()).toBe(EngineFlags.WASM);
    });

    it("should set correct bitmask for worker + wasm + stream-transfer", () => {
      const config = new InternalEngineConfig({
        worker: true,
        wasm: true,
        workerStrategy: "stream-transfer",
      });
      expect(config.getBitmask()).toBe(
        EngineFlags.WORKER | EngineFlags.WASM | EngineFlags.STREAM_TRANSFER,
      );
    });

    it("should set correct bitmask for worker + wasm + message-streaming", () => {
      const config = new InternalEngineConfig({
        worker: true,
        wasm: true,
        workerStrategy: "message-streaming",
      });
      expect(config.getBitmask()).toBe(
        EngineFlags.WORKER | EngineFlags.WASM | EngineFlags.MESSAGE_STREAMING,
      );
    });

    it("should set correct bitmask for strict mode", () => {
      const config = new InternalEngineConfig({
        worker: true,
        workerStrategy: "stream-transfer",
        strict: true,
      });
      expect(config.getBitmask()).toBe(
        EngineFlags.WORKER | EngineFlags.STREAM_TRANSFER | EngineFlags.STRICT,
      );
    });
  });

  describe("Fallback config creation", () => {
    it("should convert stream-transfer to message-streaming", () => {
      const config = new InternalEngineConfig({
        worker: true,
        workerStrategy: "stream-transfer",
      });
      const fallback = config.createFallbackConfig();

      expect(fallback.hasWorker()).toBe(true);
      expect(fallback.hasStreamTransfer()).toBe(false);
      expect(fallback.hasMessageStreaming()).toBe(true);
      expect(fallback.getWorkerStrategy()).toBe("message-streaming");
    });

    it("should disable strict mode in fallback", () => {
      const config = new InternalEngineConfig({
        worker: true,
        workerStrategy: "stream-transfer",
        strict: true,
      });
      const fallback = config.createFallbackConfig();

      expect(fallback.hasStrict()).toBe(false);
    });

    it("should preserve worker and wasm flags", () => {
      const config = new InternalEngineConfig({
        worker: true,
        wasm: true,
        workerStrategy: "stream-transfer",
      });
      const fallback = config.createFallbackConfig();

      expect(fallback.hasWorker()).toBe(true);
      expect(fallback.hasWasm()).toBe(true);
    });

    it("should preserve workerURL in fallback", () => {
      const url = "/custom-worker.js";
      const config = new InternalEngineConfig({
        worker: true,
        workerStrategy: "stream-transfer",
        workerURL: url,
      });
      const fallback = config.createFallbackConfig();

      expect(fallback.workerURL).toBe(url);
    });

    it("should preserve onFallback callback in fallback", () => {
      const callback = () => {};
      const config = new InternalEngineConfig({
        worker: true,
        workerStrategy: "stream-transfer",
        onFallback: callback,
      });
      const fallback = config.createFallbackConfig();

      expect(fallback.onFallback).toBe(callback);
    });

    it("should not modify message-streaming config in fallback", () => {
      const config = new InternalEngineConfig({
        worker: true,
        workerStrategy: "message-streaming",
      });
      const fallback = config.createFallbackConfig();

      expect(fallback.hasMessageStreaming()).toBe(true);
      expect(fallback.hasStreamTransfer()).toBe(false);
    });
  });

  describe("toConfig conversion", () => {
    it("should convert to EngineConfig with worker", () => {
      const config = new InternalEngineConfig({ worker: true });
      const engineConfig = config.toConfig() as WorkerEngineConfig;

      expect(engineConfig.worker).toBe(true);
      expect(engineConfig.wasm).toBeUndefined();
      expect(engineConfig.workerStrategy).toBe("message-streaming");
    });

    it("should convert to EngineConfig with wasm", () => {
      const config = new InternalEngineConfig({ wasm: true });
      const engineConfig = config.toConfig();

      expect(engineConfig.worker).toBe(false);
      expect(engineConfig.wasm).toBe(true);
    });

    it("should convert to EngineConfig with all flags", () => {
      const url = "/custom-worker.js";
      const callback = () => {};
      const config = new InternalEngineConfig({
        worker: true,
        wasm: true,
        workerStrategy: "stream-transfer",
        strict: true,
        workerURL: url,
        onFallback: callback,
      });
      const engineConfig = config.toConfig() as WorkerEngineConfig;

      expect(engineConfig.worker).toBe(true);
      expect(engineConfig.wasm).toBe(true);
      expect(engineConfig.workerStrategy).toBe("stream-transfer");
      expect(engineConfig.strict).toBe(true);
      expect(engineConfig.workerURL).toBe(url);
      expect(engineConfig.onFallback).toBe(callback);
    });

    it("should return undefined for unset flags", () => {
      const config = new InternalEngineConfig();
      const engineConfig = config.toConfig();

      expect(engineConfig.worker).toBe(false);
      expect(engineConfig.wasm).toBeUndefined();
      // workerStrategy and strict are not accessible in MainThreadEngineConfig
      expect("workerStrategy" in engineConfig).toBe(false);
      expect("strict" in engineConfig).toBe(false);
    });
  });

  describe("toString debugging", () => {
    it("should return 'main' for default config", () => {
      const config = new InternalEngineConfig();
      expect(config.toString()).toBe("main");
    });

    it("should return 'worker + message-streaming' for worker config", () => {
      const config = new InternalEngineConfig({ worker: true });
      expect(config.toString()).toBe("worker + message-streaming");
    });

    it("should return 'wasm' for wasm config", () => {
      const config = new InternalEngineConfig({ wasm: true });
      expect(config.toString()).toBe("wasm");
    });

    it("should return all enabled features", () => {
      const config = new InternalEngineConfig({
        worker: true,
        wasm: true,
        workerStrategy: "stream-transfer",
        strict: true,
      });
      expect(config.toString()).toBe(
        "worker + wasm + stream-transfer + strict",
      );
    });
  });

  describe("EngineFlags enum", () => {
    it("should have correct bitmask values", () => {
      expect(EngineFlags.WORKER).toBe(1);
      expect(EngineFlags.WASM).toBe(2);
      expect(EngineFlags.STREAM_TRANSFER).toBe(4);
      expect(EngineFlags.MESSAGE_STREAMING).toBe(8);
      expect(EngineFlags.STRICT).toBe(16);
    });

    it("should support bitwise operations", () => {
      const combined =
        EngineFlags.WORKER | EngineFlags.WASM | EngineFlags.STREAM_TRANSFER;
      expect(combined & EngineFlags.WORKER).toBe(EngineFlags.WORKER);
      expect(combined & EngineFlags.WASM).toBe(EngineFlags.WASM);
      expect(combined & EngineFlags.STREAM_TRANSFER).toBe(
        EngineFlags.STREAM_TRANSFER,
      );
      expect(combined & EngineFlags.MESSAGE_STREAMING).toBe(0);
    });
  });

  describe("Edge cases", () => {
    it("should handle undefined config", () => {
      const config = new InternalEngineConfig(undefined);
      expect(config.hasWorker()).toBe(false);
      expect(config.hasWasm()).toBe(false);
    });

    it("should handle empty config object", () => {
      const config = new InternalEngineConfig({});
      expect(config.hasWorker()).toBe(false);
      expect(config.hasWasm()).toBe(false);
    });

    it("should handle false values explicitly", () => {
      const config = new InternalEngineConfig({
        worker: false,
        wasm: false,
        strict: false,
      } as any);
      expect(config.hasWorker()).toBe(false);
      expect(config.hasWasm()).toBe(false);
      expect(config.hasStrict()).toBe(false);
    });
  });
});
