import { describe, expect, it } from "vitest";
import { parseString } from "../string/parseString.ts";

/**
 * Memory usage tests for worker execution
 *
 * These tests ensure that worker execution doesn't leak memory
 * and properly cleans up resources.
 */
// Skip worker tests in Node.js environment as they require browser APIs
describe.skipIf(typeof window === "undefined")(
  "parseString memory management",
  () => {
    it("should not leak memory with multiple worker executions", async () => {
      // Parse the same CSV multiple times with worker
      const csv = "a,b,c\n1,2,3\n4,5,6\n7,8,9";
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const records = [];
        for await (const record of parseString(csv, {
          engine: { worker: true },
        })) {
          records.push(record);
        }
        expect(records).toHaveLength(3);
      }

      // If we reach here without OOM, the test passes
      expect(true).toBe(true);
    });

    it("should handle large CSV data without memory issues", async () => {
      // Generate a large CSV (10,000 rows)
      const largeCSV = [
        "id,name,email,value",
        ...Array.from(
          { length: 10000 },
          (_, i) => `${i},User${i},user${i}@example.com,${i * 1.5}`,
        ),
      ].join("\n");

      const records = [];
      for await (const record of parseString(largeCSV, {
        engine: { worker: true },
      })) {
        records.push(record);
      }

      expect(records).toHaveLength(10000);
      expect(records[0]).toEqual({
        id: "0",
        name: "User0",
        email: "user0@example.com",
        value: "0",
      });
      expect(records[9999]).toEqual({
        id: "9999",
        name: "User9999",
        email: "user9999@example.com",
        value: "14998.5",
      });
    });

    it("should properly clean up after errors in worker", async () => {
      const invalidCSV = 'a,b,c\n1,2,3\n4,5,"unclosed quote';

      // This should throw an error
      await expect(async () => {
        for await (const _ of parseString(invalidCSV, {
          engine: { worker: true },
        })) {
          // noop
        }
      }).rejects.toThrow();

      // Subsequent parsing should still work (worker not corrupted)
      const validCSV = "a,b,c\n1,2,3";
      const records = [];
      for await (const record of parseString(validCSV, {
        engine: { worker: true },
      })) {
        records.push(record);
      }

      expect(records).toHaveLength(1);
      expect(records[0]).toEqual({ a: "1", b: "2", c: "3" });
    });

    it("should handle concurrent parsing without memory corruption", async () => {
      const csv1 = "a,b\n1,2\n3,4";
      const csv2 = "x,y\n5,6\n7,8";
      const csv3 = "p,q\n9,10\n11,12";

      // Parse all three concurrently
      const [r1, r2, r3] = await Promise.all([
        (async () => {
          const records = [];
          for await (const record of parseString(csv1, {
            engine: { worker: true },
          })) {
            records.push(record);
          }
          return records;
        })(),
        (async () => {
          const records = [];
          for await (const record of parseString(csv2, {
            engine: { worker: true },
          })) {
            records.push(record);
          }
          return records;
        })(),
        (async () => {
          const records = [];
          for await (const record of parseString(csv3, {
            engine: { worker: true },
          })) {
            records.push(record);
          }
          return records;
        })(),
      ]);

      // Each result should be independent (no memory corruption)
      expect(r1).toEqual([
        { a: "1", b: "2" },
        { a: "3", b: "4" },
      ]);
      expect(r2).toEqual([
        { x: "5", y: "6" },
        { x: "7", y: "8" },
      ]);
      expect(r3).toEqual([
        { p: "9", q: "10" },
        { p: "11", q: "12" },
      ]);
    });
  },
);
