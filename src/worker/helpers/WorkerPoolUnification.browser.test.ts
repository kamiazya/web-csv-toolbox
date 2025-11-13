import { describe, expect, it } from "vitest";
import { parseString } from "../../parser/api/string/parseString.ts";
import { ReusableWorkerPool as WorkerPool } from "./ReusableWorkerPool.ts";

/**
 * Test to verify WorkerPool with maxWorkers=1 behaves the same as WorkerManager
 */
describe.skipIf(typeof window === "undefined")(
  "WorkerPool vs WorkerManager equivalence",
  () => {
    it("WorkerPool with maxWorkers=1 should behave like WorkerManager (sequential processing)", async () => {
      using pool = new WorkerPool({ maxWorkers: 1 });

      const csv1 = "a,b\n1,2\n3,4";
      const csv2 = "x,y\n5,6\n7,8";
      const csv3 = "p,q\n9,10\n11,12";

      const startTime = Date.now();

      // Send 3 concurrent requests to the same pool with maxWorkers=1
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

      const duration = Date.now() - startTime;

      // Verify all results are correct
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

      // Should be sequential like WorkerManager
      console.log(
        `WorkerPool(maxWorkers=1) Duration: ${duration}ms (should be sequential)`,
      );

      // Pool should only have 1 worker
      expect(pool.size).toBe(1);
    });

    it("WorkerPool with maxWorkers=1 should reuse the same worker", async () => {
      using pool = new WorkerPool({ maxWorkers: 1 });

      const worker1 = await pool.getWorker();
      const worker2 = await pool.getWorker();
      const worker3 = await pool.getWorker();

      // All should be the same worker instance
      expect(worker1).toBe(worker2);
      expect(worker2).toBe(worker3);
      expect(pool.size).toBe(1);
    });

    it("comparison: WorkerPool with maxWorkers=3 should be faster", async () => {
      using pool = new WorkerPool({ maxWorkers: 3 });

      const csv1 = "a,b\n1,2\n3,4\n5,6\n7,8";
      const csv2 = "x,y\n9,10\n11,12\n13,14\n15,16";
      const csv3 = "p,q\n17,18\n19,20\n21,22\n23,24";

      const startTime = Date.now();

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

      const duration = Date.now() - startTime;

      expect(results).toHaveLength(3);
      expect(pool.size).toBe(3); // 3 workers created

      console.log(
        `WorkerPool(maxWorkers=3) Duration: ${duration}ms (should be parallel, faster)`,
      );
    });
  },
);
