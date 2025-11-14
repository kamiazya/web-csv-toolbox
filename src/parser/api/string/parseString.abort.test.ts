import { describe, expect, it } from "vitest";
import { parseString } from "@/parser/api/string/parseString.ts";

/**
 * AbortSignal tests for worker execution
 *
 * These tests ensure that AbortSignal is properly handled
 * when parsing CSV data in worker threads.
 */
describe("parseString AbortSignal handling", () => {
  it("should handle already aborted signal", async () => {
    const csv = "a,b,c\n1,2,3\n4,5,6";
    const controller = new AbortController();
    controller.abort();

    try {
      for await (const _ of parseString(csv, {
        engine: { worker: true },
        signal: controller.signal,
      })) {
        // Should not reach here
      }
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe("AbortError");
    }
  });

  it("should abort parsing when signal is triggered", async () => {
    const csv = "a,b,c\n1,2,3\n4,5,6\n7,8,9";
    const controller = new AbortController();

    // Abort after a short delay
    setTimeout(() => controller.abort(), 10);

    try {
      for await (const _record of parseString(csv, {
        engine: { worker: true },
        signal: controller.signal,
      })) {
        // Add delay to allow abort to trigger
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe("AbortError");
    }
  });

  it("should complete parsing when signal is not aborted", async () => {
    const csv = "a,b,c\n1,2,3\n4,5,6";
    const controller = new AbortController();

    const records = [];
    for await (const record of parseString(csv, {
      engine: { worker: true },
      signal: controller.signal,
    })) {
      records.push(record);
    }

    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({ a: "1", b: "2", c: "3" });
    expect(records[1]).toEqual({ a: "4", b: "5", c: "6" });
  });

  it("should throw DOMException with name AbortError", async () => {
    const csv = "a,b,c\n1,2,3";
    const controller = new AbortController();
    controller.abort();

    try {
      for await (const _ of parseString(csv, {
        engine: { worker: true },
        signal: controller.signal,
      })) {
        // Should not reach here
      }
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe("AbortError");
    }
  });
});
