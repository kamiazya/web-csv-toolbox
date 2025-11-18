import { beforeEach, describe, expect, it } from "vitest";
import {
  isInitialized,
  isWasmInitialized,
  markWasmInitialized,
  resetInit,
  resetWasmState,
} from "@/wasm/loaders/wasmState.ts";

describe("wasmState", () => {
  // Reset state before each test to ensure isolation
  beforeEach(() => {
    resetWasmState();
  });

  describe("initial state", () => {
    it("should start with initialized = false", () => {
      expect(isWasmInitialized()).toBe(false);
      expect(isInitialized()).toBe(false);
    });
  });

  describe("markWasmInitialized", () => {
    it("should set initialized to true", () => {
      markWasmInitialized();
      expect(isWasmInitialized()).toBe(true);
      expect(isInitialized()).toBe(true);
    });

    it("should be idempotent (can be called multiple times)", () => {
      markWasmInitialized();
      markWasmInitialized();
      markWasmInitialized();

      expect(isWasmInitialized()).toBe(true);
      expect(isInitialized()).toBe(true);
    });
  });

  describe("resetWasmState", () => {
    it("should reset initialized to false", () => {
      markWasmInitialized();
      expect(isWasmInitialized()).toBe(true);

      resetWasmState();
      expect(isWasmInitialized()).toBe(false);
      expect(isInitialized()).toBe(false);
    });

    it("should be idempotent (can be called multiple times)", () => {
      markWasmInitialized();
      resetWasmState();
      resetWasmState();
      resetWasmState();

      expect(isWasmInitialized()).toBe(false);
      expect(isInitialized()).toBe(false);
    });
  });

  describe("resetInit (public API)", () => {
    it("should reset initialized to false", () => {
      markWasmInitialized();
      expect(isInitialized()).toBe(true);

      resetInit();
      expect(isWasmInitialized()).toBe(false);
      expect(isInitialized()).toBe(false);
    });
  });

  describe("isWasmInitialized vs isInitialized", () => {
    it("should return the same value", () => {
      expect(isWasmInitialized()).toBe(isInitialized());

      markWasmInitialized();
      expect(isWasmInitialized()).toBe(isInitialized());

      resetWasmState();
      expect(isWasmInitialized()).toBe(isInitialized());
    });
  });

  describe("state transitions", () => {
    it("should support multiple initialize/reset cycles", () => {
      // Cycle 1
      expect(isWasmInitialized()).toBe(false);
      markWasmInitialized();
      expect(isWasmInitialized()).toBe(true);
      resetWasmState();
      expect(isWasmInitialized()).toBe(false);

      // Cycle 2
      markWasmInitialized();
      expect(isWasmInitialized()).toBe(true);
      resetInit();
      expect(isWasmInitialized()).toBe(false);

      // Cycle 3
      markWasmInitialized();
      expect(isWasmInitialized()).toBe(true);
    });
  });
});
