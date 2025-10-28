import { describe, expect, it } from "vitest";
import { WorkerSession } from "./WorkerSession.ts";
import { WorkerPool } from "./WorkerPool.ts";
import { sendWorkerMessage } from "../utils/messageHandler.ts";
import { serializeOptions } from "../utils/serializeOptions.ts";

describe("WorkerSession", () => {
  describe("Disposable worker mode (no pool)", () => {
    it("should create a session with disposable worker", async () => {
      using session = await WorkerSession.create();
      const worker = session.getWorker();
      expect(worker).toBeDefined();
    });

    it("should parse CSV string with disposable worker", async () => {
      using session = await WorkerSession.create();

      const csv = "a,b,c\n1,2,3\n4,5,6";
      const recordsIterator = sendWorkerMessage<{ a: string; b: string; c: string }>(
        session.getWorker(),
        {
          id: session.getNextRequestId(),
          type: "parseString",
          data: csv,
          options: serializeOptions({}),
          useWASM: false,
        },
        {},
      );

      const records = [];
      for await (const record of recordsIterator) {
        records.push(record);
      }

      expect(records).toEqual([
        { a: "1", b: "2", c: "3" },
        { a: "4", b: "5", c: "6" },
      ]);
    });

    it("should handle multiple parse operations in same session", async () => {
      using session = await WorkerSession.create();

      const csv1 = "a,b\n1,2";
      const recordsIterator1 = sendWorkerMessage<{ a: string; b: string }>(
        session.getWorker(),
        {
          id: session.getNextRequestId(),
          type: "parseString",
          data: csv1,
          options: serializeOptions({}),
          useWASM: false,
        },
        {},
      );

      const records1 = [];
      for await (const record of recordsIterator1) {
        records1.push(record);
      }

      const csv2 = "x,y\n3,4";
      const recordsIterator2 = sendWorkerMessage<{ x: string; y: string }>(
        session.getWorker(),
        {
          id: session.getNextRequestId(),
          type: "parseString",
          data: csv2,
          options: serializeOptions({}),
          useWASM: false,
        },
        {},
      );

      const records2 = [];
      for await (const record of recordsIterator2) {
        records2.push(record);
      }

      expect(records1).toEqual([{ a: "1", b: "2" }]);
      expect(records2).toEqual([{ x: "3", y: "4" }]);
    });

    it("should auto-increment request IDs", async () => {
      using session = await WorkerSession.create();

      const id1 = session.getNextRequestId();
      const id2 = session.getNextRequestId();
      const id3 = session.getNextRequestId();

      expect(id1).toBe(0);
      expect(id2).toBe(1);
      expect(id3).toBe(2);
    });
  });

  describe("WorkerPool mode", () => {
    it("should create a session using WorkerPool", async () => {
      using pool = new WorkerPool({ maxWorkers: 2 });
      using session = await WorkerSession.create({ workerPool: pool });

      const worker = session.getWorker();
      expect(worker).toBeDefined();
      expect(pool.size).toBe(1);
    });

    it("should parse CSV string with WorkerPool", async () => {
      using pool = new WorkerPool({ maxWorkers: 2 });
      using session = await WorkerSession.create({ workerPool: pool });

      const csv = "a,b,c\n1,2,3";
      const recordsIterator = sendWorkerMessage<{ a: string; b: string; c: string }>(
        session.getWorker(),
        {
          id: session.getNextRequestId(),
          type: "parseString",
          data: csv,
          options: serializeOptions({}),
          useWASM: false,
        },
        {},
      );

      const records = [];
      for await (const record of recordsIterator) {
        records.push(record);
      }

      expect(records).toEqual([{ a: "1", b: "2", c: "3" }]);
    });

    it("should reuse worker from pool across multiple sessions", async () => {
      using pool = new WorkerPool({ maxWorkers: 1 });

      using session1 = await WorkerSession.create({ workerPool: pool });
      const worker1 = session1.getWorker();
      expect(pool.size).toBe(1);

      using session2 = await WorkerSession.create({ workerPool: pool });
      const worker2 = session2.getWorker();
      expect(pool.size).toBe(1); // Still 1 worker
      expect(worker1).toBe(worker2); // Same worker instance
    });

    it("should not terminate worker when session disposes (pool manages lifecycle)", async () => {
      using pool = new WorkerPool({ maxWorkers: 1 });

      let worker: Worker;
      {
        using session = await WorkerSession.create({ workerPool: pool });
        worker = session.getWorker();
      }
      // Session disposed, but pool still has the worker

      expect(pool.size).toBe(1);

      // Worker should still be usable
      using session2 = await WorkerSession.create({ workerPool: pool });
      const worker2 = session2.getWorker();
      expect(worker2).toBe(worker);
    });
  });

  describe("Custom workerURL", () => {
    it("should accept custom workerURL in disposable mode", async () => {
      // Note: This test just verifies the API accepts the parameter
      // Actual custom worker URL testing would require a real custom worker file
      using session = await WorkerSession.create({
        workerURL: new URL("./execution/worker/worker.ts", import.meta.url),
      });

      expect(session.getWorker()).toBeDefined();
    });

    it("should accept custom workerURL with WorkerPool", async () => {
      using pool = new WorkerPool({ maxWorkers: 1 });
      using session = await WorkerSession.create({
        workerPool: pool,
        workerURL: new URL("./execution/worker/worker.ts", import.meta.url),
      });

      expect(session.getWorker()).toBeDefined();
    });
  });
});
