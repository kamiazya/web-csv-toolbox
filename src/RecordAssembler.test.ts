import { assert, beforeEach, describe, expect, test } from "vitest";
import { Field } from "./common/constants";
import { RecordAssembler } from "./RecordAssembler.js";

describe("RecordAssembler", () => {
  describe("constructor validation", () => {
    test("should throw RangeError if maxFieldCount is negative", () => {
      expect(() => new RecordAssembler({ maxFieldCount: -1 })).toThrow(
        RangeError,
      );
    });

    test("should throw RangeError if maxFieldCount is zero", () => {
      expect(() => new RecordAssembler({ maxFieldCount: 0 })).toThrow(
        RangeError,
      );
    });

    test("should throw RangeError if maxFieldCount is not an integer", () => {
      expect(() => new RecordAssembler({ maxFieldCount: 1.5 })).toThrow(
        RangeError,
      );
    });

    test("should throw RangeError if maxFieldCount is NaN", () => {
      expect(() => new RecordAssembler({ maxFieldCount: Number.NaN })).toThrow(
        RangeError,
      );
    });

    test("should accept Number.POSITIVE_INFINITY as maxFieldCount", () => {
      expect(
        () => new RecordAssembler({ maxFieldCount: Number.POSITIVE_INFINITY }),
      ).not.toThrow();
    });
  });

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
