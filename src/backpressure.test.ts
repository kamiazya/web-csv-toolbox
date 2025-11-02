import { describe, it, expect } from "vitest";
import { CSVLexerTransformer } from "./CSVLexerTransformer.ts";
import { CSVRecordAssemblerTransformer } from "./CSVRecordAssemblerTransformer.ts";

describe("Backpressure handling", () => {
  describe("CSVLexerTransformer", () => {
    it("should handle backpressure with custom checkInterval", async () => {
      const csv = "a,b,c\n1,2,3\n4,5,6\n";
      const lexer = new CSVLexerTransformer(
        {},
        { highWaterMark: 1, size: (chunk) => chunk.length, checkInterval: 1 },
        { highWaterMark: 1, size: (tokens) => tokens.length, checkInterval: 1 },
      );

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(csv);
          controller.close();
        },
      });

      const results: unknown[] = [];
      await stream.pipeThrough(lexer).pipeTo(
        new WritableStream({
          write(chunk) {
            results.push(chunk);
          },
        }),
      );

      expect(results.length).toBeGreaterThan(0);
    });

    it("should use default checkInterval when not specified", async () => {
      const csv = "a,b\n1,2\n";
      const lexer = new CSVLexerTransformer();

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(csv);
          controller.close();
        },
      });

      const results: unknown[] = [];
      await stream.pipeThrough(lexer).pipeTo(
        new WritableStream({
          write(chunk) {
            results.push(chunk);
          },
        }),
      );

      expect(results.length).toBeGreaterThan(0);
    });

    it("should fallback to readableStrategy checkInterval", async () => {
      const csv = "a,b\n1,2\n";
      const lexer = new CSVLexerTransformer(
        {},
        { highWaterMark: 1000 }, // No checkInterval
        { highWaterMark: 1000, checkInterval: 50 }, // Has checkInterval
      );

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(csv);
          controller.close();
        },
      });

      const results: unknown[] = [];
      await stream.pipeThrough(lexer).pipeTo(
        new WritableStream({
          write(chunk) {
            results.push(chunk);
          },
        }),
      );

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("CSVRecordAssemblerTransformer", () => {
    it("should handle backpressure with custom checkInterval", async () => {
      const csv = "a,b\n1,2\n3,4\n";
      const lexer = new CSVLexerTransformer();
      const assembler = new CSVRecordAssemblerTransformer(
        {},
        {
          highWaterMark: 1,
          size: (tokens) => tokens.length,
          checkInterval: 1,
        },
        { highWaterMark: 1, size: () => 1, checkInterval: 1 },
      );

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(csv);
          controller.close();
        },
      });

      const results: unknown[] = [];
      await stream
        .pipeThrough(lexer)
        .pipeThrough(assembler)
        .pipeTo(
          new WritableStream({
            write(chunk) {
              results.push(chunk);
            },
          }),
        );

      expect(results.length).toBe(2);
      expect(results[0]).toEqual({ a: "1", b: "2" });
      expect(results[1]).toEqual({ a: "3", b: "4" });
    });

    it("should use default checkInterval when not specified", async () => {
      const csv = "a\n1\n2\n";
      const lexer = new CSVLexerTransformer();
      const assembler = new CSVRecordAssemblerTransformer();

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(csv);
          controller.close();
        },
      });

      const results: unknown[] = [];
      await stream
        .pipeThrough(lexer)
        .pipeThrough(assembler)
        .pipeTo(
          new WritableStream({
            write(chunk) {
              results.push(chunk);
            },
          }),
        );

      expect(results.length).toBe(2);
    });

    it("should fallback to readableStrategy checkInterval", async () => {
      const csv = "1\n2\n3\n";
      const lexer = new CSVLexerTransformer();
      const assembler = new CSVRecordAssemblerTransformer(
        { header: ["a"] },
        { highWaterMark: 1000 }, // No checkInterval
        { highWaterMark: 1000, checkInterval: 5 }, // Has checkInterval
      );

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(csv);
          controller.close();
        },
      });

      const results: unknown[] = [];
      await stream
        .pipeThrough(lexer)
        .pipeThrough(assembler)
        .pipeTo(
          new WritableStream({
            write(chunk) {
              results.push(chunk);
            },
          }),
        );

      expect(results.length).toBe(3);
    });
  });
});
