import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the internal loaders before importing WasmInstance.slim
vi.mock("#/wasm/loaders/loadWASM.js", () => ({
  loadWASM: vi.fn(),
  isInitialized: vi.fn(),
  resetInit: vi.fn(),
}));

// Import mocked modules to access their mock functions
import * as loadWASMModule from "#/wasm/loaders/loadWASM.js";

// Import module under test
import {
  ensureWASMInitialized,
  isInitialized,
  isWASMReady,
  loadWASM,
  resetInit,
} from "@/wasm/WasmInstance.slim.ts";

describe("WasmInstance.slim", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all mock implementations to avoid test pollution
    (loadWASMModule.loadWASM as Mock).mockReset();
    (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
  });

  describe("re-exports", () => {
    it("should re-export isInitialized from loadWASM", () => {
      expect(isInitialized).toBe(loadWASMModule.isInitialized);
    });

    it("should re-export resetInit from loadWASM", () => {
      expect(resetInit).toBe(loadWASMModule.resetInit);
    });
  });

  describe("loadWASM - manual initialization requirement", () => {
    it("should require InitInput parameter (URL)", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = new URL("https://example.com/csv.wasm");

      await loadWASM(mockInput);

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(mockInput);
    });

    it("should require InitInput parameter (string)", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = "/path/to/csv.wasm";

      await loadWASM(mockInput as any);

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(mockInput);
    });

    it("should require InitInput parameter (ArrayBuffer)", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = new ArrayBuffer(100);

      await loadWASM(mockInput as any);

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(mockInput);
    });

    it("should not call internal loadWASM when already initialized (idempotent)", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(true);
      const mockInput = new URL("https://example.com/csv.wasm");

      await loadWASM(mockInput);

      expect(loadWASMModule.loadWASM).not.toHaveBeenCalled();
    });

    it("should support multiple calls with same input (idempotent)", async () => {
      (loadWASMModule.isInitialized as Mock)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      const mockInput = new URL("https://example.com/csv.wasm");

      await loadWASM(mockInput);
      await loadWASM(mockInput);
      await loadWASM(mockInput);

      // Should only call internal loadWASM once (first call)
      expect(loadWASMModule.loadWASM).toHaveBeenCalledTimes(1);
      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(mockInput);
    });

    it("should forward errors from internal loadWASM", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      (loadWASMModule.loadWASM as Mock).mockRejectedValue(
        new Error("Failed to fetch WASM"),
      );
      const mockInput = new URL("https://example.com/csv.wasm");

      await expect(loadWASM(mockInput)).rejects.toThrow("Failed to fetch WASM");
    });
  });

  describe("isWASMReady", () => {
    it("should return true when WASM is initialized", () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(true);

      expect(isWASMReady()).toBe(true);
    });

    it("should return false when WASM is not initialized", () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);

      expect(isWASMReady()).toBe(false);
    });

    it("should reflect initialization state changes", () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      expect(isWASMReady()).toBe(false);

      (loadWASMModule.isInitialized as Mock).mockReturnValue(true);
      expect(isWASMReady()).toBe(true);
    });
  });

  describe("ensureWASMInitialized - requires input", () => {
    it("should call loadWASM when not initialized", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = new URL("https://example.com/csv.wasm");

      await ensureWASMInitialized(mockInput);

      expect(loadWASMModule.loadWASM).toHaveBeenCalledTimes(1);
      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(mockInput);
    });

    it("should not call loadWASM when already initialized", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(true);
      const mockInput = new URL("https://example.com/csv.wasm");

      await ensureWASMInitialized(mockInput);

      expect(loadWASMModule.loadWASM).not.toHaveBeenCalled();
    });

    it("should support multiple calls (idempotent)", async () => {
      // Track state: first call is false, then true after loadWASM completes
      let initCount = 0;
      (loadWASMModule.isInitialized as Mock).mockImplementation(() => {
        return initCount > 0;
      });
      (loadWASMModule.loadWASM as Mock).mockImplementation(async () => {
        initCount++;
      });

      const mockInput = new URL("https://example.com/csv.wasm");

      await ensureWASMInitialized(mockInput);
      await ensureWASMInitialized(mockInput);
      await ensureWASMInitialized(mockInput);

      // Should only call loadWASM once (first call)
      expect(loadWASMModule.loadWASM).toHaveBeenCalledTimes(1);
      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(mockInput);
    });

    it("should require InitInput parameter", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = new ArrayBuffer(100);

      await ensureWASMInitialized(mockInput as any);

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(mockInput);
    });
  });

  describe("slim entry characteristics", () => {
    it("should verify loadWASM requires parameter", () => {
      // TypeScript enforces that slim entry loadWASM requires InitInput
      // This is tested at compile time, but we can verify the function signature
      expect(loadWASM).toBeDefined();
      expect(typeof loadWASM).toBe("function");
      expect(loadWASM.length).toBe(1); // Has 1 required parameter
    });

    it("should not have sync APIs (documented)", () => {
      // Slim entry is documented to not have loadWASMSync, getWasmModule, etc.
      // These are verified at TypeScript level - attempting to import them will fail
      // This test documents the behavior
      expect(typeof loadWASM).toBe("function");
      expect(typeof isWASMReady).toBe("function");
      expect(typeof ensureWASMInitialized).toBe("function");
      expect(typeof isInitialized).toBe("function");
      expect(typeof resetInit).toBe("function");
    });
  });

  describe("manual initialization workflow", () => {
    it("should require explicit loadWASM call with URL", async () => {
      // Track initialization state
      let initialized = false;
      (loadWASMModule.isInitialized as Mock).mockImplementation(
        () => initialized,
      );
      (loadWASMModule.loadWASM as Mock).mockImplementation(async () => {
        initialized = true;
      });

      const wasmUrl = new URL("https://cdn.example.com/csv.wasm");

      // Before loading: not ready
      expect(isWASMReady()).toBe(false);

      // User must explicitly call loadWASM with URL
      await loadWASM(wasmUrl);

      // After loading: ready
      expect(isWASMReady()).toBe(true);
      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(wasmUrl);
    });

    it("should support npm package workflow", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);

      // Simulating: import wasmUrl from 'web-csv-toolbox/csv.wasm?url';
      const wasmUrl = new URL("https://example.com/csv.wasm");

      await loadWASM(wasmUrl);

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(wasmUrl);
    });

    it("should support custom CDN workflow", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);

      const cdnUrl = new URL(
        "https://cdn.jsdelivr.net/npm/web-csv-toolbox@latest/csv.wasm",
      );

      await loadWASM(cdnUrl);

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(cdnUrl);
    });
  });

  describe("error handling", () => {
    it("should propagate initialization errors", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      (loadWASMModule.loadWASM as Mock).mockRejectedValue(
        new Error("Network error: Failed to fetch"),
      );

      const wasmUrl = new URL("https://example.com/csv.wasm");

      await expect(loadWASM(wasmUrl)).rejects.toThrow(
        "Network error: Failed to fetch",
      );
    });

    it("should propagate ensureWASMInitialized errors", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      (loadWASMModule.loadWASM as Mock).mockRejectedValue(
        new Error("Invalid WASM module"),
      );

      const wasmUrl = new URL("https://example.com/csv.wasm");

      await expect(ensureWASMInitialized(wasmUrl)).rejects.toThrow(
        "Invalid WASM module",
      );
    });
  });

  describe("state coordination", () => {
    it("should coordinate isWASMReady with isInitialized", () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      expect(isWASMReady()).toBe(isInitialized());

      (loadWASMModule.isInitialized as Mock).mockReturnValue(true);
      expect(isWASMReady()).toBe(isInitialized());
    });

    it("should maintain consistent state across multiple checks", () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(true);

      expect(isWASMReady()).toBe(true);
      expect(isInitialized()).toBe(true);
      expect(isWASMReady()).toBe(true);

      // All should return the same value
      expect(isWASMReady()).toBe(isInitialized());
    });
  });

  describe("comparison with main version", () => {
    it("should have different initialization requirements", () => {
      // Slim entry loadWASM signature requires InitInput
      // Main version loadWASM signature has optional InitInput
      // This is enforced by TypeScript types
      const slimLoadWASM: (input: any) => Promise<void> = loadWASM;

      expect(slimLoadWASM).toBeDefined();
      expect(slimLoadWASM.length).toBe(1); // Expects 1 required parameter
    });

    it("should not auto-initialize without explicit call", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);

      // In slim entry, WASM is NOT automatically initialized
      // User must call loadWASM explicitly
      expect(isWASMReady()).toBe(false);

      // No automatic initialization happened
      expect(loadWASMModule.loadWASM).not.toHaveBeenCalled();
    });

    it("should provide smaller bundle size (no inlined WASM)", () => {
      // This test documents the key benefit of slim entry:
      // It doesn't include base64-inlined WASM (smaller main bundle)

      // Slim entry doesn't import #/csv.wasm
      // Instead, users must provide WASM URL themselves

      // Should have manual initialization APIs
      expect(typeof loadWASM).toBe("function");
      expect(typeof ensureWASMInitialized).toBe("function");

      // LoadWASM requires a parameter (URL/buffer)
      expect(loadWASM.length).toBe(1);
      expect(ensureWASMInitialized.length).toBe(1);
    });
  });
});
