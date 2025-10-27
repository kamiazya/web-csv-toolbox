import { describe, expect, it } from "vitest";
import { parseString } from "../../../parseString.ts";

/**
 * Test to verify WorkerManager behavior with concurrent requests
 */
describe.skipIf(typeof window === "undefined")(
  "WorkerManager concurrent requests",
  () => {
    it("should handle multiple concurrent requests correctly (sequential processing)", async () => {
      const csv1 = "a,b\n1,2\n3,4";
      const csv2 = "x,y\n5,6\n7,8";
      const csv3 = "p,q\n9,10\n11,12";

      const startTime = Date.now();

      // Send 3 concurrent requests to the same worker (WorkerManager singleton)
      const results = await Promise.all([
        (async () => {
          const records = [];
          for await (const record of parseString(csv1, {
            execution: ["worker"],
          })) {
            records.push(record);
          }
          return records;
        })(),
        (async () => {
          const records = [];
          for await (const record of parseString(csv2, {
            execution: ["worker"],
          })) {
            records.push(record);
          }
          return records;
        })(),
        (async () => {
          const records = [];
          for await (const record of parseString(csv3, {
            execution: ["worker"],
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

      // Single worker processes requests sequentially, but all complete successfully
      console.log(`Duration: ${duration}ms (sequential processing with single worker)`);
    });
  }
);
