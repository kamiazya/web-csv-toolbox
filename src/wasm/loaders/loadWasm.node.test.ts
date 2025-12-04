import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock web-csv-toolbox-wasm's init function
vi.mock("web-csv-toolbox-wasm", () => ({
  default: vi.fn(),
}));

// Mock wasmState
vi.mock("./wasmState.js", () => ({
  isWasmInitialized: vi.fn(),
  markWasmInitialized: vi.fn(),
  isInitialized: vi.fn(),
  resetInit: vi.fn(),
}));

// Mock Node.js modules (they will be dynamically imported)
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

vi.mock("node:url", () => ({
  fileURLToPath: vi.fn(),
}));

import init from "web-csv-toolbox-wasm";
import { loadWasm } from "./loadWasm.node.js";
import * as wasmState from "./wasmState.js";

const mockInit = init as unknown as Mock;

// Get mocked functions after modules are imported
let mockReadFile: Mock;
let mockFileURLToPath: Mock;

describe("loadWasm.node", () => {
  beforeEach(async () => {
    // Get the mocked modules
    const fsPromises = await import("node:fs/promises");
    const nodeUrl = await import("node:url");

    mockReadFile = vi.mocked(fsPromises.readFile);
    mockFileURLToPath = vi.mocked(nodeUrl.fileURLToPath);

    vi.clearAllMocks();
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

  describe("custom input", () => {
    it("should use custom input when provided", async () => {
      const customInput = new URL("https://example.com/custom.wasm");
      mockInit.mockResolvedValue(undefined);

      await loadWasm(customInput);

      expect(mockInit).toHaveBeenCalledWith({ module_or_path: customInput });
      expect(wasmState.markWasmInitialized).toHaveBeenCalled();
    });

    it("should not use Node.js file loading with custom input", async () => {
      const customInput = new ArrayBuffer(100);
      mockInit.mockResolvedValue(undefined);

      await loadWasm(customInput as any);

      expect(mockInit).toHaveBeenCalledWith({ module_or_path: customInput });
      expect(mockReadFile).not.toHaveBeenCalled();
    });
  });

  describe("Node.js Wasm loading", () => {
    it("should load Wasm from file system", async () => {
      const mockWasmBuffer = Buffer.from([0, 1, 2, 3]);
      mockReadFile.mockResolvedValue(mockWasmBuffer as any);
      mockFileURLToPath.mockReturnValue("/path/to/wasm/file.wasm");
      mockInit.mockResolvedValue(undefined);

      await loadWasm();

      expect(mockFileURLToPath).toHaveBeenCalled();
      expect(mockReadFile).toHaveBeenCalled();
      expect(mockInit).toHaveBeenCalledWith({ module_or_path: mockWasmBuffer });
      expect(wasmState.markWasmInitialized).toHaveBeenCalled();
    });

    it("should handle file read errors", async () => {
      mockReadFile.mockRejectedValue(new Error("File not found"));

      await expect(loadWasm()).rejects.toThrow("File not found");
      expect(wasmState.markWasmInitialized).not.toHaveBeenCalled();
    });

    it("should handle init errors", async () => {
      const mockWasmBuffer = Buffer.from([0, 1, 2, 3]);
      mockReadFile.mockResolvedValue(mockWasmBuffer as any);
      mockFileURLToPath.mockReturnValue("/path/to/wasm/file.wasm");
      mockInit.mockRejectedValue(new Error("Invalid Wasm"));

      await expect(loadWasm()).rejects.toThrow("Invalid Wasm");
      expect(wasmState.markWasmInitialized).not.toHaveBeenCalled();
    });
  });

  describe("state management", () => {
    it("should mark as initialized after successful load", async () => {
      const mockWasmBuffer = Buffer.from([0, 1, 2, 3]);
      mockReadFile.mockResolvedValue(mockWasmBuffer as any);
      mockFileURLToPath.mockReturnValue("/path/to/wasm/file.wasm");
      mockInit.mockResolvedValue(undefined);

      await loadWasm();

      expect(wasmState.markWasmInitialized).toHaveBeenCalledTimes(1);
    });

    it("should mark as initialized with custom input", async () => {
      const customInput = new ArrayBuffer(100);
      mockInit.mockResolvedValue(undefined);

      await loadWasm(customInput as any);

      expect(wasmState.markWasmInitialized).toHaveBeenCalledTimes(1);
    });

    it("should not mark as initialized on error", async () => {
      mockReadFile.mockRejectedValue(new Error("Read error"));

      await expect(loadWasm()).rejects.toThrow();

      expect(wasmState.markWasmInitialized).not.toHaveBeenCalled();
    });
  });

  describe("re-exports", () => {
    it("should re-export isInitialized from wasmState", async () => {
      const { isInitialized } = await import("./loadWasm.node.js");
      expect(isInitialized).toBe(wasmState.isInitialized);
    });

    it("should re-export resetInit from wasmState", async () => {
      const { resetInit } = await import("./loadWasm.node.js");
      expect(resetInit).toBe(wasmState.resetInit);
    });
  });
});
