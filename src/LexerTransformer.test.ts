import { describe, expect } from "vitest";
import { test, fc } from "@fast-check/vitest";
import { LexerTransformer } from './LexerTransformer';
import { Field } from "./common/constants";

describe("LexerTransformer", () => {
  async function transform(transformer: LexerTransformer, s: string): Promise<any[]> {
    const result: any[] = [];
    await new ReadableStream({
      start(controller) {
        controller.enqueue(s);
        controller.close();
      },
    })
      .pipeThrough(transformer)
      .pipeTo(
        new WritableStream({
          write(chunk) {
            result.push(chunk);
          },
        })
      );
    return result;
  }

  describe("Property Based Testing", () => {
    test("Field", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string().filter((s) => /[\",]/gi.test(s) === false && s !== ""),
          async (s) => {
            const result = await transform(new LexerTransformer(), s);
            expect(result).toStrictEqual([
              {
                type: Field,
                value: s,
              },
            ]);
          }
        )
      );
    });
  });
});
