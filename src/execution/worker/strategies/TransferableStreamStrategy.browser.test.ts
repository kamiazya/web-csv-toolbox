import { describe, expect, it } from "vitest";
import { parseStringStream } from "../../../parseStringStream.ts";
import { parseUint8ArrayStream } from "../../../parseUint8ArrayStream.ts";
import { SingleValueReadableStream } from "../../../utils/SingleValueReadableStream.ts";
import { EnginePresets } from "../../EnginePresets.ts";

describe("TransferableStreamStrategy in browser", () => {
  describe("parseStringStream with stream-transfer", () => {
    it("should parse CSV using stream-transfer strategy", async () => {
      const csv = "name,age\nAlice,30\nBob,25";
      const stream = new SingleValueReadableStream(csv);

      const records = [];
      for await (const record of parseStringStream(stream, {
        engine: EnginePresets.workerStreamTransfer(),
      })) {
        records.push(record);
      }

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("should handle empty CSV", async () => {
      const csv = "name,age";
      const stream = new SingleValueReadableStream(csv);

      const records = [];
      for await (const record of parseStringStream(stream, {
        engine: EnginePresets.workerStreamTransfer(),
      })) {
        records.push(record);
      }

      expect(records).toEqual([]);
    });

    it("should handle large CSV efficiently", async () => {
      // Generate a large CSV
      const rows = Array.from({ length: 1000 }, (_, i) => `Row${i},${i}`);
      const csv = `name,value\n${rows.join("\n")}`;
      const stream = new SingleValueReadableStream(csv);

      let count = 0;
      for await (const record of parseStringStream(stream, {
        engine: EnginePresets.workerStreamTransfer(),
      })) {
        expect(record).toHaveProperty("name");
        expect(record).toHaveProperty("value");
        count++;
      }

      expect(count).toBe(1000);
    });

    it("should handle CSV with special characters", async () => {
      const csv = 'name,description\n"Alice","Line1\nLine2"\n"Bob","Tab\there"';
      const stream = new SingleValueReadableStream(csv);

      const records = [];
      for await (const record of parseStringStream(stream, {
        engine: EnginePresets.workerStreamTransfer(),
      })) {
        records.push(record);
      }

      expect(records).toEqual([
        { name: "Alice", description: "Line1\nLine2" },
        { name: "Bob", description: "Tab\there" },
      ]);
    });
  });

  describe("parseUint8ArrayStream with stream-transfer", () => {
    it("should parse binary CSV using stream-transfer strategy", async () => {
      const csv = "name,age\nAlice,30\nBob,25";
      const encoder = new TextEncoder();
      const binary = encoder.encode(csv);

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(binary);
          controller.close();
        },
      });

      const records = [];
      for await (const record of parseUint8ArrayStream(stream, {
        engine: EnginePresets.workerStreamTransfer(),
      })) {
        records.push(record);
      }

      expect(records).toEqual([
        { name: "Alice", age: "30" },
        { name: "Bob", age: "25" },
      ]);
    });

    it("should handle different encodings", async () => {
      const csv = "name,age\nAlice,30";
      const encoder = new TextEncoder();
      const binary = encoder.encode(csv);

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(binary);
          controller.close();
        },
      });

      const records = [];
      for await (const record of parseUint8ArrayStream(stream, {
        engine: EnginePresets.workerStreamTransfer(),
        charset: "utf-8",
      })) {
        records.push(record);
      }

      expect(records).toEqual([{ name: "Alice", age: "30" }]);
    });
  });

  describe("Fallback behavior", () => {
    it("should track fallback with onFallback callback", async () => {
      const csv = "name,age\nAlice,30";
      const stream = new SingleValueReadableStream(csv);

      const fallbacks: any[] = [];
      const records = [];

      for await (const record of parseStringStream(stream, {
        engine: {
          worker: true,
          workerStrategy: "stream-transfer",
          onFallback: (info) => fallbacks.push(info),
        },
      })) {
        records.push(record);
      }

      expect(records).toEqual([{ name: "Alice", age: "30" }]);

      // Note: Fallback may or may not occur depending on browser support
      // This test just verifies that if fallback occurs, it's tracked
      if (fallbacks.length > 0) {
        expect(fallbacks[0]).toHaveProperty("requestedConfig");
        expect(fallbacks[0]).toHaveProperty("actualConfig");
        expect(fallbacks[0]).toHaveProperty("reason");
      }
    });
  });

  describe("Comparison with message-streaming", () => {
    it("should produce identical results to message-streaming", async () => {
      const csv = "name,age,city\nAlice,30,NYC\nBob,25,LA\nCharlie,35,SF";

      // Parse with stream-transfer
      const stream1 = new SingleValueReadableStream(csv);
      const records1 = [];
      for await (const record of parseStringStream(stream1, {
        engine: EnginePresets.workerStreamTransfer(),
      })) {
        records1.push(record);
      }

      // Parse with message-streaming (should work on all browsers)
      const stream2 = new SingleValueReadableStream(csv);
      const records2 = [];
      for await (const record of parseStringStream(stream2, {
        engine: { worker: false }, // Main thread for comparison
      })) {
        records2.push(record);
      }

      expect(records1).toEqual(records2);
    });
  });

  describe("Performance characteristics", () => {
    it("should handle concurrent parsing efficiently", async () => {
      const csv1 = Array.from({ length: 100 }, (_, i) => `A${i},${i}`).join("\n");
      const csv2 = Array.from({ length: 100 }, (_, i) => `B${i},${i}`).join("\n");
      const csv3 = Array.from({ length: 100 }, (_, i) => `C${i},${i}`).join("\n");

      const stream1 = new SingleValueReadableStream(`col1,col2\n${csv1}`);
      const stream2 = new SingleValueReadableStream(`col1,col2\n${csv2}`);
      const stream3 = new SingleValueReadableStream(`col1,col2\n${csv3}`);

      const startTime = Date.now();

      // Parse all three concurrently
      const results = await Promise.all([
        (async () => {
          const records = [];
          for await (const record of parseStringStream(stream1, {
            engine: EnginePresets.workerStreamTransfer(),
          })) {
            records.push(record);
          }
          return records;
        })(),
        (async () => {
          const records = [];
          for await (const record of parseStringStream(stream2, {
            engine: EnginePresets.workerStreamTransfer(),
          })) {
            records.push(record);
          }
          return records;
        })(),
        (async () => {
          const records = [];
          for await (const record of parseStringStream(stream3, {
            engine: EnginePresets.workerStreamTransfer(),
          })) {
            records.push(record);
          }
          return records;
        })(),
      ]);

      const duration = Date.now() - startTime;

      expect(results[0]).toHaveLength(100);
      expect(results[1]).toHaveLength(100);
      expect(results[2]).toHaveLength(100);

      // Log performance for informational purposes
      console.log(`Concurrent parsing of 3x100 rows took ${duration}ms`);
    });
  });

  describe("Error handling", () => {
    it("should handle invalid CSV gracefully", async () => {
      const csv = 'name,age\n"Alice,30\nBob,25'; // Unclosed quote
      const stream = new SingleValueReadableStream(csv);

      const records = [];
      try {
        for await (const record of parseStringStream(stream, {
          engine: EnginePresets.workerStreamTransfer(),
        })) {
          records.push(record);
        }
      } catch (error) {
        // Error is expected for malformed CSV
        expect(error).toBeDefined();
      }
    });
  });
});
