import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock web-csv-toolbox-wasm's initSync function
vi.mock("web-csv-toolbox-wasm", () => ({
  initSync: vi.fn(),
}));

// Mock #/csv.wasm
vi.mock("#/csv.wasm", () => ({
  default: new ArrayBuffer(100), // Mock inlined WASM buffer
}));

// Mock wasmState
vi.mock("./wasmState.js", () => ({
  isWasmInitialized: vi.fn(),
  markWasmInitialized: vi.fn(),
  isInitialized: vi.fn(),
  resetWasmState: vi.fn(),
}));

import { initSync } from "web-csv-toolbox-wasm";
import wasmBuffer from "#/csv.wasm";
import {
  getWasmModule,
  isSyncInitialized,
  loadWASMSync,
  resetSyncInit,
} from "./loadWASMSync.web.js";
import * as wasmState from "./wasmState.js";

const mockInitSync = initSync as unknown as Mock;

describe("loadWASMSync.web", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (wasmState.isWasmInitialized as Mock).mockReturnValue(false);
    // Reset the module state between tests
    resetSyncInit();
  });

  describe("idempotency", () => {
    it("should not initialize if already initialized", () => {
      (wasmState.isWasmInitialized as Mock).mockReturnValue(true);

      loadWASMSync();

      expect(mockInitSync).not.toHaveBeenCalled();
      expect(wasmState.markWasmInitialized).not.toHaveBeenCalled();
    });

    it("should support multiple calls", () => {
      (wasmState.isWasmInitialized as Mock)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWASMSync();
      loadWASMSync();
      loadWASMSync();

      // Should only initialize once
      expect(mockInitSync).toHaveBeenCalledTimes(1);
      expect(wasmState.markWasmInitialized).toHaveBeenCalledTimes(1);
    });
  });

  describe("default initialization (inlined WASM)", () => {
    it("should use inlined WASM buffer when no input provided", () => {
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWASMSync();

      // Should call initSync with the inlined WASM buffer
      expect(mockInitSync).toHaveBeenCalledWith({ module: wasmBuffer });
      expect(wasmState.markWasmInitialized).toHaveBeenCalled();
    });

    it("should store the module instance", () => {
      const mockModule = { exports: { test: "value" } };
      mockInitSync.mockReturnValue(mockModule);

      loadWASMSync();

      expect(getWasmModule()).toBe(mockModule);
    });

    it("should handle initSync errors", () => {
      mockInitSync.mockImplementation(() => {
        throw new Error("Invalid WASM module");
      });

      expect(() => loadWASMSync()).toThrow("Invalid WASM module");
      expect(wasmState.markWasmInitialized).not.toHaveBeenCalled();
    });
  });

  describe("custom input", () => {
    it("should use custom ArrayBuffer input", () => {
      const customInput = new ArrayBuffer(200);
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWASMSync(customInput as any);

      expect(mockInitSync).toHaveBeenCalledWith({ module: customInput });
      expect(wasmState.markWasmInitialized).toHaveBeenCalled();
    });

    it("should use custom Uint8Array input", () => {
      const customInput = new Uint8Array([1, 2, 3, 4]);
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWASMSync(customInput as any);

      expect(mockInitSync).toHaveBeenCalledWith({ module: customInput });
      expect(wasmState.markWasmInitialized).toHaveBeenCalled();
    });

    it("should use custom WebAssembly.Module input", () => {
      // Use a dummy object as WebAssembly.Module - the test verifies argument passing,
      // not actual module validity (which would fail with minimal bytes)
      const customInput = {} as unknown as WebAssembly.Module;
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWASMSync(customInput as any);

      expect(mockInitSync).toHaveBeenCalledWith({ module: customInput });
      expect(wasmState.markWasmInitialized).toHaveBeenCalled();
    });

    it("should handle custom input errors", () => {
      const customInput = new ArrayBuffer(10);
      mockInitSync.mockImplementation(() => {
        throw new Error("Invalid custom WASM");
      });

      expect(() => loadWASMSync(customInput as any)).toThrow(
        "Invalid custom WASM",
      );
      expect(wasmState.markWasmInitialized).not.toHaveBeenCalled();
    });
  });

  describe("state management", () => {
    it("should mark as initialized after successful load", () => {
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWASMSync();

      expect(wasmState.markWasmInitialized).toHaveBeenCalledTimes(1);
    });

    it("should mark as initialized with custom input", () => {
      const customInput = new ArrayBuffer(100);
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWASMSync(customInput as any);

      expect(wasmState.markWasmInitialized).toHaveBeenCalledTimes(1);
    });

    it("should not mark as initialized on error", () => {
      mockInitSync.mockImplementation(() => {
        throw new Error("Load error");
      });

      expect(() => loadWASMSync()).toThrow();

      expect(wasmState.markWasmInitialized).not.toHaveBeenCalled();
    });
  });

  describe("getWasmModule", () => {
    it("should return undefined before initialization", () => {
      expect(getWasmModule()).toBeUndefined();
    });

    it("should return the module after initialization", () => {
      const mockModule = { exports: { foo: "bar" } };
      mockInitSync.mockReturnValue(mockModule);

      loadWASMSync();

      expect(getWasmModule()).toBe(mockModule);
    });

    it("should return the same module on multiple calls", () => {
      const mockModule = { exports: { test: "value" } };
      mockInitSync.mockReturnValue(mockModule);

      loadWASMSync();

      const module1 = getWasmModule();
      const module2 = getWasmModule();

      expect(module1).toBe(module2);
      expect(module1).toBe(mockModule);
    });
  });

  describe("resetSyncInit", () => {
    it("should reset state and clear module", () => {
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWASMSync();
      expect(getWasmModule()).toBe(mockModule);

      resetSyncInit();

      expect(wasmState.resetWasmState).toHaveBeenCalled();
      expect(getWasmModule()).toBeUndefined();
    });

    it("should allow re-initialization after reset", () => {
      (wasmState.isWasmInitialized as Mock)
        .mockReturnValueOnce(false) // First loadWASMSync
        .mockReturnValueOnce(false); // After reset

      const mockModule1 = { exports: { version: 1 } };
      const mockModule2 = { exports: { version: 2 } };

      mockInitSync.mockReturnValueOnce(mockModule1);
      loadWASMSync();
      expect(getWasmModule()).toBe(mockModule1);

      resetSyncInit();
      expect(getWasmModule()).toBeUndefined();

      mockInitSync.mockReturnValueOnce(mockModule2);
      loadWASMSync();
      expect(getWasmModule()).toBe(mockModule2);
    });
  });

  describe("re-exports", () => {
    it("should re-export isSyncInitialized from wasmState", async () => {
      expect(isSyncInitialized).toBe(wasmState.isInitialized);
    });
  });

  describe("browser-specific behavior", () => {
    it("should use base64-decoded WASM from #/csv.wasm", () => {
      // The #/csv.wasm import provides the base64-decoded ArrayBuffer
      // In browsers, this is decoded using Uint8Array.fromBase64 or atob
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWASMSync();

      // Verify it uses the imported wasmBuffer (which is the decoded result)
      expect(mockInitSync).toHaveBeenCalledWith({ module: wasmBuffer });
      expect(wasmBuffer).toBeInstanceOf(ArrayBuffer);
    });

    it("should work with standard browser types", () => {
      // Browser-specific: ArrayBuffer and Uint8Array
      const inputs = [new ArrayBuffer(100), new Uint8Array([1, 2, 3, 4])];

      for (const input of inputs) {
        vi.clearAllMocks();
        (wasmState.isWasmInitialized as Mock).mockReturnValue(false);
        resetSyncInit();

        const mockModule = { exports: {} };
        mockInitSync.mockReturnValue(mockModule);

        loadWASMSync(input as any);

        expect(mockInitSync).toHaveBeenCalledWith({ module: input });
        expect(wasmState.markWasmInitialized).toHaveBeenCalled();
      }
    });

    it("should not rely on Node.js Buffer", () => {
      // In browsers, there's no Buffer - this test documents that behavior
      // We're testing that loadWASMSync works without Buffer
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWASMSync();

      // Should succeed without any Buffer-related operations
      expect(mockInitSync).toHaveBeenCalled();
      expect(getWasmModule()).toBe(mockModule);
    });
  });

  describe("synchronous initialization", () => {
    it("should complete synchronously without returning a promise", () => {
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      const result = loadWASMSync();

      // Should return void, not a Promise
      expect(result).toBeUndefined();
      expect(mockInitSync).toHaveBeenCalledTimes(1);
    });

    it("should allow immediate use of WASM functions after call", () => {
      const mockModule = {
        exports: {
          parseCSV: vi.fn(),
        },
      };
      mockInitSync.mockReturnValue(mockModule);

      loadWASMSync();

      // Module should be immediately available
      const module = getWasmModule() as any;
      expect(module).toBeDefined();
      expect(module?.exports?.parseCSV).toBeDefined();
    });
  });

  describe("error scenarios", () => {
    it("should handle null/undefined input gracefully", () => {
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      // Passing undefined should use default inlined WASM
      loadWASMSync(undefined);

      expect(mockInitSync).toHaveBeenCalledWith({ module: wasmBuffer });
    });

    it("should propagate initialization errors with context", () => {
      mockInitSync.mockImplementation(() => {
        throw new Error("WASM compilation failed: invalid magic number");
      });

      expect(() => loadWASMSync()).toThrow(
        "WASM compilation failed: invalid magic number",
      );
    });

    it("should not leave partial state on error", () => {
      mockInitSync.mockImplementation(() => {
        throw new Error("Init failed");
      });

      try {
        loadWASMSync();
      } catch {
        // Error expected
      }

      // Should not have marked as initialized
      expect(wasmState.markWasmInitialized).not.toHaveBeenCalled();
      // Module should not be set
      expect(getWasmModule()).toBeUndefined();
    });
  });

  describe("module instance lifecycle", () => {
    it("should maintain single module instance across calls", () => {
      (wasmState.isWasmInitialized as Mock)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      const mockModule = { exports: { id: "test-123" } };
      mockInitSync.mockReturnValue(mockModule);

      loadWASMSync();
      const module1 = getWasmModule();

      loadWASMSync(); // Second call should be no-op
      const module2 = getWasmModule();

      expect(module1).toBe(module2);
      expect(mockInitSync).toHaveBeenCalledTimes(1);
    });

    it("should replace module instance after reset", () => {
      const mockModule1 = { exports: { version: "v1" } };
      const mockModule2 = { exports: { version: "v2" } };

      (wasmState.isWasmInitialized as Mock)
        .mockReturnValueOnce(false) // First init
        .mockReturnValueOnce(false); // After reset

      mockInitSync.mockReturnValueOnce(mockModule1);
      loadWASMSync();
      expect(getWasmModule()).toBe(mockModule1);

      resetSyncInit();
      (wasmState.isWasmInitialized as Mock).mockReturnValue(false);

      mockInitSync.mockReturnValueOnce(mockModule2);
      loadWASMSync();
      expect(getWasmModule()).toBe(mockModule2);
      expect(getWasmModule()).not.toBe(mockModule1);
    });
  });

  describe("comparison with Node.js version", () => {
    it("should have same API surface as Node.js version", () => {
      // Both versions export the same functions
      expect(typeof loadWASMSync).toBe("function");
      expect(typeof getWasmModule).toBe("function");
      expect(typeof resetSyncInit).toBe("function");
      expect(typeof isSyncInitialized).toBe("function");
    });

    it("should behave identically for common inputs", () => {
      const inputs = [new ArrayBuffer(100), new Uint8Array([1, 2, 3, 4])];

      for (const input of inputs) {
        vi.clearAllMocks();
        (wasmState.isWasmInitialized as Mock).mockReturnValue(false);
        resetSyncInit();

        const mockModule = { exports: { test: "value" } };
        mockInitSync.mockReturnValue(mockModule);

        loadWASMSync(input as any);

        expect(mockInitSync).toHaveBeenCalledWith({ module: input });
        expect(wasmState.markWasmInitialized).toHaveBeenCalled();
        expect(getWasmModule()).toBe(mockModule);
      }
    });
  });
});
