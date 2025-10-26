import {
  beforeEach,
  describe as describe_,
  expect,
  it as it_,
  test,
  vi,
} from "vitest";
import { LexerTransformer } from "./LexerTransformer.ts";
import { transform } from "./__tests__/helper.ts";

const describe = describe_.concurrent;
const it = it_.concurrent;

describe("LexerTransformer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it("should throw an error if options is invalid", async () => {
    expect(
      () =>
        new LexerTransformer({
          delimiter: "",
        }),
    ).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[RangeError: delimiter must not be empty]`,
    );

    expect(
      () =>
        new LexerTransformer({
          quotation: "",
        }),
    ).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[RangeError: quotation must not be empty]`,
    );
  });

  it("should throw an error if the input is invalid", async () => {
    const transformer = new LexerTransformer();
    expect(async () => {
      await transform(transformer, ['"']);
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[ParseError: Unexpected EOF while parsing quoted field.]`,
    );
  });

  it("should throw an error if the input is invalid", async () => {
    const transformer = new LexerTransformer();
    vi.spyOn(transformer.lexer, "lex").mockImplementationOnce(() => {
      throw new Error("test");
    });
    expect(async () => {
      await transform(transformer, ["aaa"]);
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[Error: test]`,
    );
  });

  describe("when AbortSignal is provided", () => {
    let controller: AbortController;

    beforeEach(() => {
      controller = new AbortController();
    });

    test("should throw DOMException named AbortError if the signal is aborted", async () => {
      const transformer = new LexerTransformer({ signal: controller.signal });
      controller.abort();

      try {
        await transform(transformer, ["field1,field2\nvalue1,value2"]);
        expect.fail("Should have thrown AbortError");
      } catch (error) {
        expect(error).toBeInstanceOf(DOMException);
        expect((error as DOMException).name).toBe("AbortError");
      }
    });

    test("should throw custom error if the signal is aborted with custom reason", async () => {
      class MyCustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "MyCustomError";
        }
      }
      const transformer = new LexerTransformer({ signal: controller.signal });
      controller.abort(new MyCustomError("Custom abort reason"));

      try {
        await transform(transformer, ["field1,field2\nvalue1,value2"]);
        expect.fail("Should have thrown MyCustomError");
      } catch (error) {
        expect(error).toBeInstanceOf(MyCustomError);
        expect((error as MyCustomError).message).toBe("Custom abort reason");
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
    const transformer = new LexerTransformer({ signal });

    try {
      await transform(transformer, ["field1,field2\nvalue1,value2"]);
      expect.fail("Should have thrown TimeoutError");
    } catch (error) {
      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe("TimeoutError");
    }
  });
});
