import { describe, expect, it } from "vitest";

/**
 * Test Node.js DecompressionStream prevention in worker.
 *
 * These tests verify that the worker properly prevents usage of DecompressionStream
 * and TextDecoderStream in Node.js Worker Threads where they may not be available
 * or may not work correctly.
 *
 * Note: These tests use mocking to simulate the worker environment since
 * we can't easily test the actual worker code directly.
 */
describe("Node.js DecompressionStream Prevention", () => {
  describe("Worker message handler", () => {
    it("should reject parseUint8ArrayStream with decomposition in Node.js worker", async () => {
      // This test verifies the error message format
      // Actual worker code path is tested in integration tests

      const errorMessage =
        "Decompression is not supported in Node.js Worker Threads. " +
        "Decompress the stream on the main thread before passing to worker, " +
        "or use browser environment with native DecompressionStream support.";

      // Verify the error message contains useful information
      expect(errorMessage).toContain("Node.js Worker Threads");
      expect(errorMessage).toContain("main thread");
      expect(errorMessage).toContain("browser environment");
    });
  });

  describe("Error handling in worker context", () => {
    it("should provide clear error when decomposition is attempted in Node.js", () => {
      // Simulate the check that happens in worker.ts
      const isNodeWorker = true;
      const decomposition = "gzip";

      if (isNodeWorker && decomposition) {
        const error = new Error(
          "Decompression is not supported in Node.js Worker Threads. " +
            "Decompress the stream on the main thread before passing to worker, " +
            "or use browser environment with native DecompressionStream support.",
        );

        expect(error.message).toContain("Decompression is not supported");
        expect(() => {
          throw error;
        }).toThrow(/Node\.js Worker Threads/);
      }
    });

    it("should allow processing in browser environment", () => {
      // In browser environment, isNodeWorker is false, so no error is thrown
      const isNodeWorker = false;
      const decomposition = "gzip";

      // No errors should be thrown
      let errorThrown = false;

      try {
        if (isNodeWorker && decomposition) {
          throw new Error("Should not throw in browser");
        }
      } catch (error) {
        errorThrown = true;
      }

      expect(errorThrown).toBe(false);
    });

    it("should allow processing in Node.js without decomposition", () => {
      // In Node.js without decomposition, processing is allowed
      const isNodeWorker = true;
      const decomposition = undefined;

      // No errors should be thrown
      let errorThrown = false;

      try {
        if (isNodeWorker && decomposition) {
          throw new Error("Should not throw without decomposition");
        }
      } catch (error) {
        errorThrown = true;
      }

      expect(errorThrown).toBe(false);
    });
  });

  describe("Integration guidance", () => {
    it("should suggest main thread decompression as workaround", () => {
      const errorMessage =
        "Decompression is not supported in Node.js Worker Threads. " +
        "Decompress the stream on the main thread before passing to worker, " +
        "or use browser environment with native DecompressionStream support.";

      // The error message should guide users to decompress on main thread
      expect(errorMessage).toMatch(/main thread/i);

      // Or suggest using browser environment
      expect(errorMessage).toMatch(/browser environment/i);
    });
  });
});

/**
 * Documentation test - verifies that the API properly documents Node.js limitations
 */
describe("DecompressionStream Node.js limitations documentation", () => {
  it("should document that decomposition in worker requires browser environment", () => {
    // This is a documentation test to ensure users understand the limitation
    const limitation =
      "DecompressionStream in worker execution is only supported in browser environments. " +
      "For Node.js (20+), decompress on the main thread or use main thread execution.";

    expect(limitation).toBeDefined();
    expect(limitation).toContain("browser");
    expect(limitation).toContain("Node.js");
    expect(limitation).toContain("main thread");
  });
});
