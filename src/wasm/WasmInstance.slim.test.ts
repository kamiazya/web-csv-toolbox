import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the internal loaders before importing WasmInstance.slim
vi.mock("#/wasm/loaders/loadWasm.js", () => ({
  loadWasm: vi.fn(),
  isInitialized: vi.fn(),
  resetInit: vi.fn(),
}));

// Import mocked modules to access their mock functions
import * as loadWasmModule from "#/wasm/loaders/loadWasm.js";

// Import module under test
import {
  ensureWasmInitialized,
  isInitialized,
  isWasmReady,
  loadWasm,
  resetInit,
} from "@/wasm/WasmInstance.slim.ts";

describe("WasmInstance.slim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock implementations to avoid test pollution
    (loadWasmModule.loadWasm as Mock).mockReset();
    (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
  });

  describe("re-exports", () => {
    it("should re-export isInitialized from loadWasm", () => {
      expect(isInitialized).toBe(loadWasmModule.isInitialized);
    });

    it("should re-export resetInit from loadWasm", () => {
      expect(resetInit).toBe(loadWasmModule.resetInit);
    });
  });

  describe("loadWasm - manual initialization requirement", () => {
    it("should require InitInput parameter (URL)", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = new URL("https://example.com/csv.wasm");

      await loadWasm(mockInput);

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(mockInput);
    });

    it("should require InitInput parameter (string)", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = "/path/to/csv.wasm";

      await loadWasm(mockInput as any);

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(mockInput);
    });

    it("should require InitInput parameter (ArrayBuffer)", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = new ArrayBuffer(100);

      await loadWasm(mockInput as any);

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(mockInput);
    });

    it("should not call internal loadWasm when already initialized (idempotent)", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(true);
      const mockInput = new URL("https://example.com/csv.wasm");

      await loadWasm(mockInput);

      expect(loadWasmModule.loadWasm).not.toHaveBeenCalled();
    });

    it("should support multiple calls with same input (idempotent)", async () => {
      (loadWasmModule.isInitialized as Mock)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      const mockInput = new URL("https://example.com/csv.wasm");

      await loadWasm(mockInput);
      await loadWasm(mockInput);
      await loadWasm(mockInput);

      // Should only call internal loadWasm once (first call)
      expect(loadWasmModule.loadWasm).toHaveBeenCalledTimes(1);
      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(mockInput);
    });

    it("should forward errors from internal loadWasm", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      (loadWasmModule.loadWasm as Mock).mockRejectedValue(
        new Error("Failed to fetch Wasm"),
      );
      const mockInput = new URL("https://example.com/csv.wasm");

      await expect(loadWasm(mockInput)).rejects.toThrow("Failed to fetch Wasm");
    });
  });

  describe("isWasmReady", () => {
    it("should return true when Wasm is initialized", () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(true);

      expect(isWasmReady()).toBe(true);
    });

    it("should return false when Wasm is not initialized", () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);

      expect(isWasmReady()).toBe(false);
    });

    it("should reflect initialization state changes", () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      expect(isWasmReady()).toBe(false);

      (loadWasmModule.isInitialized as Mock).mockReturnValue(true);
      expect(isWasmReady()).toBe(true);
    });
  });

  describe("ensureWasmInitialized - requires input", () => {
    it("should call loadWasm when not initialized", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = new URL("https://example.com/csv.wasm");

      await ensureWasmInitialized(mockInput);

      expect(loadWasmModule.loadWasm).toHaveBeenCalledTimes(1);
      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(mockInput);
    });

    it("should not call loadWasm when already initialized", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(true);
      const mockInput = new URL("https://example.com/csv.wasm");

      await ensureWasmInitialized(mockInput);

      expect(loadWasmModule.loadWasm).not.toHaveBeenCalled();
    });

    it("should support multiple calls (idempotent)", async () => {
      // Track state: first call is false, then true after loadWasm completes
      let initCount = 0;
      (loadWasmModule.isInitialized as Mock).mockImplementation(() => {
        return initCount > 0;
      });
      (loadWasmModule.loadWasm as Mock).mockImplementation(async () => {
        initCount++;
      });

      const mockInput = new URL("https://example.com/csv.wasm");

      await ensureWasmInitialized(mockInput);
      await ensureWasmInitialized(mockInput);
      await ensureWasmInitialized(mockInput);

      // Should only call loadWasm once (first call)
      expect(loadWasmModule.loadWasm).toHaveBeenCalledTimes(1);
      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(mockInput);
    });

    it("should require InitInput parameter", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = new ArrayBuffer(100);

      await ensureWasmInitialized(mockInput as any);

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(mockInput);
    });
  });

  describe("slim entry characteristics", () => {
    it("should verify loadWasm requires parameter", () => {
      // TypeScript enforces that slim entry loadWasm requires InitInput
      // This is tested at compile time, but we can verify the function signature
      expect(loadWasm).toBeDefined();
      expect(typeof loadWasm).toBe("function");
      expect(loadWasm.length).toBe(1); // Has 1 required parameter
    });

    it("should not have sync APIs (documented)", () => {
      // Slim entry is documented to not have loadWasmSync, getWasmModule, etc.
      // These are verified at TypeScript level - attempting to import them will fail
      // This test documents the behavior
      expect(typeof loadWasm).toBe("function");
      expect(typeof isWasmReady).toBe("function");
      expect(typeof ensureWasmInitialized).toBe("function");
      expect(typeof isInitialized).toBe("function");
      expect(typeof resetInit).toBe("function");
    });
  });

  describe("manual initialization workflow", () => {
    it("should require explicit loadWasm call with URL", async () => {
      // Track initialization state
      let initialized = false;
      (loadWasmModule.isInitialized as Mock).mockImplementation(
        () => initialized,
      );
      (loadWasmModule.loadWasm as Mock).mockImplementation(async () => {
        initialized = true;
      });

      const wasmUrl = new URL("https://cdn.example.com/csv.wasm");

      // Before loading: not ready
      expect(isWasmReady()).toBe(false);

      // User must explicitly call loadWasm with URL
      await loadWasm(wasmUrl);

      // After loading: ready
      expect(isWasmReady()).toBe(true);
      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(wasmUrl);
    });

    it("should support npm package workflow", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);

      // Simulating: import wasmUrl from 'web-csv-toolbox/csv.wasm?url';
      const wasmUrl = new URL("https://example.com/csv.wasm");

      await loadWasm(wasmUrl);

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(wasmUrl);
    });

    it("should support custom CDN workflow", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);

      const cdnUrl = new URL(
        "https://cdn.jsdelivr.net/npm/web-csv-toolbox@latest/csv.wasm",
      );

      await loadWasm(cdnUrl);

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(cdnUrl);
    });
  });

  describe("error handling", () => {
    it("should propagate initialization errors", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      (loadWasmModule.loadWasm as Mock).mockRejectedValue(
        new Error("Network error: Failed to fetch"),
      );

      const wasmUrl = new URL("https://example.com/csv.wasm");

      await expect(loadWasm(wasmUrl)).rejects.toThrow(
        "Network error: Failed to fetch",
      );
    });

    it("should propagate ensureWasmInitialized errors", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      (loadWasmModule.loadWasm as Mock).mockRejectedValue(
        new Error("Invalid Wasm module"),
      );

      const wasmUrl = new URL("https://example.com/csv.wasm");

      await expect(ensureWasmInitialized(wasmUrl)).rejects.toThrow(
        "Invalid Wasm module",
      );
    });
  });

  describe("state coordination", () => {
    it("should coordinate isWasmReady with isInitialized", () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      expect(isWasmReady()).toBe(isInitialized());

      (loadWasmModule.isInitialized as Mock).mockReturnValue(true);
      expect(isWasmReady()).toBe(isInitialized());
    });

    it("should maintain consistent state across multiple checks", () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(true);

      expect(isWasmReady()).toBe(true);
      expect(isInitialized()).toBe(true);
      expect(isWasmReady()).toBe(true);

      // All should return the same value
      expect(isWasmReady()).toBe(isInitialized());
    });
  });

  describe("comparison with main version", () => {
    it("should have different initialization requirements", () => {
      // Slim entry loadWasm signature requires InitInput
      // Main version loadWasm signature has optional InitInput
      // This is enforced by TypeScript types
      const slimLoadWasm: (input: any) => Promise<void> = loadWasm;

      expect(slimLoadWasm).toBeDefined();
      expect(slimLoadWasm.length).toBe(1); // Expects 1 required parameter
    });

    it("should not auto-initialize without explicit call", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);

      // In slim entry, Wasm is NOT automatically initialized
      // User must call loadWasm explicitly
      expect(isWasmReady()).toBe(false);

      // No automatic initialization happened
      expect(loadWasmModule.loadWasm).not.toHaveBeenCalled();
    });

    it("should provide smaller bundle size (no inlined Wasm)", () => {
      // This test documents the key benefit of slim entry:
      // It doesn't include base64-inlined Wasm (smaller main bundle)

      // Slim entry doesn't import #/csv.wasm
      // Instead, users must provide Wasm URL themselves

      // Should have manual initialization APIs
      expect(typeof loadWasm).toBe("function");
      expect(typeof ensureWasmInitialized).toBe("function");

      // LoadWasm requires a parameter (URL/buffer)
      expect(loadWasm.length).toBe(1);
      expect(ensureWasmInitialized.length).toBe(1);
    });
  });
});
