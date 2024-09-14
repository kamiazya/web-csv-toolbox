import { assert, beforeEach, describe, expect, test } from "vitest";

import { Field } from "@web-csv-toolbox/common";
import { RecordAssembler } from "@web-csv-toolbox/parser";

describe("RecordAssembler", () => {
  describe("when AbortSignal is provided", () => {
    let assembler: RecordAssembler<readonly string[]>;
    let controller: AbortController;

    beforeEach(() => {
      controller = new AbortController();
      assembler = new RecordAssembler({
        signal: controller.signal,
      });
    });
    test("should throw DOMException named AbortError if the signal is aborted", () => {
      controller.abort();
      try {
        [
          ...assembler.assemble([
            {
              type: Field,
              value: "",
              location: {
                start: { line: 1, column: 1, offset: 0 },
                end: { line: 1, column: 1, offset: 0 },
                rowNumber: 1,
              },
            },
          ]),
        ];
        expect.unreachable();
      } catch (error) {
        assert(error instanceof DOMException);
        expect(error.name).toBe("AbortError");
      }
    });

    test("should throw custom error if the signal is aborted with custom reason", () => {
      class MyCustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "MyCustomError";
        }
      }

      controller.abort(new MyCustomError("Custom reason"));

      expect(() => {
        [
          ...assembler.assemble([
            {
              type: Field,
              value: "",
              location: {
                start: { line: 1, column: 1, offset: 0 },
                end: { line: 1, column: 1, offset: 0 },
                rowNumber: 1,
              },
            },
          ]),
        ];
      }).toThrowErrorMatchingInlineSnapshot(
        // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
        `[MyCustomError: Custom reason]`,
      );
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
    const assembler = new RecordAssembler({ signal });
    try {
      [
        ...assembler.assemble([
          {
            type: Field,
            value: "",
            location: {
              start: { line: 1, column: 1, offset: 0 },
              end: { line: 1, column: 1, offset: 0 },
              rowNumber: 1,
            },
          },
        ]),
      ];
      expect.unreachable();
    } catch (error) {
      assert(error instanceof DOMException);
      expect(error.name).toBe("TimeoutError");
    }
  });
});
