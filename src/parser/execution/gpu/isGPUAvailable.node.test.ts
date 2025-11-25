/**
 * Tests for isGPUAvailable function
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { isGPUAvailable } from "./isGPUAvailable.ts";

describe("isGPUAvailable", () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    // Reset navigator to original state
    vi.resetAllMocks();
  });

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  test("should return true when navigator.gpu exists", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { gpu: {} },
      writable: true,
      configurable: true,
    });

    expect(isGPUAvailable()).toBe(true);
  });

  test("should return false when navigator.gpu does not exist", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      writable: true,
      configurable: true,
    });

    expect(isGPUAvailable()).toBe(false);
  });

  test("should return false when navigator does not exist", () => {
    (globalThis as Record<string, unknown>).navigator = undefined;

    expect(isGPUAvailable()).toBe(false);
  });
});
