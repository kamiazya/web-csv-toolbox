import { describe, expect, it } from "vitest";
import { ReusableWorkerPool } from "./ReusableWorkerPool.ts";

/**
 * Tests for undefined checks added for TypeScript 5.9 strict type checking
 * in ReusableWorkerPool
 */
describe.skipIf(typeof Worker === "undefined")(
  "ReusableWorkerPool undefined checks",
  () => {
    it("should handle getWorker when no workers exist", async () => {
      using pool = new ReusableWorkerPool({ maxWorkers: 1 });

      // First call should create a worker successfully
      const worker = await pool.getWorker();
      expect(worker).toBeDefined();
    });

    it("should handle getWorker with custom URL", async () => {
      // Create a simple worker blob for testing
      const workerBlob = new Blob(
        [
          `
        self.addEventListener('message', (e) => {
          self.postMessage({ id: e.data.id, type: 'done' });
        });
      `,
        ],
        { type: "application/javascript" },
      );
      const workerURL = URL.createObjectURL(workerBlob);

      try {
        using pool = new ReusableWorkerPool({ workerURL });

        // Should successfully get a worker with custom URL
        const worker = await pool.getWorker(workerURL);
        expect(worker).toBeDefined();
      } finally {
        URL.revokeObjectURL(workerURL);
      }
    });

    it("should handle multiple concurrent getWorker calls", async () => {
      using pool = new ReusableWorkerPool({ maxWorkers: 2 });

      // Create multiple concurrent requests
      const workers = await Promise.all([
        pool.getWorker(),
        pool.getWorker(),
        pool.getWorker(),
      ]);

      // All requests should succeed
      expect(workers).toHaveLength(3);
      expect(workers.every((w) => w !== undefined)).toBe(true);
    });

    it("should handle worker pool with max workers limit", async () => {
      using pool = new ReusableWorkerPool({ maxWorkers: 2 });

      // Create workers up to the limit
      const worker1 = await pool.getWorker();
      const worker2 = await pool.getWorker();

      expect(worker1).toBeDefined();
      expect(worker2).toBeDefined();
      expect(pool.size).toBe(2);

      // Getting another worker should reuse existing ones
      const worker3 = await pool.getWorker();
      expect(worker3).toBeDefined();
      // Size should still be 2 (reusing existing workers)
      expect(pool.size).toBe(2);
    });

    it("should throw error when disposed", async () => {
      const pool = new ReusableWorkerPool();
      pool[Symbol.dispose]();

      // Attempting to get a worker after disposal should throw
      await expect(pool.getWorker()).rejects.toThrow("disposed");
    });
  },
);
