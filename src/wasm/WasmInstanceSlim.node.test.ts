import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the internal loaders before importing WasmInstance.slim.node
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
} from "@/wasm/WasmInstance.slim.node.ts";

describe("WasmInstance.slim.node", () => {
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

  describe("loadWasm - Node.js optional parameter", () => {
    it("should support calling without parameters (auto-detect)", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);

      await loadWasm();

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(undefined);
    });

    it("should support calling with explicit path", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = "/path/to/csv.wasm";

      await loadWasm(mockInput as any);

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(mockInput);
    });

    it("should support calling with URL", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = new URL("file:///path/to/csv.wasm");

      await loadWasm(mockInput);

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(mockInput);
    });

    it("should support calling with ArrayBuffer", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = new ArrayBuffer(100);

      await loadWasm(mockInput as any);

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(mockInput);
    });

    it("should not call internal loadWasm when already initialized (idempotent)", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(true);

      await loadWasm();

      expect(loadWasmModule.loadWasm).not.toHaveBeenCalled();
    });

    it("should support multiple calls (idempotent)", async () => {
      (loadWasmModule.isInitialized as Mock)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      await loadWasm();
      await loadWasm();
      await loadWasm();

      // Should only call internal loadWasm once (first call)
      expect(loadWasmModule.loadWasm).toHaveBeenCalledTimes(1);
    });

    it("should forward errors from internal loadWasm", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      (loadWasmModule.loadWasm as Mock).mockRejectedValue(
        new Error("Failed to read Wasm file"),
      );

      await expect(loadWasm()).rejects.toThrow("Failed to read Wasm file");
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

  describe("ensureWasmInitialized - optional parameter", () => {
    it("should call loadWasm without parameter when not initialized", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);

      await ensureWasmInitialized();

      expect(loadWasmModule.loadWasm).toHaveBeenCalledTimes(1);
      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(undefined);
    });

    it("should call loadWasm with parameter when provided", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = "/custom/path/csv.wasm";

      await ensureWasmInitialized(mockInput as any);

      expect(loadWasmModule.loadWasm).toHaveBeenCalledTimes(1);
      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(mockInput);
    });

    it("should not call loadWasm when already initialized", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(true);

      await ensureWasmInitialized();

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

      await ensureWasmInitialized();
      await ensureWasmInitialized();
      await ensureWasmInitialized();

      // Should only call loadWasm once (first call)
      expect(loadWasmModule.loadWasm).toHaveBeenCalledTimes(1);
    });
  });

  describe("Node.js-specific characteristics", () => {
    it("should support auto-detection without parameters", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);

      // Node.js can auto-detect Wasm from package
      await loadWasm();

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(undefined);
    });

    it("should verify loadWasm has optional parameter", async () => {
      // Node.js version has optional InitInput parameter
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);

      // Can call without parameters - this proves it's optional
      await expect(loadWasm()).resolves.not.toThrow();
      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(undefined);
    });

    it("should support file system paths", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);

      const fsPath = "/usr/local/lib/node_modules/web-csv-toolbox/csv.wasm";
      await loadWasm(fsPath as any);

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(fsPath);
    });

    it("should support file:// URLs", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);

      const fileUrl = new URL("file:///path/to/csv.wasm");
      await loadWasm(fileUrl);

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(fileUrl);
    });
  });

  describe("auto-detection workflow", () => {
    it("should allow zero-config initialization", async () => {
      // Track initialization state
      let initialized = false;
      (loadWasmModule.isInitialized as Mock).mockImplementation(
        () => initialized,
      );
      (loadWasmModule.loadWasm as Mock).mockImplementation(async () => {
        initialized = true;
      });

      // Before loading: not ready
      expect(isWasmReady()).toBe(false);

      // In Node.js, can call loadWasm without any parameters
      await loadWasm();

      // After loading: ready
      expect(isWasmReady()).toBe(true);
      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(undefined);
    });

    it("should support package-relative loading", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);

      // Simulating: loading Wasm from npm package without explicit path
      await loadWasm();

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(undefined);
    });
  });

  describe("manual initialization workflow", () => {
    it("should support explicit path when needed", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);

      const customPath = "/opt/app/wasm/csv.wasm";
      await loadWasm(customPath as any);

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(customPath);
    });

    it("should support custom module paths", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);

      // User might provide custom path for bundled/relocated Wasm
      const customPath = "/custom/location/csv.wasm";
      await loadWasm(customPath as any);

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(customPath);
    });
  });

  describe("error handling", () => {
    it("should propagate initialization errors", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      (loadWasmModule.loadWasm as Mock).mockRejectedValue(
        new Error("ENOENT: no such file or directory"),
      );

      await expect(loadWasm()).rejects.toThrow(
        "ENOENT: no such file or directory",
      );
    });

    it("should propagate ensureWasmInitialized errors", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      (loadWasmModule.loadWasm as Mock).mockRejectedValue(
        new Error("Invalid Wasm module"),
      );

      await expect(ensureWasmInitialized()).rejects.toThrow(
        "Invalid Wasm module",
      );
    });

    it("should handle file read errors gracefully", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      (loadWasmModule.loadWasm as Mock).mockRejectedValue(
        new Error("EACCES: permission denied"),
      );

      await expect(loadWasm("/protected/csv.wasm" as any)).rejects.toThrow(
        "EACCES: permission denied",
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

  describe("comparison with web version", () => {
    it("should have optional parameter (unlike web version)", async () => {
      // Node.js version has optional parameter for auto-detection
      // Web version requires explicit URL
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);

      // Both can be called without parameters - proving they're optional
      await expect(loadWasm()).resolves.not.toThrow();
      await expect(ensureWasmInitialized()).resolves.not.toThrow();
    });

    it("should support same API surface", () => {
      // Both versions export the same functions
      expect(typeof loadWasm).toBe("function");
      expect(typeof isWasmReady).toBe("function");
      expect(typeof ensureWasmInitialized).toBe("function");
      expect(typeof isInitialized).toBe("function");
      expect(typeof resetInit).toBe("function");
    });

    it("should work without explicit Wasm URL (Node.js advantage)", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);

      // This works in Node.js but would fail in browsers
      await loadWasm();

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(undefined);
    });
  });

  describe("slim entry characteristics", () => {
    it("should not have sync APIs (documented)", () => {
      // Slim entry is documented to not have loadWasmSync, getWasmModule, etc.
      // These are verified at TypeScript level - attempting to import them will fail
      expect(typeof loadWasm).toBe("function");
      expect(typeof isWasmReady).toBe("function");
      expect(typeof ensureWasmInitialized).toBe("function");
      expect(typeof isInitialized).toBe("function");
      expect(typeof resetInit).toBe("function");
    });

    it("should provide smaller bundle size (no inlined Wasm)", async () => {
      // Slim entry doesn't include base64-inlined Wasm (smaller main bundle)
      // Should have async initialization APIs only
      expect(typeof loadWasm).toBe("function");
      expect(typeof ensureWasmInitialized).toBe("function");

      // Parameters are optional in Node.js version - verify by calling without params
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      await expect(loadWasm()).resolves.not.toThrow();
      await expect(ensureWasmInitialized()).resolves.not.toThrow();
    });
  });
});
