import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock web-csv-toolbox-wasm's init function
vi.mock("web-csv-toolbox-wasm", () => ({
  default: vi.fn(),
}));

// Mock wasmState
vi.mock("./wasmState.js", () => ({
  hasWasmSimd: vi.fn(() => true), // Mock SIMD support as available by default
  isWasmInitialized: vi.fn(),
  markWasmInitialized: vi.fn(),
  isInitialized: vi.fn(),
  resetInit: vi.fn(),
}));

import init from "web-csv-toolbox-wasm";
import { loadWasm } from "./loadWasm.web.js";
import * as wasmState from "./wasmState.js";

const mockInit = init as unknown as Mock;

describe("loadWasm.web", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (wasmState.hasWasmSimd as Mock).mockReturnValue(true);
    (wasmState.isWasmInitialized as Mock).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("idempotency", () => {
    it("should not initialize if already initialized", async () => {
      (wasmState.isWasmInitialized as Mock).mockReturnValue(true);

      await loadWasm();

      expect(mockInit).not.toHaveBeenCalled();
      expect(wasmState.markWasmInitialized).not.toHaveBeenCalled();
    });

    it("should support multiple calls", async () => {
      (wasmState.isWasmInitialized as Mock)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      mockInit.mockResolvedValue(undefined);

      await loadWasm();
      await loadWasm();
      await loadWasm();

      // Should only initialize once
      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(wasmState.markWasmInitialized).toHaveBeenCalledTimes(1);
    });
  });

  describe("SIMD capability", () => {
    it("should skip initialization when SIMD is not supported", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      (wasmState.hasWasmSimd as Mock).mockReturnValue(false);

      await expect(loadWasm()).resolves.not.toThrow();

      expect(mockInit).not.toHaveBeenCalled();
      expect(wasmState.markWasmInitialized).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe("default initialization (fetch-based)", () => {
    it("should call init without arguments for default behavior", async () => {
      mockInit.mockResolvedValue(undefined);

      await loadWasm();

      // Should call init() without any arguments for fetch-based loading
      expect(mockInit).toHaveBeenCalledWith();
      expect(wasmState.markWasmInitialized).toHaveBeenCalled();
    });

    it("should handle init errors", async () => {
      mockInit.mockRejectedValue(new Error("Failed to fetch Wasm"));

      await expect(loadWasm()).rejects.toThrow("Failed to fetch Wasm");
      expect(wasmState.markWasmInitialized).not.toHaveBeenCalled();
    });
  });

  describe("custom input", () => {
    it("should use custom input when provided (URL)", async () => {
      const customInput = new URL("https://example.com/custom.wasm");
      mockInit.mockResolvedValue(undefined);

      await loadWasm(customInput);

      expect(mockInit).toHaveBeenCalledWith({ module_or_path: customInput });
      expect(wasmState.markWasmInitialized).toHaveBeenCalled();
    });

    it("should use custom input when provided (ArrayBuffer)", async () => {
      const customInput = new ArrayBuffer(100);
      mockInit.mockResolvedValue(undefined);

      await loadWasm(customInput as any);

      expect(mockInit).toHaveBeenCalledWith({ module_or_path: customInput });
      expect(wasmState.markWasmInitialized).toHaveBeenCalled();
    });

    it("should use custom input when provided (Response)", async () => {
      const customInput = new Response(new ArrayBuffer(100));
      mockInit.mockResolvedValue(undefined);

      await loadWasm(customInput as any);

      expect(mockInit).toHaveBeenCalledWith({ module_or_path: customInput });
      expect(wasmState.markWasmInitialized).toHaveBeenCalled();
    });

    it("should handle custom input errors", async () => {
      const customInput = new URL("https://example.com/invalid.wasm");
      mockInit.mockRejectedValue(new Error("Invalid Wasm"));

      await expect(loadWasm(customInput)).rejects.toThrow("Invalid Wasm");
      expect(wasmState.markWasmInitialized).not.toHaveBeenCalled();
    });
  });

  describe("state management", () => {
    it("should mark as initialized after successful load", async () => {
      mockInit.mockResolvedValue(undefined);

      await loadWasm();

      expect(wasmState.markWasmInitialized).toHaveBeenCalledTimes(1);
    });

    it("should mark as initialized with custom input", async () => {
      const customInput = new URL("https://example.com/custom.wasm");
      mockInit.mockResolvedValue(undefined);

      await loadWasm(customInput);

      expect(wasmState.markWasmInitialized).toHaveBeenCalledTimes(1);
    });

    it("should not mark as initialized on error", async () => {
      mockInit.mockRejectedValue(new Error("Load error"));

      await expect(loadWasm()).rejects.toThrow();

      expect(wasmState.markWasmInitialized).not.toHaveBeenCalled();
    });
  });

  describe("re-exports", () => {
    it("should re-export isInitialized from wasmState", async () => {
      const { isInitialized } = await import("./loadWasm.web.js");
      expect(isInitialized).toBe(wasmState.isInitialized);
    });

    it("should re-export resetInit from wasmState", async () => {
      const { resetInit } = await import("./loadWasm.web.js");
      expect(resetInit).toBe(wasmState.resetInit);
    });
  });

  describe("comparison with Node.js version", () => {
    it("should use simpler initialization (no file system access)", async () => {
      mockInit.mockResolvedValue(undefined);

      await loadWasm();

      // Web version should call init() directly without filesystem operations
      expect(mockInit).toHaveBeenCalledWith();
      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    it("should support same custom input types", async () => {
      const inputs = [
        new URL("https://example.com/test.wasm"),
        new ArrayBuffer(100),
        new Response(new ArrayBuffer(100)),
      ];

      for (const input of inputs) {
        vi.clearAllMocks();
        (wasmState.isWasmInitialized as Mock).mockReturnValue(false);
        mockInit.mockResolvedValue(undefined);

        await loadWasm(input as any);

        expect(mockInit).toHaveBeenCalledWith({ module_or_path: input });
        expect(wasmState.markWasmInitialized).toHaveBeenCalled();
      }
    });
  });
});
