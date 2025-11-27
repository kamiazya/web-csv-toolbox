import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EnvironmentCapabilities } from "@/execution/EnvironmentCapabilities.ts";
import {
  ExecutionPathResolver,
  type ResolverContext,
} from "@/execution/ExecutionPathResolver.ts";

// Mock engine config for testing
function createMockEngineConfig(options: {
  wasm?: boolean;
  gpu?: boolean;
  worker?: boolean;
  optimizationHint?: "speed" | "memory" | "balanced" | "responsive";
}) {
  return {
    hasWasm: () => options.wasm ?? false,
    hasGpu: () => options.gpu ?? false,
    hasWorker: () => options.worker ?? false,
    optimizationHint: options.optimizationHint,
  };
}

// Mock capabilities for testing
function createMockCapabilities(options: {
  gpu?: boolean;
  wasm?: boolean;
  transferableStreams?: boolean;
}) {
  return {
    gpu: options.gpu ?? false,
    wasm: options.wasm ?? true,
    transferableStreams: options.transferableStreams ?? true,
  } as EnvironmentCapabilities;
}

describe("ExecutionPathResolver", () => {
  let resolver: ExecutionPathResolver;

  beforeEach(() => {
    resolver = new ExecutionPathResolver();
    EnvironmentCapabilities.reset();
  });

  afterEach(() => {
    EnvironmentCapabilities.reset();
  });

  describe("Backend priority - speed hint", () => {
    it("should prioritize GPU > WASM > JS for speed hint", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          wasm: true,
          gpu: true,
          optimizationHint: "speed",
        }),
        capabilities: createMockCapabilities({ gpu: true }),
      };

      const plan = resolver.resolve(ctx);
      expect(plan.backends).toEqual(["gpu", "wasm", "js"]);
    });

    it("should include GPU config with speed hint", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          gpu: true,
          optimizationHint: "speed",
        }),
        capabilities: createMockCapabilities({ gpu: true }),
      };

      const plan = resolver.resolve(ctx);
      expect(plan.gpuConfig).toBeDefined();
      expect(plan.gpuConfig?.workgroupSize).toBe(256);
      expect(plan.gpuConfig?.devicePreference).toBe("high-performance");
    });
  });

  describe("Backend priority - memory hint", () => {
    it("should prioritize JS > WASM > GPU for memory hint", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          wasm: true,
          gpu: true,
          optimizationHint: "memory",
        }),
        capabilities: createMockCapabilities({ gpu: true }),
      };

      const plan = resolver.resolve(ctx);
      expect(plan.backends).toEqual(["js", "wasm", "gpu"]);
    });

    it("should include GPU config with memory hint (low-power)", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          gpu: true,
          optimizationHint: "memory",
        }),
        capabilities: createMockCapabilities({ gpu: true }),
      };

      const plan = resolver.resolve(ctx);
      expect(plan.gpuConfig?.workgroupSize).toBe(64);
      expect(plan.gpuConfig?.devicePreference).toBe("low-power");
    });
  });

  describe("Backend priority - balanced hint", () => {
    it("should prioritize WASM > GPU > JS for balanced hint", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          wasm: true,
          gpu: true,
          optimizationHint: "balanced",
        }),
        capabilities: createMockCapabilities({ gpu: true }),
      };

      const plan = resolver.resolve(ctx);
      expect(plan.backends).toEqual(["wasm", "gpu", "js"]);
    });
  });

  describe("Backend priority - responsive hint", () => {
    it("should prioritize JS > WASM > GPU for responsive hint", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          wasm: true,
          gpu: true,
          optimizationHint: "responsive",
        }),
        capabilities: createMockCapabilities({ gpu: true }),
      };

      const plan = resolver.resolve(ctx);
      expect(plan.backends).toEqual(["js", "wasm", "gpu"]);
    });
  });

  describe("Backend filtering", () => {
    it("should exclude GPU when environment does not support it", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          wasm: true,
          gpu: true,
          optimizationHint: "speed",
        }),
        capabilities: createMockCapabilities({ gpu: false }),
      };

      const plan = resolver.resolve(ctx);
      expect(plan.backends).not.toContain("gpu");
      expect(plan.backends).toEqual(["wasm", "js"]);
      expect(plan.gpuConfig).toBeUndefined();
    });

    it("should exclude WASM when engine config disables it", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          wasm: false,
          gpu: true,
          optimizationHint: "speed",
        }),
        capabilities: createMockCapabilities({ gpu: true }),
      };

      const plan = resolver.resolve(ctx);
      expect(plan.backends).not.toContain("wasm");
      expect(plan.backends).toEqual(["gpu", "js"]);
    });

    it("should exclude WASM for array output format", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "array",
        engineConfig: createMockEngineConfig({
          wasm: true,
          optimizationHint: "speed",
        }),
        capabilities: createMockCapabilities({ gpu: false }),
      };

      const plan = resolver.resolve(ctx);
      expect(plan.backends).not.toContain("wasm");
      expect(plan.backends).toEqual(["js"]);
    });

    it("should exclude WASM and GPU for non-UTF-8 charset", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        charset: "shift_jis",
        engineConfig: createMockEngineConfig({
          wasm: true,
          gpu: true,
          optimizationHint: "speed",
        }),
        capabilities: createMockCapabilities({ gpu: true }),
      };

      const plan = resolver.resolve(ctx);
      expect(plan.backends).not.toContain("wasm");
      expect(plan.backends).not.toContain("gpu");
      expect(plan.backends).toEqual(["js"]);
    });

    it("should allow WASM and GPU for UTF-8 charset", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        charset: "utf-8",
        engineConfig: createMockEngineConfig({
          wasm: true,
          gpu: true,
          optimizationHint: "speed",
        }),
        capabilities: createMockCapabilities({ gpu: true }),
      };

      const plan = resolver.resolve(ctx);
      expect(plan.backends).toContain("wasm");
      expect(plan.backends).toContain("gpu");
    });
  });

  describe("Context priority", () => {
    it("should prioritize main > worker-stream-transfer for speed hint (stream input)", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          worker: true,
          optimizationHint: "speed",
        }),
        capabilities: createMockCapabilities({ transferableStreams: true }),
      };

      const plan = resolver.resolve(ctx);
      // Stream input: only main and worker-stream-transfer (no worker-message)
      expect(plan.contexts).toEqual(["main", "worker-stream-transfer"]);
    });

    it("should prioritize main > worker-stream-transfer for memory hint (stream input)", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          worker: true,
          optimizationHint: "memory",
        }),
        capabilities: createMockCapabilities({ transferableStreams: true }),
      };

      const plan = resolver.resolve(ctx);
      // Memory hint: main first (no worker overhead), stream-transfer as fallback
      expect(plan.contexts).toEqual(["main", "worker-stream-transfer"]);
    });

    it("should prioritize worker-stream-transfer > main for balanced hint (stream input)", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          worker: true,
          optimizationHint: "balanced",
        }),
        capabilities: createMockCapabilities({ transferableStreams: true }),
      };

      const plan = resolver.resolve(ctx);
      // Stream input: only worker-stream-transfer and main (no worker-message)
      expect(plan.contexts).toEqual(["worker-stream-transfer", "main"]);
    });

    it("should prioritize worker-message > main for balanced hint (non-stream input)", () => {
      const ctx: ResolverContext = {
        inputType: "string",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          worker: true,
          optimizationHint: "balanced",
        }),
        capabilities: createMockCapabilities({ transferableStreams: true }),
      };

      const plan = resolver.resolve(ctx);
      // Non-stream input: only worker-message and main (no worker-stream-transfer)
      expect(plan.contexts).toEqual(["worker-message", "main"]);
    });
  });

  describe("Context filtering", () => {
    it("should exclude worker contexts when engine config disables worker", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          worker: false,
          optimizationHint: "balanced",
        }),
        capabilities: createMockCapabilities({ transferableStreams: true }),
      };

      const plan = resolver.resolve(ctx);
      expect(plan.contexts).toEqual(["main"]);
    });

    it("should exclude worker-stream-transfer for non-stream input", () => {
      const ctx: ResolverContext = {
        inputType: "binary",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          worker: true,
          optimizationHint: "balanced",
        }),
        capabilities: createMockCapabilities({ transferableStreams: true }),
      };

      const plan = resolver.resolve(ctx);
      expect(plan.contexts).not.toContain("worker-stream-transfer");
      expect(plan.contexts).toContain("worker-message");
      expect(plan.contexts).toContain("main");
    });

    it("should only have main context for stream input when TransferableStreams not supported", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          worker: true,
          optimizationHint: "balanced",
        }),
        capabilities: createMockCapabilities({ transferableStreams: false }),
      };

      const plan = resolver.resolve(ctx);
      // Stream input without TransferableStreams: only main is viable
      // (worker-message doesn't support ReadableStream)
      expect(plan.contexts).not.toContain("worker-stream-transfer");
      expect(plan.contexts).not.toContain("worker-message");
      expect(plan.contexts).toEqual(["main"]);
    });
  });

  describe("Default hint", () => {
    it("should use balanced hint when not specified", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          wasm: true,
          gpu: true,
          // No optimizationHint specified
        }),
        capabilities: createMockCapabilities({ gpu: true }),
      };

      const plan = resolver.resolve(ctx);
      // Balanced: WASM > GPU > JS
      expect(plan.backends).toEqual(["wasm", "gpu", "js"]);
    });
  });

  describe("Edge cases - Input types", () => {
    it("should handle string input type", () => {
      const ctx: ResolverContext = {
        inputType: "string",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          worker: true,
          optimizationHint: "balanced",
        }),
        capabilities: createMockCapabilities({ transferableStreams: true }),
      };

      const plan = resolver.resolve(ctx);
      // String input is not a stream, so no worker-stream-transfer
      expect(plan.contexts).not.toContain("worker-stream-transfer");
      expect(plan.contexts).toContain("worker-message");
      expect(plan.contexts).toContain("main");
    });

    it("should handle string-stream input type", () => {
      const ctx: ResolverContext = {
        inputType: "string-stream",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          worker: true,
          optimizationHint: "balanced",
        }),
        capabilities: createMockCapabilities({ transferableStreams: true }),
      };

      const plan = resolver.resolve(ctx);
      // String-stream is a stream, so worker-stream-transfer is available
      expect(plan.contexts).toContain("worker-stream-transfer");
    });

    it("should handle binary input type", () => {
      const ctx: ResolverContext = {
        inputType: "binary",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          worker: true,
          wasm: true,
          optimizationHint: "speed",
        }),
        capabilities: createMockCapabilities({ gpu: false }),
      };

      const plan = resolver.resolve(ctx);
      // Binary is not a stream
      expect(plan.contexts).not.toContain("worker-stream-transfer");
      expect(plan.backends).toContain("wasm");
      expect(plan.backends).toContain("js");
    });
  });

  describe("Edge cases - Charset variations", () => {
    it("should treat undefined charset as UTF-8", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        charset: undefined,
        engineConfig: createMockEngineConfig({
          wasm: true,
          gpu: true,
          optimizationHint: "speed",
        }),
        capabilities: createMockCapabilities({ gpu: true }),
      };

      const plan = resolver.resolve(ctx);
      expect(plan.backends).toContain("wasm");
      expect(plan.backends).toContain("gpu");
    });

    it("should handle UTF8 without hyphen", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        charset: "UTF8",
        engineConfig: createMockEngineConfig({
          wasm: true,
          optimizationHint: "speed",
        }),
        capabilities: createMockCapabilities({ gpu: false }),
      };

      const plan = resolver.resolve(ctx);
      expect(plan.backends).toContain("wasm");
    });

    it("should handle lowercase utf8", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        charset: "utf8",
        engineConfig: createMockEngineConfig({
          wasm: true,
          optimizationHint: "speed",
        }),
        capabilities: createMockCapabilities({ gpu: false }),
      };

      const plan = resolver.resolve(ctx);
      expect(plan.backends).toContain("wasm");
    });

    it("should reject non-UTF-8 charsets for WASM/GPU", () => {
      const nonUtf8Charsets = ["iso-8859-1", "windows-1252", "euc-jp", "gbk"];

      for (const charset of nonUtf8Charsets) {
        const ctx: ResolverContext = {
          inputType: "binary-stream",
          outputFormat: "object",
          charset,
          engineConfig: createMockEngineConfig({
            wasm: true,
            gpu: true,
            optimizationHint: "speed",
          }),
          capabilities: createMockCapabilities({ gpu: true }),
        };

        const plan = resolver.resolve(ctx);
        expect(plan.backends).not.toContain("wasm");
        expect(plan.backends).not.toContain("gpu");
        expect(plan.backends).toEqual(["js"]);
      }
    });
  });

  describe("Edge cases - All features disabled", () => {
    it("should return only JS backend when all are disabled", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          wasm: false,
          gpu: false,
          worker: false,
          optimizationHint: "speed",
        }),
        capabilities: createMockCapabilities({ gpu: false }),
      };

      const plan = resolver.resolve(ctx);
      expect(plan.backends).toEqual(["js"]);
      expect(plan.contexts).toEqual(["main"]);
      expect(plan.gpuConfig).toBeUndefined();
    });
  });

  describe("Edge cases - GPU config", () => {
    it("should not include GPU config when GPU is not in backends", () => {
      const ctx: ResolverContext = {
        inputType: "binary-stream",
        outputFormat: "object",
        engineConfig: createMockEngineConfig({
          gpu: true, // Requested but...
          optimizationHint: "speed",
        }),
        capabilities: createMockCapabilities({ gpu: false }), // ...not available
      };

      const plan = resolver.resolve(ctx);
      expect(plan.backends).not.toContain("gpu");
      expect(plan.gpuConfig).toBeUndefined();
    });

    it("should include GPU config for all hints when GPU is available", () => {
      const hints: ("speed" | "memory" | "balanced" | "responsive")[] = [
        "speed",
        "memory",
        "balanced",
        "responsive",
      ];

      for (const hint of hints) {
        EnvironmentCapabilities.reset();

        const ctx: ResolverContext = {
          inputType: "binary-stream",
          outputFormat: "object",
          engineConfig: createMockEngineConfig({
            gpu: true,
            optimizationHint: hint,
          }),
          capabilities: createMockCapabilities({ gpu: true }),
        };

        const plan = resolver.resolve(ctx);
        expect(plan.gpuConfig).toBeDefined();
        expect(plan.gpuConfig?.workgroupSize).toBeGreaterThan(0);
        expect(plan.gpuConfig?.devicePreference).toBeDefined();
      }
    });
  });
});
