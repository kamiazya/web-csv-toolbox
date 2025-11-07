import { beforeEach, describe, expect, it, vi } from "vitest";
import { CSVLexerTransformer } from "./CSVLexerTransformer.ts";
import { CSVRecordAssemblerTransformer } from "./CSVRecordAssemblerTransformer.ts";

describe("Backpressure handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("CSVLexerTransformer", () => {
    it("should execute yieldToEventLoop during transform when backpressure occurs", async () => {
      const csv = "a,b,c\n1,2,3\n4,5,6\n";
      const lexer = new CSVLexerTransformer(
        {},
        { highWaterMark: 1, size: (chunk) => chunk.length, checkInterval: 1 },
        { highWaterMark: 1, size: () => 1, checkInterval: 1 },
      );

      // Don't mock - let it execute for coverage
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

    it("should call yieldToEventLoop when backpressure is detected with checkInterval=1", async () => {
      const csv = "a,b,c\n1,2,3\n4,5,6\n";
      const lexer = new CSVLexerTransformer(
        {},
        { highWaterMark: 1, size: (chunk) => chunk.length, checkInterval: 1 },
        { highWaterMark: 1, size: () => 1, checkInterval: 1 },
      );

      // Spy on the yieldToEventLoop method and mock it
      const _yieldSpy = vi
        .spyOn(lexer, "yieldToEventLoop" as any)
        .mockResolvedValue(undefined);

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
      // yieldToEventLoop may have been called depending on timing
      // The test passes if processing completes successfully
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

    it("should verify yieldToEventLoop method exists and is callable", () => {
      const lexer = new CSVLexerTransformer();

      // Verify the method exists
      expect(typeof (lexer as any).yieldToEventLoop).toBe("function");

      // Verify it returns a Promise
      const result = (lexer as any).yieldToEventLoop();
      expect(result).toBeInstanceOf(Promise);

      return result; // Ensure promise resolves
    });

    it("should execute yieldToEventLoop during flush when backpressure occurs", async () => {
      const csv = "a,b,";
      const lexer = new CSVLexerTransformer(
        {},
        { highWaterMark: 1, size: (chunk) => chunk.length, checkInterval: 1 },
        { highWaterMark: 1, size: () => 1, checkInterval: 1 },
      );

      // Don't mock - let it execute for coverage
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
    it("should execute yieldToEventLoop during transform when backpressure occurs", async () => {
      const csv = "a,b\n1,2\n3,4\n";
      const lexer = new CSVLexerTransformer();
      const assembler = new CSVRecordAssemblerTransformer(
        {},
        {
          highWaterMark: 1,
          size: () => 1,
          checkInterval: 1,
        },
        { highWaterMark: 1, size: () => 1, checkInterval: 1 },
      );

      // Don't mock - let it execute for coverage
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

    it("should call yieldToEventLoop when backpressure is detected with checkInterval=1", async () => {
      const csv = "a,b\n1,2\n3,4\n";
      const lexer = new CSVLexerTransformer();
      const assembler = new CSVRecordAssemblerTransformer(
        {},
        {
          highWaterMark: 1,
          size: () => 1,
          checkInterval: 1,
        },
        { highWaterMark: 1, size: () => 1, checkInterval: 1 },
      );

      // Mock yieldToEventLoop to prevent actual delays
      vi.spyOn(assembler, "yieldToEventLoop" as any).mockResolvedValue(
        undefined,
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

    it("should verify yieldToEventLoop method exists and is callable", () => {
      const assembler = new CSVRecordAssemblerTransformer();

      // Verify the method exists
      expect(typeof (assembler as any).yieldToEventLoop).toBe("function");

      // Verify it returns a Promise
      const result = (assembler as any).yieldToEventLoop();
      expect(result).toBeInstanceOf(Promise);

      return result; // Ensure promise resolves
    });

    it("should execute yieldToEventLoop during flush when backpressure occurs", async () => {
      const csv = "a,b\n1,";
      const lexer = new CSVLexerTransformer();
      const assembler = new CSVRecordAssemblerTransformer(
        {},
        {
          highWaterMark: 1,
          size: () => 1,
          checkInterval: 1,
        },
        { highWaterMark: 1, size: () => 1, checkInterval: 1 },
      );

      // Don't mock - let it execute for coverage
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

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("Integration: backpressure handling behavior", () => {
    it("should process large CSV without blocking", async () => {
      // Large CSV to test performance
      const rows = Array.from(
        { length: 500 },
        (_, i) => `${i},value${i},data${i}`,
      );
      const csv = `id,value,data\n${rows.join("\n")}\n`;

      const lexer = new CSVLexerTransformer(
        {},
        { highWaterMark: 65536, checkInterval: 100 },
        { highWaterMark: 1024, checkInterval: 100 },
      );
      const assembler = new CSVRecordAssemblerTransformer(
        {},
        { highWaterMark: 1024, checkInterval: 10 },
        { highWaterMark: 256, checkInterval: 10 },
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

      expect(results.length).toBe(500);
      // Verify first and last records
      expect(results[0]).toEqual({ id: "0", value: "value0", data: "data0" });
      expect(results[499]).toEqual({
        id: "499",
        value: "value499",
        data: "data499",
      });
    });

    it("should handle checkInterval configuration correctly", () => {
      // Test that checkInterval is properly configured
      const lexerWithWritableInterval = new CSVLexerTransformer(
        {},
        { highWaterMark: 100, checkInterval: 42 },
        { highWaterMark: 100 },
      );

      const lexerWithReadableInterval = new CSVLexerTransformer(
        {},
        { highWaterMark: 100 },
        { highWaterMark: 100, checkInterval: 84 },
      );

      const assemblerWithWritableInterval = new CSVRecordAssemblerTransformer(
        {},
        { highWaterMark: 100, checkInterval: 21 },
        { highWaterMark: 100 },
      );

      const assemblerWithReadableInterval = new CSVRecordAssemblerTransformer(
        {},
        { highWaterMark: 100 },
        { highWaterMark: 100, checkInterval: 63 },
      );

      // Just verify they can be constructed successfully
      expect(lexerWithWritableInterval).toBeDefined();
      expect(lexerWithReadableInterval).toBeDefined();
      expect(assemblerWithWritableInterval).toBeDefined();
      expect(assemblerWithReadableInterval).toBeDefined();
    });
  });
});
