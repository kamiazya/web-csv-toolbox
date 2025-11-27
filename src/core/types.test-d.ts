import { describe, expectTypeOf, it } from "vitest";
import type {
  CSVRecordAssemblerOptions,
  EngineConfig,
  MainThreadEngineConfig,
  WorkerEngineConfig,
  WorkerEngineConfigDefault,
  WorkerEngineConfigWithPool,
  WorkerEngineConfigWithURL,
  WorkerPool,
} from "@/core/types.ts";

describe("EngineConfig", () => {
  describe("Discriminated Union based on worker property", () => {
    it("MainThreadEngineConfig: worker is false or undefined", () => {
      // When worker is false
      const config1: EngineConfig = {
        worker: false,
        wasm: true,
        arrayBufferThreshold: 2 * 1024 * 1024,
      };

      // config1 extends MainThreadEngineConfig
      expectTypeOf(config1).toExtend<MainThreadEngineConfig>();
      expectTypeOf(config1.worker).toEqualTypeOf<false | undefined>();

      // When worker is not specified
      const config2: EngineConfig = {
        wasm: true,
        backpressureCheckInterval: {
          lexer: 100,
          assembler: 10,
        },
      };

      // config2 also extends MainThreadEngineConfig
      expectTypeOf(config2).toExtend<MainThreadEngineConfig>();
      expectTypeOf(config2.worker).toEqualTypeOf<false | undefined>();

      // Only common properties are available
      expectTypeOf(config1.wasm).toEqualTypeOf<boolean | undefined>();
      expectTypeOf(config1.arrayBufferThreshold).toEqualTypeOf<
        number | undefined
      >();

      expectTypeOf(config2.wasm).toEqualTypeOf<boolean | undefined>();
    });

    it("WorkerEngineConfig with workerURL: worker is true", () => {
      // When worker is true with workerURL, it's WorkerEngineConfigWithURL
      const config: WorkerEngineConfigWithURL = {
        worker: true,
        workerURL: new URL("./worker.js", import.meta.url),
        workerStrategy: "stream-transfer",
        strict: true,
        onFallback: (info) => {
          console.log(info.reason);
        },
      };

      // config extends EngineConfig
      expectTypeOf(config).toExtend<EngineConfig>();
      expectTypeOf(config.worker).toEqualTypeOf<true>();

      // Worker-specific properties are available
      expectTypeOf(config.workerURL).toEqualTypeOf<string | URL>();
      expectTypeOf(config.strict).toEqualTypeOf<boolean | undefined>();

      // workerPool should be never (mutually exclusive)
      expectTypeOf(config.workerPool).toEqualTypeOf<undefined>();
    });

    it("WorkerEngineConfig with workerPool: worker is true", () => {
      // When worker is true with workerPool, it's WorkerEngineConfigWithPool
      const pool: WorkerPool = {
        getWorker: async () => ({}) as Worker,
        getNextRequestId: () => 0,
        releaseWorker: () => {},
        size: 0,
        isFull: () => false,
        terminate: () => {},
        [Symbol.dispose]: () => {},
      };

      const config: WorkerEngineConfigWithPool = {
        worker: true,
        workerPool: pool,
        workerStrategy: "message-streaming",
      };

      // config extends EngineConfig
      expectTypeOf(config).toExtend<EngineConfig>();
      expectTypeOf(config.worker).toEqualTypeOf<true>();

      // workerPool is required, workerURL should be never
      expectTypeOf(config.workerPool).toEqualTypeOf<WorkerPool>();
      expectTypeOf(config.workerURL).toEqualTypeOf<undefined>();
    });

    it("WorkerEngineConfig default: worker is true without URL or pool", () => {
      // When worker is true without workerURL or workerPool, it's WorkerEngineConfigDefault
      const config: WorkerEngineConfigDefault = {
        worker: true,
        workerStrategy: "stream-transfer",
        strict: true,
      };

      // config extends EngineConfig
      expectTypeOf(config).toExtend<EngineConfig>();
      expectTypeOf(config.worker).toEqualTypeOf<true>();
      expectTypeOf(config.strict).toEqualTypeOf<boolean | undefined>();
    });

    it("WorkerEngineConfig with common properties", () => {
      // Common properties are available even when worker is true
      const config: EngineConfig = {
        worker: true,
        wasm: true,
        arrayBufferThreshold: 1 * 1024 * 1024,
        backpressureCheckInterval: {
          lexer: 50,
          assembler: 5,
        },
        queuingStrategy: {
          lexerReadable: { highWaterMark: 100 },
          assemblerReadable: { highWaterMark: 50 },
        },
      };

      // config extends WorkerEngineConfig
      expectTypeOf(config).toExtend<WorkerEngineConfig>();
      expectTypeOf(config.wasm).toEqualTypeOf<boolean | undefined>();
      expectTypeOf(config.arrayBufferThreshold).toEqualTypeOf<
        number | undefined
      >();
    });

    it("Type narrowing based on worker property", () => {
      // When worker is true, type is narrowed to WorkerEngineConfig
      const workerConfig: EngineConfig = {
        worker: true,
        workerStrategy: "stream-transfer",
      };
      expectTypeOf(workerConfig).toExtend<WorkerEngineConfig>();

      // When worker is false, type is narrowed to MainThreadEngineConfig
      const mainConfig: EngineConfig = {
        worker: false,
        wasm: true,
      };
      expectTypeOf(mainConfig).toExtend<MainThreadEngineConfig>();

      // When worker is undefined, type is narrowed to MainThreadEngineConfig
      const defaultConfig: EngineConfig = {
        wasm: true,
      };
      expectTypeOf(defaultConfig).toExtend<MainThreadEngineConfig>();
    });

    it("Invalid configurations are type-checked correctly", () => {
      // When worker is false, type-checked as MainThreadEngineConfig
      const _mainConfig: MainThreadEngineConfig = {
        worker: false,
        wasm: true,
      };

      // Verify that workerURL, workerStrategy, etc. do not exist in MainThreadEngineConfig
      expectTypeOf<MainThreadEngineConfig>().not.toHaveProperty("workerURL");
      expectTypeOf<MainThreadEngineConfig>().not.toHaveProperty(
        "workerStrategy",
      );
      expectTypeOf<MainThreadEngineConfig>().not.toHaveProperty("workerPool");
      expectTypeOf<MainThreadEngineConfig>().not.toHaveProperty("strict");
      expectTypeOf<MainThreadEngineConfig>().not.toHaveProperty("onFallback");

      // When worker is true, type-checked as WorkerEngineConfig
      const _workerConfig: WorkerEngineConfig = {
        worker: true,
      };

      // Verify that worker-related properties exist in WorkerEngineConfig
      expectTypeOf<WorkerEngineConfig>().toHaveProperty("worker");
      expectTypeOf<WorkerEngineConfig>().toHaveProperty("workerURL");
      expectTypeOf<WorkerEngineConfig>().toHaveProperty("workerStrategy");
      expectTypeOf<WorkerEngineConfig>().toHaveProperty("workerPool");
      expectTypeOf<WorkerEngineConfig>().toHaveProperty("strict");
      expectTypeOf<WorkerEngineConfig>().toHaveProperty("onFallback");
    });

    it("All valid configurations", () => {
      // Empty config is valid
      const config1: EngineConfig = {};
      expectTypeOf(config1).toExtend<MainThreadEngineConfig>();

      // Only worker: false
      const config2: EngineConfig = { worker: false };
      expectTypeOf(config2).toExtend<MainThreadEngineConfig>();

      // Only worker: true
      const config3: EngineConfig = { worker: true };
      expectTypeOf(config3).toExtend<WorkerEngineConfig>();

      // Only common properties
      const config4: EngineConfig = {
        wasm: true,
        arrayBufferThreshold: 1024,
        backpressureCheckInterval: { lexer: 100 },
      };
      expectTypeOf(config4).toExtend<MainThreadEngineConfig>();

      // Full set (main thread)
      const config5: EngineConfig = {
        worker: false,
        wasm: true,
        arrayBufferThreshold: 2 * 1024 * 1024,
        backpressureCheckInterval: {
          lexer: 100,
          assembler: 10,
        },
        queuingStrategy: {
          lexerWritable: { highWaterMark: 1024 },
          lexerReadable: { highWaterMark: 256 },
          assemblerWritable: { highWaterMark: 256 },
          assemblerReadable: { highWaterMark: 128 },
        },
      };
      expectTypeOf(config5).toExtend<MainThreadEngineConfig>();

      // Full set (worker)
      const config6: EngineConfig = {
        worker: true,
        workerURL: "./worker.js",
        workerStrategy: "message-streaming",
        strict: false,
        onFallback: () => {},
        wasm: true,
        arrayBufferThreshold: 1 * 1024 * 1024,
        backpressureCheckInterval: {
          lexer: 50,
          assembler: 5,
        },
        queuingStrategy: {
          lexerReadable: { highWaterMark: 100 },
          assemblerReadable: { highWaterMark: 50 },
        },
      };
      expectTypeOf(config6).toExtend<WorkerEngineConfig>();
    });
  });

  describe("Type compatibility", () => {
    it("MainThreadEngineConfig is assignable to EngineConfig", () => {
      const mainThreadConfig: MainThreadEngineConfig = {
        worker: false,
        wasm: true,
      };

      // MainThreadEngineConfig extends EngineConfig
      expectTypeOf(mainThreadConfig).toExtend<EngineConfig>();
    });

    it("WorkerEngineConfig is assignable to EngineConfig", () => {
      const workerConfig: WorkerEngineConfig = {
        worker: true,
        workerStrategy: "stream-transfer",
      };

      // WorkerEngineConfig extends EngineConfig
      expectTypeOf(workerConfig).toExtend<EngineConfig>();
    });

    it("EngineConfig can be narrowed to specific types", () => {
      // Test with worker: true - extends WorkerEngineConfig
      const workerConfig: EngineConfig = { worker: true };
      expectTypeOf(workerConfig).toExtend<WorkerEngineConfig>();

      // Test with worker: false - extends MainThreadEngineConfig
      const mainConfig: EngineConfig = { worker: false };
      expectTypeOf(mainConfig).toExtend<MainThreadEngineConfig>();

      // Test with worker: undefined - extends MainThreadEngineConfig
      const defaultConfig: EngineConfig = {};
      expectTypeOf(defaultConfig).toExtend<MainThreadEngineConfig>();
    });
  });
});

describe("CSVRecordAssemblerOptions", () => {
  describe("Type-level constraints for headerless mode", () => {
    it("Headerless mode (header: []) requires outputFormat: 'array'", () => {
      const opts1: CSVRecordAssemblerOptions<readonly []> = {
        header: [],
        outputFormat: "array",
      };

      expectTypeOf(opts1.header).toEqualTypeOf<readonly []>();
      expectTypeOf(opts1.outputFormat).toEqualTypeOf<"array">();
      expectTypeOf(opts1.columnCountStrategy).toEqualTypeOf<
        "keep" | undefined
      >();
    });

    it("Headerless mode only allows columnCountStrategy: 'keep'", () => {
      const opts: CSVRecordAssemblerOptions<readonly []> = {
        header: [],
        outputFormat: "array",
        columnCountStrategy: "keep",
      };

      expectTypeOf(opts.columnCountStrategy).toEqualTypeOf<
        "keep" | undefined
      >();
    });

    it("Normal mode allows all columnCountStrategy options", () => {
      const opts1: CSVRecordAssemblerOptions<readonly ["a", "b"]> = {
        header: ["a", "b"] as const,
        outputFormat: "array",
        columnCountStrategy: "keep",
      };

      const opts2: CSVRecordAssemblerOptions<readonly ["a", "b"]> = {
        header: ["a", "b"] as const,
        outputFormat: "array",
        columnCountStrategy: "pad",
      };

      const opts3: CSVRecordAssemblerOptions<readonly ["a", "b"]> = {
        header: ["a", "b"] as const,
        outputFormat: "object",
        columnCountStrategy: "strict",
      };

      expectTypeOf(opts1.columnCountStrategy).toEqualTypeOf<
        "keep" | "pad" | "strict" | "truncate" | undefined
      >();
      expectTypeOf(opts2.columnCountStrategy).toEqualTypeOf<
        "keep" | "pad" | "strict" | "truncate" | undefined
      >();
      expectTypeOf(opts3.columnCountStrategy).toEqualTypeOf<
        "keep" | "pad" | "strict" | "truncate" | undefined
      >();
    });

    it("Normal mode allows both array and object output formats", () => {
      const opts1: CSVRecordAssemblerOptions<readonly ["a", "b"]> = {
        header: ["a", "b"] as const,
        outputFormat: "array",
      };

      const opts2: CSVRecordAssemblerOptions<readonly ["a", "b"]> = {
        header: ["a", "b"] as const,
        outputFormat: "object",
      };

      expectTypeOf(opts1.outputFormat).toEqualTypeOf<
        "object" | "array" | undefined
      >();
      expectTypeOf(opts2.outputFormat).toEqualTypeOf<
        "object" | "array" | undefined
      >();
    });
  });
});
