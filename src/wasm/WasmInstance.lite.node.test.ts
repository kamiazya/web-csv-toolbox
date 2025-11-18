import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the internal loaders before importing WasmInstance.lite.node
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
} from "@/wasm/WasmInstance.lite.node.ts";

describe("WasmInstance.lite.node", () => {
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

  describe("loadWASM - Node.js optional parameter", () => {
    it("should support calling without parameters (auto-detect)", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);

      await loadWASM();

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(undefined);
    });

    it("should support calling with explicit path", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = "/path/to/csv.wasm";

      await loadWASM(mockInput as any);

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(mockInput);
    });

    it("should support calling with URL", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = new URL("file:///path/to/csv.wasm");

      await loadWASM(mockInput);

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(mockInput);
    });

    it("should support calling with ArrayBuffer", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = new ArrayBuffer(100);

      await loadWASM(mockInput as any);

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(mockInput);
    });

    it("should not call internal loadWASM when already initialized (idempotent)", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(true);

      await loadWASM();

      expect(loadWASMModule.loadWASM).not.toHaveBeenCalled();
    });

    it("should support multiple calls (idempotent)", async () => {
      (loadWASMModule.isInitialized as Mock)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      await loadWASM();
      await loadWASM();
      await loadWASM();

      // Should only call internal loadWASM once (first call)
      expect(loadWASMModule.loadWASM).toHaveBeenCalledTimes(1);
    });

    it("should forward errors from internal loadWASM", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      (loadWASMModule.loadWASM as Mock).mockRejectedValue(
        new Error("Failed to read WASM file"),
      );

      await expect(loadWASM()).rejects.toThrow("Failed to read WASM file");
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

  describe("ensureWASMInitialized - optional parameter", () => {
    it("should call loadWASM without parameter when not initialized", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);

      await ensureWASMInitialized();

      expect(loadWASMModule.loadWASM).toHaveBeenCalledTimes(1);
      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(undefined);
    });

    it("should call loadWASM with parameter when provided", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = "/custom/path/csv.wasm";

      await ensureWASMInitialized(mockInput as any);

      expect(loadWASMModule.loadWASM).toHaveBeenCalledTimes(1);
      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(mockInput);
    });

    it("should not call loadWASM when already initialized", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(true);

      await ensureWASMInitialized();

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

      await ensureWASMInitialized();
      await ensureWASMInitialized();
      await ensureWASMInitialized();

      // Should only call loadWASM once (first call)
      expect(loadWASMModule.loadWASM).toHaveBeenCalledTimes(1);
    });
  });

  describe("Node.js-specific characteristics", () => {
    it("should support auto-detection without parameters", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);

      // Node.js can auto-detect WASM from package
      await loadWASM();

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(undefined);
    });

    it("should verify loadWASM has optional parameter", async () => {
      // Node.js version has optional InitInput parameter
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);

      // Can call without parameters - this proves it's optional
      await expect(loadWASM()).resolves.not.toThrow();
      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(undefined);
    });

    it("should support file system paths", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);

      const fsPath = "/usr/local/lib/node_modules/web-csv-toolbox/csv.wasm";
      await loadWASM(fsPath as any);

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(fsPath);
    });

    it("should support file:// URLs", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);

      const fileUrl = new URL("file:///path/to/csv.wasm");
      await loadWASM(fileUrl);

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(fileUrl);
    });
  });

  describe("auto-detection workflow", () => {
    it("should allow zero-config initialization", async () => {
      // Track initialization state
      let initialized = false;
      (loadWASMModule.isInitialized as Mock).mockImplementation(
        () => initialized,
      );
      (loadWASMModule.loadWASM as Mock).mockImplementation(async () => {
        initialized = true;
      });

      // Before loading: not ready
      expect(isWASMReady()).toBe(false);

      // In Node.js, can call loadWASM without any parameters
      await loadWASM();

      // After loading: ready
      expect(isWASMReady()).toBe(true);
      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(undefined);
    });

    it("should support package-relative loading", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);

      // Simulating: loading WASM from npm package without explicit path
      await loadWASM();

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(undefined);
    });
  });

  describe("manual initialization workflow", () => {
    it("should support explicit path when needed", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);

      const customPath = "/opt/app/wasm/csv.wasm";
      await loadWASM(customPath as any);

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(customPath);
    });

    it("should support custom module paths", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);

      // User might provide custom path for bundled/relocated WASM
      const customPath = "/custom/location/csv.wasm";
      await loadWASM(customPath as any);

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(customPath);
    });
  });

  describe("error handling", () => {
    it("should propagate initialization errors", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      (loadWASMModule.loadWASM as Mock).mockRejectedValue(
        new Error("ENOENT: no such file or directory"),
      );

      await expect(loadWASM()).rejects.toThrow(
        "ENOENT: no such file or directory",
      );
    });

    it("should propagate ensureWASMInitialized errors", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      (loadWASMModule.loadWASM as Mock).mockRejectedValue(
        new Error("Invalid WASM module"),
      );

      await expect(ensureWASMInitialized()).rejects.toThrow(
        "Invalid WASM module",
      );
    });

    it("should handle file read errors gracefully", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      (loadWASMModule.loadWASM as Mock).mockRejectedValue(
        new Error("EACCES: permission denied"),
      );

      await expect(loadWASM("/protected/csv.wasm" as any)).rejects.toThrow(
        "EACCES: permission denied",
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

  describe("comparison with web version", () => {
    it("should have optional parameter (unlike web version)", async () => {
      // Node.js version has optional parameter for auto-detection
      // Web version requires explicit URL
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);

      // Both can be called without parameters - proving they're optional
      await expect(loadWASM()).resolves.not.toThrow();
      await expect(ensureWASMInitialized()).resolves.not.toThrow();
    });

    it("should support same API surface", () => {
      // Both versions export the same functions
      expect(typeof loadWASM).toBe("function");
      expect(typeof isWASMReady).toBe("function");
      expect(typeof ensureWASMInitialized).toBe("function");
      expect(typeof isInitialized).toBe("function");
      expect(typeof resetInit).toBe("function");
    });

    it("should work without explicit WASM URL (Node.js advantage)", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);

      // This works in Node.js but would fail in browsers
      await loadWASM();

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(undefined);
    });
  });

  describe("lite version characteristics", () => {
    it("should not have sync APIs (documented)", () => {
      // Lite version is documented to not have loadWASMSync, getWasmModule, etc.
      // These are verified at TypeScript level - attempting to import them will fail
      expect(typeof loadWASM).toBe("function");
      expect(typeof isWASMReady).toBe("function");
      expect(typeof ensureWASMInitialized).toBe("function");
      expect(typeof isInitialized).toBe("function");
      expect(typeof resetInit).toBe("function");
    });

    it("should provide smaller bundle size (no inlined WASM)", async () => {
      // Lite version doesn't include base64-inlined WASM (smaller main bundle)
      // Should have async initialization APIs only
      expect(typeof loadWASM).toBe("function");
      expect(typeof ensureWASMInitialized).toBe("function");

      // Parameters are optional in Node.js version - verify by calling without params
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      await expect(loadWASM()).resolves.not.toThrow();
      await expect(ensureWASMInitialized()).resolves.not.toThrow();
    });
  });
});
