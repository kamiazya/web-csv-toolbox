import { describe, expect, it } from "vitest";
import { parseString } from "../../../parseString.ts";
import { ReusableWorkerPool } from "./ReusableWorkerPool.ts";

/**
 * ReusableWorkerPool tests
 *
 * These tests verify that ReusableWorkerPool properly manages worker lifecycle
 * and integrates with parsing functions.
 */
describe.skipIf(typeof window === "undefined")("ReusableWorkerPool", () => {
  it("should create and dispose worker", async () => {
    const pool = new ReusableWorkerPool();
    const worker = await pool.getWorker();

    expect(worker).toBeDefined();

    pool[Symbol.dispose]();

    // After disposal, worker should be terminated
    // (we can't directly verify termination, but no error should occur)
    expect(true).toBe(true);
  });

  it("should terminate workers using terminate() method", async () => {
    const pool = new ReusableWorkerPool();
    const worker = await pool.getWorker();

    expect(worker).toBeDefined();
    expect(pool.size).toBe(1);

    // Terminate using the public method
    pool.terminate();

    // After termination, pool should be empty
    expect(pool.size).toBe(0);
  });

  it("should be compatible with Symbol.dispose and terminate()", async () => {
    const pool = new ReusableWorkerPool({ maxWorkers: 2 });

    // Create some workers
    await pool.getWorker();
    await pool.getWorker();

    expect(pool.size).toBe(2);

    // Symbol.dispose should call terminate internally
    pool[Symbol.dispose]();

    expect(pool.size).toBe(0);
  });

  it("should reuse the same worker instance", async () => {
    using pool = new ReusableWorkerPool();

    const worker1 = await pool.getWorker();
    const worker2 = await pool.getWorker();

    // Should return the same worker instance
    expect(worker1).toBe(worker2);
  });

  it("should work with parseString", async () => {
    using pool = new ReusableWorkerPool();

    const csv = "a,b,c\n1,2,3\n4,5,6";

    const records = [];
    for await (const record of parseString(csv, {
      engine: { worker: true, workerPool: pool },
    })) {
      records.push(record);
    }

    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ a: "1", b: "2", c: "3" });
    expect(records[1]).toEqual({ a: "4", b: "5", c: "6" });
  });

  it("should handle multiple parsing operations with same pool", async () => {
    using pool = new ReusableWorkerPool();

    const csv1 = "a,b\n1,2";
    const csv2 = "x,y\n3,4";
    const csv3 = "p,q\n5,6";

    const results = await Promise.all([
      (async () => {
        const records = [];
        for await (const record of parseString(csv1, {
          engine: { worker: true, workerPool: pool },
        })) {
          records.push(record);
        }
        return records;
      })(),
      (async () => {
        const records = [];
        for await (const record of parseString(csv2, {
          engine: { worker: true, workerPool: pool },
        })) {
          records.push(record);
        }
        return records;
      })(),
      (async () => {
        const records = [];
        for await (const record of parseString(csv3, {
          engine: { worker: true, workerPool: pool },
        })) {
          records.push(record);
        }
        return records;
      })(),
    ]);

    expect(results[0]).toEqual([{ a: "1", b: "2" }]);
    expect(results[1]).toEqual([{ x: "3", y: "4" }]);
    expect(results[2]).toEqual([{ p: "5", q: "6" }]);
  });

  it("should generate unique request IDs", () => {
    using pool = new ReusableWorkerPool();

    const id1 = pool.getNextRequestId();
    const id2 = pool.getNextRequestId();
    const id3 = pool.getNextRequestId();

    expect(id1).toBe(0);
    expect(id2).toBe(1);
    expect(id3).toBe(2);
  });

  it("should work with AbortSignal", async () => {
    using pool = new ReusableWorkerPool();

    const csv = "a,b,c\n1,2,3";
    const controller = new AbortController();
    controller.abort();

    await expect(async () => {
      for await (const _ of parseString(csv, {
        engine: { worker: true, workerPool: pool },
        signal: controller.signal,
      })) {
        // Should not reach here
      }
    }).rejects.toThrow();
  });

  it("should allow processing after disposal in new scope", async () => {
    const csv = "a,b\n1,2";

    // First scope
    {
      using pool = new ReusableWorkerPool();
      const records = [];
      for await (const record of parseString(csv, {
        engine: { worker: true, workerPool: pool },
      })) {
        records.push(record);
      }
      expect(records).toHaveLength(1);
      // Pool disposed here
    }

    // Second scope with new pool
    {
      using pool = new ReusableWorkerPool();
      const records = [];
      for await (const record of parseString(csv, {
        engine: { worker: true, workerPool: pool },
      })) {
        records.push(record);
      }
      expect(records).toHaveLength(1);
      // Pool disposed here
    }
  });

  describe("isFull()", () => {
    it("should return false when pool is not full", () => {
      using pool = new ReusableWorkerPool({ maxWorkers: 3 });
      expect(pool.isFull()).toBe(false);
    });

    it("should return true when pool reaches maximum capacity", async () => {
      using pool = new ReusableWorkerPool({ maxWorkers: 2 });

      expect(pool.isFull()).toBe(false);

      await pool.getWorker();
      expect(pool.isFull()).toBe(false);

      await pool.getWorker();
      expect(pool.isFull()).toBe(true);
    });

    it("should return false after terminating workers", async () => {
      const pool = new ReusableWorkerPool({ maxWorkers: 2 });

      await pool.getWorker();
      await pool.getWorker();
      expect(pool.isFull()).toBe(true);

      pool.terminate();
      expect(pool.isFull()).toBe(false);
    });

    it("should account for pending worker creations", async () => {
      using pool = new ReusableWorkerPool({ maxWorkers: 2 });

      // Start creating workers concurrently
      const promise1 = pool.getWorker();
      const promise2 = pool.getWorker();

      // Pool should be considered full even before workers are created
      expect(pool.isFull()).toBe(true);

      await Promise.all([promise1, promise2]);
      expect(pool.isFull()).toBe(true);
    });
  });

  describe("Multiple Workers", () => {
    it("should create multiple workers when maxWorkers > 1", async () => {
      using pool = new ReusableWorkerPool({ maxWorkers: 3 });

      const worker1 = await pool.getWorker();
      const worker2 = await pool.getWorker();
      const worker3 = await pool.getWorker();

      expect(pool.size).toBe(3);
      expect(worker1).toBeDefined();
      expect(worker2).toBeDefined();
      expect(worker3).toBeDefined();

      // All workers should be different instances
      expect(worker1).not.toBe(worker2);
      expect(worker2).not.toBe(worker3);
      expect(worker1).not.toBe(worker3);
    });

    it("should use round-robin load balancing", async () => {
      using pool = new ReusableWorkerPool({ maxWorkers: 2 });

      // Create 2 workers
      const worker1 = await pool.getWorker();
      const worker2 = await pool.getWorker();

      expect(pool.size).toBe(2);

      // Third request should return worker1 (round-robin)
      const worker3 = await pool.getWorker();
      expect(worker3).toBe(worker1);

      // Fourth request should return worker2
      const worker4 = await pool.getWorker();
      expect(worker4).toBe(worker2);

      // Fifth request should return worker1 again
      const worker5 = await pool.getWorker();
      expect(worker5).toBe(worker1);
    });

    it("should process multiple CSVs in parallel with multiple workers", async () => {
      using pool = new ReusableWorkerPool({ maxWorkers: 4 });

      const csvFiles = [
        "a,b\n1,2\n3,4",
        "x,y\n5,6\n7,8",
        "p,q\n9,10\n11,12",
        "m,n\n13,14\n15,16",
      ];

      const results = await Promise.all(
        csvFiles.map(async (csv) => {
          const records = [];
          for await (const record of parseString(csv, {
            engine: { worker: true, workerPool: pool },
          })) {
            records.push(record);
          }
          return records;
        }),
      );

      // All 4 workers should have been created
      expect(pool.size).toBe(4);

      // Verify all results
      expect(results[0]).toEqual([
        { a: "1", b: "2" },
        { a: "3", b: "4" },
      ]);
      expect(results[1]).toEqual([
        { x: "5", y: "6" },
        { x: "7", y: "8" },
      ]);
      expect(results[2]).toEqual([
        { p: "9", q: "10" },
        { p: "11", q: "12" },
      ]);
      expect(results[3]).toEqual([
        { m: "13", n: "14" },
        { m: "15", n: "16" },
      ]);
    });

    it("should throw error when maxWorkers < 1", () => {
      expect(() => new ReusableWorkerPool({ maxWorkers: 0 })).toThrow(
        "maxWorkers must be at least 1",
      );
      expect(() => new ReusableWorkerPool({ maxWorkers: -1 })).toThrow(
        "maxWorkers must be at least 1",
      );
    });

    it("should terminate all workers on disposal", async () => {
      const pool = new ReusableWorkerPool({ maxWorkers: 3 });

      // Create all 3 workers
      await pool.getWorker();
      await pool.getWorker();
      await pool.getWorker();

      expect(pool.size).toBe(3);

      // Dispose pool
      pool[Symbol.dispose]();

      // Size should be reset to 0
      expect(pool.size).toBe(0);
    });

    it("should default to single worker when maxWorkers not specified", async () => {
      using pool = new ReusableWorkerPool();

      const worker1 = await pool.getWorker();
      const worker2 = await pool.getWorker();

      // Should be the same worker (singleton behavior)
      expect(worker1).toBe(worker2);
      expect(pool.size).toBe(1);
    });
  });
});
