import { describe, expect, it } from "vitest";
import {
  BACKEND_PRIORITY,
  CONTEXT_PRIORITY,
  DEFAULT_OPTIMIZATION_HINT,
  GPU_CONFIG,
  type OptimizationHint,
} from "@/execution/OptimizationHint.ts";

describe("OptimizationHint constants", () => {
  describe("DEFAULT_OPTIMIZATION_HINT", () => {
    it("should be balanced", () => {
      expect(DEFAULT_OPTIMIZATION_HINT).toBe("balanced");
    });
  });

  describe("BACKEND_PRIORITY", () => {
    it("should have all four optimization hints", () => {
      const hints: OptimizationHint[] = [
        "speed",
        "memory",
        "balanced",
        "responsive",
      ];
      for (const hint of hints) {
        expect(BACKEND_PRIORITY[hint]).toBeDefined();
        expect(Array.isArray(BACKEND_PRIORITY[hint])).toBe(true);
      }
    });

    it("should prioritize GPU first for speed hint", () => {
      expect(BACKEND_PRIORITY.speed[0]).toBe("gpu");
    });

    it("should prioritize JS first for memory hint (O(1) streaming)", () => {
      expect(BACKEND_PRIORITY.memory[0]).toBe("js");
    });

    it("should prioritize WASM first for balanced hint (consistent & widely available)", () => {
      expect(BACKEND_PRIORITY.balanced[0]).toBe("wasm");
    });

    it("should prioritize JS first for responsive hint (fastest initialization)", () => {
      expect(BACKEND_PRIORITY.responsive[0]).toBe("js");
    });

    it("should include all three backends for each hint", () => {
      for (const hint of Object.keys(BACKEND_PRIORITY) as OptimizationHint[]) {
        const backends = BACKEND_PRIORITY[hint];
        expect(backends).toContain("gpu");
        expect(backends).toContain("wasm");
        expect(backends).toContain("js");
        expect(backends).toHaveLength(3);
      }
    });
  });

  describe("CONTEXT_PRIORITY", () => {
    it("should have all four optimization hints", () => {
      const hints: OptimizationHint[] = [
        "speed",
        "memory",
        "balanced",
        "responsive",
      ];
      for (const hint of hints) {
        expect(CONTEXT_PRIORITY[hint]).toBeDefined();
        expect(Array.isArray(CONTEXT_PRIORITY[hint])).toBe(true);
      }
    });

    it("should prioritize main first for speed hint (no worker overhead)", () => {
      expect(CONTEXT_PRIORITY.speed[0]).toBe("main");
    });

    it("should prioritize main first for memory hint (no worker overhead)", () => {
      expect(CONTEXT_PRIORITY.memory[0]).toBe("main");
    });

    it("should prioritize worker-stream-transfer first for balanced hint", () => {
      expect(CONTEXT_PRIORITY.balanced[0]).toBe("worker-stream-transfer");
    });

    it("should prioritize worker-stream-transfer first for responsive hint (non-blocking)", () => {
      expect(CONTEXT_PRIORITY.responsive[0]).toBe("worker-stream-transfer");
    });

    it("should include all three contexts for each hint", () => {
      for (const hint of Object.keys(CONTEXT_PRIORITY) as OptimizationHint[]) {
        const contexts = CONTEXT_PRIORITY[hint];
        expect(contexts).toContain("main");
        expect(contexts).toContain("worker-stream-transfer");
        expect(contexts).toContain("worker-message");
        expect(contexts).toHaveLength(3);
      }
    });
  });

  describe("GPU_CONFIG", () => {
    it("should have all four optimization hints", () => {
      const hints: OptimizationHint[] = [
        "speed",
        "memory",
        "balanced",
        "responsive",
      ];
      for (const hint of hints) {
        expect(GPU_CONFIG[hint]).toBeDefined();
        expect(GPU_CONFIG[hint].workgroupSize).toBeDefined();
        expect(GPU_CONFIG[hint].devicePreference).toBeDefined();
      }
    });

    it("should use largest workgroup size for speed hint", () => {
      expect(GPU_CONFIG.speed.workgroupSize).toBe(256);
      expect(GPU_CONFIG.speed.devicePreference).toBe("high-performance");
    });

    it("should use smallest workgroup size for memory hint", () => {
      expect(GPU_CONFIG.memory.workgroupSize).toBe(64);
      expect(GPU_CONFIG.memory.devicePreference).toBe("low-power");
    });

    it("should use medium workgroup size for balanced hint", () => {
      expect(GPU_CONFIG.balanced.workgroupSize).toBe(128);
      expect(GPU_CONFIG.balanced.devicePreference).toBe("balanced");
    });

    it("should use medium workgroup size for responsive hint", () => {
      expect(GPU_CONFIG.responsive.workgroupSize).toBe(128);
      expect(GPU_CONFIG.responsive.devicePreference).toBe("balanced");
    });

    it("should have valid workgroup sizes (powers of 2)", () => {
      const validSizes = [32, 64, 128, 256, 512];
      for (const hint of Object.keys(GPU_CONFIG) as OptimizationHint[]) {
        expect(validSizes).toContain(GPU_CONFIG[hint].workgroupSize);
      }
    });

    it("should have valid device preferences", () => {
      const validPreferences = ["high-performance", "low-power", "balanced"];
      for (const hint of Object.keys(GPU_CONFIG) as OptimizationHint[]) {
        expect(validPreferences).toContain(GPU_CONFIG[hint].devicePreference);
      }
    });
  });
});
