import { describe, expect, it } from "vitest";
import { WorkerPool } from "./WorkerPool.ts";
import { parseString } from "./parseString.ts";

/**
 * WorkerPool tests
 *
 * These tests verify that WorkerPool properly manages worker lifecycle
 * and integrates with parsing functions.
 */
describe.skipIf(typeof window === "undefined")("WorkerPool", () => {
  it("should create and dispose worker", async () => {
    const pool = new WorkerPool();
    const worker = await pool.getWorker();

    expect(worker).toBeDefined();

    pool[Symbol.dispose]();

    // After disposal, worker should be terminated
    // (we can't directly verify termination, but no error should occur)
    expect(true).toBe(true);
  });

  it("should reuse the same worker instance", async () => {
    using pool = new WorkerPool();

    const worker1 = await pool.getWorker();
    const worker2 = await pool.getWorker();

    // Should return the same worker instance
    expect(worker1).toBe(worker2);
  });

  it("should work with parseString", async () => {
    using pool = new WorkerPool();

    const csv = "a,b,c\n1,2,3\n4,5,6";

    const records = [];
    for await (const record of parseString(csv, {
      execution: ["worker"],
      workerPool: pool,
    })) {
      records.push(record);
    }

    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ a: "1", b: "2", c: "3" });
    expect(records[1]).toEqual({ a: "4", b: "5", c: "6" });
  });

  it("should handle multiple parsing operations with same pool", async () => {
    using pool = new WorkerPool();

    const csv1 = "a,b\n1,2";
    const csv2 = "x,y\n3,4";
    const csv3 = "p,q\n5,6";

    const results = await Promise.all([
      (async () => {
        const records = [];
        for await (const record of parseString(csv1, {
          execution: ["worker"],
          workerPool: pool,
        })) {
          records.push(record);
        }
        return records;
      })(),
      (async () => {
        const records = [];
        for await (const record of parseString(csv2, {
          execution: ["worker"],
          workerPool: pool,
        })) {
          records.push(record);
        }
        return records;
      })(),
      (async () => {
        const records = [];
        for await (const record of parseString(csv3, {
          execution: ["worker"],
          workerPool: pool,
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
    using pool = new WorkerPool();

    const id1 = pool.getNextRequestId();
    const id2 = pool.getNextRequestId();
    const id3 = pool.getNextRequestId();

    expect(id1).toBe(0);
    expect(id2).toBe(1);
    expect(id3).toBe(2);
  });

  it("should work with AbortSignal", async () => {
    using pool = new WorkerPool();

    const csv = "a,b,c\n1,2,3";
    const controller = new AbortController();
    controller.abort();

    await expect(async () => {
      for await (const _ of parseString(csv, {
        execution: ["worker"],
        workerPool: pool,
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
      using pool = new WorkerPool();
      const records = [];
      for await (const record of parseString(csv, {
        execution: ["worker"],
        workerPool: pool,
      })) {
        records.push(record);
      }
      expect(records).toHaveLength(1);
      // Pool disposed here
    }

    // Second scope with new pool
    {
      using pool = new WorkerPool();
      const records = [];
      for await (const record of parseString(csv, {
        execution: ["worker"],
        workerPool: pool,
      })) {
        records.push(record);
      }
      expect(records).toHaveLength(1);
      // Pool disposed here
    }
  });
});
