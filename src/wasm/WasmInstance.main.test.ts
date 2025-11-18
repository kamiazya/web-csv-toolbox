import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the internal loaders before importing WasmInstance.main
vi.mock("#/wasm/loaders/loadWASM.js", () => ({
  loadWASM: vi.fn(),
  isInitialized: vi.fn(),
  resetInit: vi.fn(),
}));

vi.mock("#/wasm/loaders/loadWASMSync.js", () => ({
  loadWASMSync: vi.fn(),
  isSyncInitialized: vi.fn(),
  resetSyncInit: vi.fn(),
  getWasmModule: vi.fn(),
}));

// Import mocked modules to access their mock functions
import * as loadWASMModule from "#/wasm/loaders/loadWASM.js";
import * as loadWASMSyncModule from "#/wasm/loaders/loadWASMSync.js";

// Import module under test
import {
  ensureWASMInitialized,
  getWasmModule,
  isInitialized,
  isSyncInitialized,
  isWASMReady,
  loadWASM,
  loadWASMSync,
  resetInit,
  resetSyncInit,
} from "@/wasm/WasmInstance.main.ts";

describe("WasmInstance.main", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("re-exports", () => {
    it("should re-export isInitialized from loadWASM", () => {
      expect(isInitialized).toBe(loadWASMModule.isInitialized);
    });

    it("should re-export resetInit from loadWASM", () => {
      expect(resetInit).toBe(loadWASMModule.resetInit);
    });

    it("should re-export isSyncInitialized from loadWASMSync", () => {
      expect(isSyncInitialized).toBe(loadWASMSyncModule.isSyncInitialized);
    });

    it("should re-export resetSyncInit from loadWASMSync", () => {
      expect(resetSyncInit).toBe(loadWASMSyncModule.resetSyncInit);
    });

    it("should re-export getWasmModule from loadWASMSync", () => {
      expect(getWasmModule).toBe(loadWASMSyncModule.getWasmModule);
    });
  });

  describe("loadWASM", () => {
    it("should call internal loadWASM when not initialized", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);

      await loadWASM();

      expect(loadWASMModule.loadWASM).toHaveBeenCalledTimes(1);
      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(undefined);
    });

    it("should not call internal loadWASM when already initialized (idempotent)", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(true);

      await loadWASM();

      expect(loadWASMModule.loadWASM).not.toHaveBeenCalled();
    });

    it("should forward input parameter to internal loadWASM", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      const mockInput = { url: "https://example.com/csv.wasm" };

      await loadWASM(mockInput);

      expect(loadWASMModule.loadWASM).toHaveBeenCalledWith(mockInput);
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
  });

  describe("loadWASMSync", () => {
    it("should call internal loadWASMSync when not initialized", () => {
      (loadWASMSyncModule.isSyncInitialized as Mock).mockReturnValue(false);

      loadWASMSync();

      expect(loadWASMSyncModule.loadWASMSync).toHaveBeenCalledTimes(1);
      expect(loadWASMSyncModule.loadWASMSync).toHaveBeenCalledWith(undefined);
    });

    it("should not call internal loadWASMSync when already initialized (idempotent)", () => {
      (loadWASMSyncModule.isSyncInitialized as Mock).mockReturnValue(true);

      loadWASMSync();

      expect(loadWASMSyncModule.loadWASMSync).not.toHaveBeenCalled();
    });

    it("should forward input parameter to internal loadWASMSync", () => {
      (loadWASMSyncModule.isSyncInitialized as Mock).mockReturnValue(false);
      // Use a simple object as mockInput since we're just testing parameter forwarding
      const mockInput = { custom: "input" } as any;

      loadWASMSync(mockInput);

      expect(loadWASMSyncModule.loadWASMSync).toHaveBeenCalledWith(mockInput);
    });

    it("should support multiple calls (idempotent)", () => {
      (loadWASMSyncModule.isSyncInitialized as Mock)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      loadWASMSync();
      loadWASMSync();
      loadWASMSync();

      // Should only call internal loadWASMSync once (first call)
      expect(loadWASMSyncModule.loadWASMSync).toHaveBeenCalledTimes(1);
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
  });

  describe("ensureWASMInitialized", () => {
    it("should call loadWASM when not initialized", async () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);

      await ensureWASMInitialized();

      expect(loadWASMModule.loadWASM).toHaveBeenCalledTimes(1);
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

  describe("integration behavior", () => {
    it("should coordinate async and sync initialization checks", () => {
      (loadWASMModule.isInitialized as Mock).mockReturnValue(false);
      (loadWASMSyncModule.isSyncInitialized as Mock).mockReturnValue(false);

      expect(isWASMReady()).toBe(false);
      expect(isInitialized()).toBe(false);

      (loadWASMModule.isInitialized as Mock).mockReturnValue(true);

      expect(isWASMReady()).toBe(true);
      expect(isInitialized()).toBe(true);
    });
  });
});
