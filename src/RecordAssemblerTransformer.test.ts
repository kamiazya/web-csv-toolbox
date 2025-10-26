import {
  beforeEach,
  describe as describe_,
  expect,
  test,
} from "vitest";
import { RecordAssemblerTransformer } from "./RecordAssemblerTransformer.ts";
import { LexerTransformer } from "./LexerTransformer.ts";

const describe = describe_.concurrent;

async function processCSV(csv: string, signal?: AbortSignal) {
  const results: unknown[] = [];
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(csv);
      controller.close();
    },
  });

  await stream
    .pipeThrough(new LexerTransformer({ signal }))
    .pipeThrough(new RecordAssemblerTransformer({ signal }))
    .pipeTo(
      new WritableStream({
        write(record) {
          results.push(record);
        },
      }),
    );

  return results;
}

describe("RecordAssemblerTransformer", () => {
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
        await stream
          .pipeThrough(new LexerTransformer({ signal: controller.signal }))
          .pipeThrough(new RecordAssemblerTransformer({ signal: controller.signal }))
          .pipeTo(new WritableStream());
        expect.fail("Should have thrown AbortError");
      } catch (error) {
        expect(error).toBeInstanceOf(DOMException);
        expect((error as DOMException).name).toBe("AbortError");
      }
    });
  });

  test("should throw DOMException named TimeoutError if the signal is aborted with timeout", async () => {
    function waitAbort(signal: AbortSignal) {
      return new Promise<void>((resolve) => {
        signal.addEventListener("abort", () => {
          resolve();
        });
      });
    }
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
});
