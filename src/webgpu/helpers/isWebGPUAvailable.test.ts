import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isWebGPUAvailable } from "./isWebGPUAvailable.ts";

describe("isWebGPUAvailable", () => {
  // Store original navigator
  const originalNavigator = global.navigator;

  beforeEach(() => {
    // Reset navigator before each test
    vi.resetAllMocks();
  });

  afterEach(() => {
    // Restore original navigator
    global.navigator = originalNavigator;
  });

  it("should return true when navigator.gpu is available", () => {
    // Mock navigator with gpu
    Object.defineProperty(global, "navigator", {
      value: { gpu: {} },
      configurable: true,
      writable: true,
    });

    expect(isWebGPUAvailable()).toBe(true);
  });

  it("should return false when navigator.gpu is not available", () => {
    // Mock navigator without gpu
    Object.defineProperty(global, "navigator", {
      value: {},
      configurable: true,
      writable: true,
    });

    expect(isWebGPUAvailable()).toBe(false);
  });

  it("should return false when navigator is undefined", () => {
    // Mock undefined navigator (simulates Node.js environment without polyfills)
    Object.defineProperty(global, "navigator", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    expect(isWebGPUAvailable()).toBe(false);
  });

  it("should throw TypeError when navigator is null", () => {
    // Edge case: navigator is null
    // The 'in' operator will throw TypeError for null
    Object.defineProperty(global, "navigator", {
      value: null,
      configurable: true,
      writable: true,
    });

    expect(() => isWebGPUAvailable()).toThrow(TypeError);
  });

  it("should return true when navigator.gpu is explicitly undefined", () => {
    // The 'in' operator checks for property existence, not value
    // 'gpu' in { gpu: undefined } returns true
    Object.defineProperty(global, "navigator", {
      value: { gpu: undefined },
      configurable: true,
      writable: true,
    });

    // This is correct behavior - the 'in' operator checks property existence
    expect(isWebGPUAvailable()).toBe(true);
  });

  it("should handle navigator.gpu being null", () => {
    // Mock navigator with gpu explicitly set to null
    Object.defineProperty(global, "navigator", {
      value: { gpu: null },
      configurable: true,
      writable: true,
    });

    // Note: 'gpu' in navigator will be true even if gpu is null
    expect(isWebGPUAvailable()).toBe(true);
  });
});
