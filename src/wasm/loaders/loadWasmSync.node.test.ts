import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock web-csv-toolbox-wasm's initSync function
vi.mock("web-csv-toolbox-wasm", () => ({
  initSync: vi.fn(),
}));

// Mock #/csv.wasm
vi.mock("#/csv.wasm", () => ({
  default: new ArrayBuffer(100), // Mock inlined Wasm buffer
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
  loadWasmSync,
  resetSyncInit,
} from "./loadWasmSync.node.js";
import * as wasmState from "./wasmState.js";

// Access Buffer from globalThis for runtime usage
const { Buffer } = globalThis;

const mockInitSync = initSync as unknown as Mock;

describe("loadWasmSync.node", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (wasmState.isWasmInitialized as Mock).mockReturnValue(false);
    // Reset the module state between tests
    resetSyncInit();
  });

  describe("idempotency", () => {
    it("should not initialize if already initialized", () => {
      (wasmState.isWasmInitialized as Mock).mockReturnValue(true);

      loadWasmSync();

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

      loadWasmSync();
      loadWasmSync();
      loadWasmSync();

      // Should only initialize once
      expect(mockInitSync).toHaveBeenCalledTimes(1);
      expect(wasmState.markWasmInitialized).toHaveBeenCalledTimes(1);
    });
  });

  describe("default initialization (inlined Wasm)", () => {
    it("should use inlined Wasm buffer when no input provided", () => {
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWasmSync();

      // Should call initSync with the inlined Wasm buffer
      expect(mockInitSync).toHaveBeenCalledWith({ module: wasmBuffer });
      expect(wasmState.markWasmInitialized).toHaveBeenCalled();
    });

    it("should store the module instance", () => {
      const mockModule = { exports: { test: "value" } };
      mockInitSync.mockReturnValue(mockModule);

      loadWasmSync();

      expect(getWasmModule()).toBe(mockModule);
    });

    it("should handle initSync errors", () => {
      mockInitSync.mockImplementation(() => {
        throw new Error("Invalid Wasm module");
      });

      expect(() => loadWasmSync()).toThrow("Invalid Wasm module");
      expect(wasmState.markWasmInitialized).not.toHaveBeenCalled();
    });
  });

  describe("custom input", () => {
    it("should use custom ArrayBuffer input", () => {
      const customInput = new ArrayBuffer(200);
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWasmSync(customInput as any);

      expect(mockInitSync).toHaveBeenCalledWith({ module: customInput });
      expect(wasmState.markWasmInitialized).toHaveBeenCalled();
    });

    it("should use custom Uint8Array input", () => {
      const customInput = new Uint8Array([1, 2, 3, 4]);
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWasmSync(customInput as any);

      expect(mockInitSync).toHaveBeenCalledWith({ module: customInput });
      expect(wasmState.markWasmInitialized).toHaveBeenCalled();
    });

    it("should use custom WebAssembly.Module input", () => {
      // Use a dummy object as WebAssembly.Module - the test verifies argument passing,
      // not actual module validity (which would fail with minimal bytes)
      const customInput = {} as unknown as WebAssembly.Module;
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWasmSync(customInput as any);

      expect(mockInitSync).toHaveBeenCalledWith({ module: customInput });
      expect(wasmState.markWasmInitialized).toHaveBeenCalled();
    });

    it("should handle custom input errors", () => {
      const customInput = new ArrayBuffer(10);
      mockInitSync.mockImplementation(() => {
        throw new Error("Invalid custom Wasm");
      });

      expect(() => loadWasmSync(customInput as any)).toThrow(
        "Invalid custom Wasm",
      );
      expect(wasmState.markWasmInitialized).not.toHaveBeenCalled();
    });
  });

  describe("state management", () => {
    it("should mark as initialized after successful load", () => {
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWasmSync();

      expect(wasmState.markWasmInitialized).toHaveBeenCalledTimes(1);
    });

    it("should mark as initialized with custom input", () => {
      const customInput = new ArrayBuffer(100);
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWasmSync(customInput as any);

      expect(wasmState.markWasmInitialized).toHaveBeenCalledTimes(1);
    });

    it("should not mark as initialized on error", () => {
      mockInitSync.mockImplementation(() => {
        throw new Error("Load error");
      });

      expect(() => loadWasmSync()).toThrow();

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

      loadWasmSync();

      expect(getWasmModule()).toBe(mockModule);
    });

    it("should return the same module on multiple calls", () => {
      const mockModule = { exports: { test: "value" } };
      mockInitSync.mockReturnValue(mockModule);

      loadWasmSync();

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

      loadWasmSync();
      expect(getWasmModule()).toBe(mockModule);

      resetSyncInit();

      expect(wasmState.resetWasmState).toHaveBeenCalled();
      expect(getWasmModule()).toBeUndefined();
    });

    it("should allow re-initialization after reset", () => {
      (wasmState.isWasmInitialized as Mock)
        .mockReturnValueOnce(false) // First loadWasmSync
        .mockReturnValueOnce(false); // After reset

      const mockModule1 = { exports: { version: 1 } };
      const mockModule2 = { exports: { version: 2 } };

      mockInitSync.mockReturnValueOnce(mockModule1);
      loadWasmSync();
      expect(getWasmModule()).toBe(mockModule1);

      resetSyncInit();
      expect(getWasmModule()).toBeUndefined();

      mockInitSync.mockReturnValueOnce(mockModule2);
      loadWasmSync();
      expect(getWasmModule()).toBe(mockModule2);
    });
  });

  describe("re-exports", () => {
    it("should re-export isSyncInitialized from wasmState", async () => {
      expect(isSyncInitialized).toBe(wasmState.isInitialized);
    });
  });

  describe("Node.js-specific behavior", () => {
    it("should work with Buffer (Node.js-specific)", () => {
      // Node.js can work with Buffer which extends Uint8Array
      const bufferInput = Buffer.from([1, 2, 3, 4]);
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWasmSync(bufferInput as any);

      expect(mockInitSync).toHaveBeenCalledWith({ module: bufferInput });
      expect(wasmState.markWasmInitialized).toHaveBeenCalled();
    });

    it("should use base64-decoded Wasm from #/csv.wasm", () => {
      // The #/csv.wasm import provides the base64-decoded ArrayBuffer
      // In Node.js, this is decoded using Buffer.from(base64, 'base64')
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      loadWasmSync();

      // Verify it uses the imported wasmBuffer (which is the decoded result)
      expect(mockInitSync).toHaveBeenCalledWith({ module: wasmBuffer });
      expect(wasmBuffer).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe("synchronous initialization", () => {
    it("should complete synchronously without returning a promise", () => {
      const mockModule = { exports: {} };
      mockInitSync.mockReturnValue(mockModule);

      const result = loadWasmSync();

      // Should return void, not a Promise
      expect(result).toBeUndefined();
      expect(mockInitSync).toHaveBeenCalledTimes(1);
    });

    it("should allow immediate use of Wasm functions after call", () => {
      const mockModule = {
        exports: {
          parseCSV: vi.fn(),
        },
      };
      mockInitSync.mockReturnValue(mockModule);

      loadWasmSync();

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

      // Passing undefined should use default inlined Wasm
      loadWasmSync(undefined);

      expect(mockInitSync).toHaveBeenCalledWith({ module: wasmBuffer });
    });

    it("should propagate initialization errors with context", () => {
      mockInitSync.mockImplementation(() => {
        throw new Error("Wasm compilation failed: invalid magic number");
      });

      expect(() => loadWasmSync()).toThrow(
        "Wasm compilation failed: invalid magic number",
      );
    });

    it("should not leave partial state on error", () => {
      mockInitSync.mockImplementation(() => {
        throw new Error("Init failed");
      });

      try {
        loadWasmSync();
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

      loadWasmSync();
      const module1 = getWasmModule();

      loadWasmSync(); // Second call should be no-op
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
      loadWasmSync();
      expect(getWasmModule()).toBe(mockModule1);

      resetSyncInit();
      (wasmState.isWasmInitialized as Mock).mockReturnValue(false);

      mockInitSync.mockReturnValueOnce(mockModule2);
      loadWasmSync();
      expect(getWasmModule()).toBe(mockModule2);
      expect(getWasmModule()).not.toBe(mockModule1);
    });
  });
});
