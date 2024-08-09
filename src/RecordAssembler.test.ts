import { beforeEach, describe, expect, test } from "vitest";
import { RecordAssembler } from "./RecordAssembler.js";
import { Field } from "./common/constants";

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

      expect(() => [
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
      ]).toThrow(DOMException);

      expect(() => [
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
      ]).toThrowErrorMatchingInlineSnapshot(
        // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
        `[AbortError: This operation was aborted]`,
      );
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
});
