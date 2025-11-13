import { beforeAll, describe, expect, it } from "vitest";
import { loadWASM } from "../../wasm/loadWASM.ts";
import { WASMStringCSVStreamTransformer } from "./WASMStringCSVStreamTransformer.ts";

/**
 * WASM CSV Stream Transformer browser tests
 *
 * These tests verify the WASM streaming parser in a browser environment
 * where WASM modules can be properly loaded.
 */
describe.skipIf(typeof window === "undefined")(
  "WASMCSVStreamTransformer",
  () => {
    beforeAll(async () => {
      await loadWASM();
    });

    describe("Basic streaming", () => {
      it("should parse simple CSV from stream", async () => {
        const csv = "name,age\nAlice,30\nBob,25\n";
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(csv);
            controller.close();
          },
        });

        const records = [];
        for await (const record of stream.pipeThrough(
          new WASMStringCSVStreamTransformer(),
        )) {
          records.push(record);
        }

        expect(records).toEqual([
          { name: "Alice", age: "30" },
          { name: "Bob", age: "25" },
        ]);
      });

      it("should handle empty CSV", async () => {
        const csv = "name,age\n";
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(csv);
            controller.close();
          },
        });

        const records = [];
        for await (const record of stream.pipeThrough(
          new WASMStringCSVStreamTransformer(),
        )) {
          records.push(record);
        }

        expect(records).toEqual([]);
      });

      it("should handle CSV with quotes", async () => {
        const csv =
          'name,description\nAlice,"Hello, World"\nBob,"Test ""quoted"" text"\n';
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(csv);
            controller.close();
          },
        });

        const records = [];
        for await (const record of stream.pipeThrough(
          new WASMStringCSVStreamTransformer(),
        )) {
          records.push(record);
        }

        expect(records).toEqual([
          { name: "Alice", description: "Hello, World" },
          { name: "Bob", description: 'Test "quoted" text' },
        ]);
      });
    });

    describe("Chunk boundary handling", () => {
      it("should handle chunks split in the middle of a line", async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue("name,age\n");
            controller.enqueue("Ali");
            controller.enqueue("ce,30\n");
            controller.enqueue("Bob,25\n");
            controller.close();
          },
        });

        const records = [];
        for await (const record of stream.pipeThrough(
          new WASMStringCSVStreamTransformer(),
        )) {
          records.push(record);
        }

        expect(records).toEqual([
          { name: "Alice", age: "30" },
          { name: "Bob", age: "25" },
        ]);
      });

      it("should handle chunks split in the middle of a quoted field", async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue("name,description\n");
            controller.enqueue('Alice,"Hello,');
            controller.enqueue(' World"\n');
            controller.close();
          },
        });

        const records = [];
        for await (const record of stream.pipeThrough(
          new WASMStringCSVStreamTransformer(),
        )) {
          records.push(record);
        }

        expect(records).toEqual([
          { name: "Alice", description: "Hello, World" },
        ]);
      });

      it("should handle one character at a time", async () => {
        const csv = "name,age\nAlice,30\nBob,25\n";
        const stream = new ReadableStream({
          start(controller) {
            for (const char of csv) {
              controller.enqueue(char);
            }
            controller.close();
          },
        });

        const records = [];
        for await (const record of stream.pipeThrough(
          new WASMStringCSVStreamTransformer(),
        )) {
          records.push(record);
        }

        expect(records).toEqual([
          { name: "Alice", age: "30" },
          { name: "Bob", age: "25" },
        ]);
      });
    });

    describe("Custom delimiter", () => {
      it("should handle tab delimiter", async () => {
        const csv = "name\tage\nAlice\t30\nBob\t25\n";
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(csv);
            controller.close();
          },
        });

        const records = [];
        for await (const record of stream.pipeThrough(
          new WASMStringCSVStreamTransformer({ delimiter: "\t" }),
        )) {
          records.push(record);
        }

        expect(records).toEqual([
          { name: "Alice", age: "30" },
          { name: "Bob", age: "25" },
        ]);
      });
    });

    describe("Edge cases", () => {
      it("should handle empty fields", async () => {
        const csv = "name,age,email\nAlice,30,\nBob,,bob@example.com\n";
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(csv);
            controller.close();
          },
        });

        const records = [];
        for await (const record of stream.pipeThrough(
          new WASMStringCSVStreamTransformer(),
        )) {
          records.push(record);
        }

        expect(records).toEqual([
          { name: "Alice", age: "30", email: "" },
          { name: "Bob", age: "", email: "bob@example.com" },
        ]);
      });

      it("should handle CRLF line endings", async () => {
        const csv = "name,age\r\nAlice,30\r\nBob,25\r\n";
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(csv);
            controller.close();
          },
        });

        const records = [];
        for await (const record of stream.pipeThrough(
          new WASMStringCSVStreamTransformer(),
        )) {
          records.push(record);
        }

        expect(records).toEqual([
          { name: "Alice", age: "30" },
          { name: "Bob", age: "25" },
        ]);
      });

      it("should handle Unicode characters", async () => {
        const csv = "名前,年齢\n太郎,30\n花子,25\n";
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(csv);
            controller.close();
          },
        });

        const records = [];
        for await (const record of stream.pipeThrough(
          new WASMStringCSVStreamTransformer(),
        )) {
          records.push(record);
        }

        expect(records).toEqual([
          { 名前: "太郎", 年齢: "30" },
          { 名前: "花子", 年齢: "25" },
        ]);
      });
    });

    describe("Large data", () => {
      it("should handle large CSV efficiently", async () => {
        const rowCount = 1000;
        let csv = "name,age,email\n";
        for (let i = 0; i < rowCount; i++) {
          csv += `User${i},${20 + (i % 50)},user${i}@example.com\n`;
        }

        const stream = new ReadableStream({
          start(controller) {
            // Split into chunks of ~1KB
            const chunkSize = 1024;
            for (let i = 0; i < csv.length; i += chunkSize) {
              controller.enqueue(csv.slice(i, i + chunkSize));
            }
            controller.close();
          },
        });

        const records = [];
        for await (const record of stream.pipeThrough(
          new WASMStringCSVStreamTransformer(),
        )) {
          records.push(record);
        }

        expect(records).toHaveLength(rowCount);
        expect(records[0]).toEqual({
          name: "User0",
          age: "20",
          email: "user0@example.com",
        });
        expect(records[rowCount - 1]).toEqual({
          name: `User${rowCount - 1}`,
          age: `${20 + ((rowCount - 1) % 50)}`,
          email: `user${rowCount - 1}@example.com`,
        });
      });
    });
  },
);
