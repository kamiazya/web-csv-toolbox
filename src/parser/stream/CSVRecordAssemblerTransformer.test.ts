import { beforeEach, describe as describe_, expect, test } from "vitest";
import { waitAbort } from "@/__tests__/helper.ts";
import { FlexibleStringCSVLexer } from "@/parser/models/createStringCSVLexer.ts";
import { createCSVRecordAssembler } from "@/parser/models/createCSVRecordAssembler.ts";
import { CSVLexerTransformer } from "@/parser/stream/CSVLexerTransformer.ts";
import { CSVRecordAssemblerTransformer } from "@/parser/stream/CSVRecordAssemblerTransformer.ts";

const describe = describe_.concurrent;

async function processCSV(csv: string, signal?: AbortSignal) {
  const results: unknown[] = [];
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(csv);
      controller.close();
    },
  });

  const lexer = new FlexibleStringCSVLexer({ signal });
  const assembler = createCSVRecordAssembler({ signal });
  await stream
    .pipeThrough(new CSVLexerTransformer(lexer))
    .pipeThrough(new CSVRecordAssemblerTransformer(assembler))
    .pipeTo(
      new WritableStream({
        write(record) {
          results.push(record);
        },
      }),
    );

  return results;
}

describe("CSVRecordAssemblerTransformer", () => {
  describe("when AbortSignal is provided", () => {
    let controller: AbortController;

    beforeEach(() => {
      controller = new AbortController();
    });

    test("should throw DOMException named AbortError if the signal is aborted", async () => {
      controller.abort();

      try {
        await processCSV("name,age\nAlice,20\nBob,25", controller.signal);
        expect.fail("Should have thrown AbortError");
      } catch (error) {
        expect(error).toBeInstanceOf(DOMException);
        expect((error as DOMException).name).toBe("AbortError");
      }
    });

    test("should stop processing when aborted during stream", async () => {
      // This test verifies that AbortSignal is properly propagated through the stream pipeline
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("name,age\n");
          controller.enqueue("Alice,20\n");
          controller.enqueue("Bob,25\n");
          controller.close();
        },
      });

      controller.abort();

      try {
        const lexer = new FlexibleStringCSVLexer({ signal: controller.signal });
        const assembler = createCSVRecordAssembler({
          signal: controller.signal,
        });
        await stream
          .pipeThrough(new CSVLexerTransformer(lexer))
          .pipeThrough(new CSVRecordAssemblerTransformer(assembler))
          .pipeTo(new WritableStream());
        expect.fail("Should have thrown AbortError");
      } catch (error) {
        expect(error).toBeInstanceOf(DOMException);
        expect((error as DOMException).name).toBe("AbortError");
      }
    });
  });

  test("should throw DOMException named TimeoutError if the signal is aborted with timeout", async () => {
    const signal = AbortSignal.timeout(0);
    await waitAbort(signal);

    try {
      await processCSV("name,age\nAlice,20\nBob,25", signal);
      expect.fail("Should have thrown TimeoutError");
    } catch (error) {
      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe("TimeoutError");
    }
  });

  describe("queuing strategy", () => {
    test("should use default strategies when not specified", () => {
      const assembler = createCSVRecordAssembler({});
      const transformer = new CSVRecordAssemblerTransformer(assembler);
      // TransformStream has writable and readable properties
      expect(transformer.writable).toBeDefined();
      expect(transformer.readable).toBeDefined();
    });

    test("should accept custom writable strategy", async () => {
      const customStrategy = { highWaterMark: 64 };
      const results: unknown[] = [];
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("name,age\nAlice,20\nBob,25");
          controller.close();
        },
      });

      const lexer = new FlexibleStringCSVLexer({});
      const assembler = createCSVRecordAssembler({});
      await stream
        .pipeThrough(new CSVLexerTransformer(lexer))
        .pipeThrough(
          new CSVRecordAssemblerTransformer(assembler, {}, customStrategy),
        )
        .pipeTo(
          new WritableStream({
            write(record) {
              results.push(record);
            },
          }),
        );

      expect(results.length).toBe(2);
    });

    test("should accept custom readable strategy", async () => {
      const customStrategy = { highWaterMark: 2 };
      const results: unknown[] = [];
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("name,age\nAlice,20\nBob,25");
          controller.close();
        },
      });

      const lexer = new FlexibleStringCSVLexer({});
      const assembler = createCSVRecordAssembler({});
      await stream
        .pipeThrough(new CSVLexerTransformer(lexer))
        .pipeThrough(
          new CSVRecordAssemblerTransformer(
            assembler,
            undefined,
            customStrategy,
          ),
        )
        .pipeTo(
          new WritableStream({
            write(record) {
              results.push(record);
            },
          }),
        );

      expect(results.length).toBe(2);
    });

    test("should accept both custom strategies", async () => {
      const results: unknown[] = [];
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue("name,age\nAlice,20\nBob,25");
          controller.close();
        },
      });

      const lexer = new FlexibleStringCSVLexer({});
      const assembler = createCSVRecordAssembler({});
      await stream
        .pipeThrough(new CSVLexerTransformer(lexer))
        .pipeThrough(
          new CSVRecordAssemblerTransformer(
            assembler,
            {},
            { highWaterMark: 32 },
            { highWaterMark: 4 },
          ),
        )
        .pipeTo(
          new WritableStream({
            write(record) {
              results.push(record);
            },
          }),
        );

      expect(results.length).toBe(2);
    });
  });
});
