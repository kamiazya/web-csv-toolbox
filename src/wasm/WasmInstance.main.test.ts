import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the internal loaders before importing WasmInstance.main
vi.mock("#/wasm/loaders/loadWasm.js", () => ({
  loadWasm: vi.fn(),
  isInitialized: vi.fn(),
  resetInit: vi.fn(),
}));

vi.mock("#/wasm/loaders/loadWasmSync.js", () => ({
  loadWasmSync: vi.fn(),
  isSyncInitialized: vi.fn(),
  resetSyncInit: vi.fn(),
  getWasmModule: vi.fn(),
}));

// Import mocked modules to access their mock functions
import * as loadWasmModule from "#/wasm/loaders/loadWasm.js";
import * as loadWasmSyncModule from "#/wasm/loaders/loadWasmSync.js";

// Import module under test
// Note: Using .node.ts variant since this test runs in Node.js environment
import {
  ensureWasmInitialized,
  getWasmModule,
  isInitialized,
  isSyncInitialized,
  isWasmReady,
  loadWasm,
  loadWasmSync,
  resetInit,
  resetSyncInit,
} from "@/wasm/WasmInstance.main.node.ts";

describe("WasmInstance.main", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("re-exports", () => {
    it("should re-export isInitialized from loadWasm", () => {
      expect(isInitialized).toBe(loadWasmModule.isInitialized);
    });

    it("should re-export resetInit from loadWasm", () => {
      expect(resetInit).toBe(loadWasmModule.resetInit);
    });

    it("should re-export isSyncInitialized from loadWasmSync", () => {
      expect(isSyncInitialized).toBe(loadWasmSyncModule.isSyncInitialized);
    });

    it("should re-export resetSyncInit from loadWasmSync", () => {
      expect(resetSyncInit).toBe(loadWasmSyncModule.resetSyncInit);
    });

    it("should re-export getWasmModule from loadWasmSync", () => {
      expect(getWasmModule).toBe(loadWasmSyncModule.getWasmModule);
    });
  });

  describe("loadWasm", () => {
    it("should call internal loadWasm when not initialized", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);

      await loadWasm();

      expect(loadWasmModule.loadWasm).toHaveBeenCalledTimes(1);
      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(undefined);
    });

    it("should not call internal loadWasm when already initialized (idempotent)", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(true);

      await loadWasm();

      expect(loadWasmModule.loadWasm).not.toHaveBeenCalled();
    });

    it("should forward input parameter to internal loadWasm", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = { url: "https://example.com/csv.wasm" };

      await loadWasm(mockInput);

      expect(loadWasmModule.loadWasm).toHaveBeenCalledWith(mockInput);
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
  });

  describe("loadWasmSync", () => {
    it("should call internal loadWasmSync when not initialized", () => {
      (loadWasmSyncModule.isSyncInitialized as Mock).mockReturnValue(false);

      loadWasmSync();

      expect(loadWasmSyncModule.loadWasmSync).toHaveBeenCalledTimes(1);
      expect(loadWasmSyncModule.loadWasmSync).toHaveBeenCalledWith(undefined);
    });

    it("should not call internal loadWasmSync when already initialized (idempotent)", () => {
      (loadWasmSyncModule.isSyncInitialized as Mock).mockReturnValue(true);

      loadWasmSync();

      expect(loadWasmSyncModule.loadWasmSync).not.toHaveBeenCalled();
    });

    it("should forward input parameter to internal loadWasmSync", () => {
      (loadWasmSyncModule.isSyncInitialized as Mock).mockReturnValue(false);
      // Use a simple object as mockInput since we're just testing parameter forwarding
      const mockInput = { custom: "input" } as any;

      loadWasmSync(mockInput);

      expect(loadWasmSyncModule.loadWasmSync).toHaveBeenCalledWith(mockInput);
    });

    it("should support multiple calls (idempotent)", () => {
      (loadWasmSyncModule.isSyncInitialized as Mock)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      loadWasmSync();
      loadWasmSync();
      loadWasmSync();

      // Should only call internal loadWasmSync once (first call)
      expect(loadWasmSyncModule.loadWasmSync).toHaveBeenCalledTimes(1);
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
  });

  describe("ensureWasmInitialized", () => {
    it("should call loadWasm when not initialized", async () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);

      await ensureWasmInitialized();

      expect(loadWasmModule.loadWasm).toHaveBeenCalledTimes(1);
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

  describe("integration behavior", () => {
    it("should coordinate async and sync initialization checks", () => {
      (loadWasmModule.isInitialized as Mock).mockReturnValue(false);
      (loadWasmSyncModule.isSyncInitialized as Mock).mockReturnValue(false);

      expect(isWasmReady()).toBe(false);
      expect(isInitialized()).toBe(false);

      (loadWasmModule.isInitialized as Mock).mockReturnValue(true);

      expect(isWasmReady()).toBe(true);
      expect(isInitialized()).toBe(true);
    });
  });
});
