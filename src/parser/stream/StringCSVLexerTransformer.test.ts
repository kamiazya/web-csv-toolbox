import {
  beforeEach,
  describe as describe_,
  expect,
  it as it_,
  test,
  vi,
} from "vitest";
import { transform, waitAbort } from "@/__tests__/helper.ts";
import { FlexibleStringCSVLexer } from "@/parser/api/model/createStringCSVLexer.ts";
import { StringCSVLexerTransformer } from "@/parser/stream/StringCSVLexerTransformer.ts";

const describe = describe_.concurrent;
const it = it_.concurrent;

describe("StringCSVLexerTransformer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it("should throw an error if options is invalid", async () => {
    expect(
      () =>
        new FlexibleStringCSVLexer({
          delimiter: "",
        }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: delimiter must not be empty]`,
    );

    expect(
      () =>
        new FlexibleStringCSVLexer({
          quotation: "",
        }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: quotation must not be empty]`,
    );
  });

  it("should throw an error if the input is invalid", async () => {
    const lexer = new FlexibleStringCSVLexer({});
    const transformer = new StringCSVLexerTransformer(lexer);
    await expect(async () => {
      await transform(transformer, ['"']);
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[ParseError: Unexpected EOF while parsing quoted field.]`,
    );
  });

  it("should throw an error if the input is invalid", async () => {
    const lexer = new FlexibleStringCSVLexer({});
    const transformer = new StringCSVLexerTransformer(lexer);
    vi.spyOn(transformer.lexer, "lex").mockImplementationOnce(() => {
      throw new Error("test");
    });
    await expect(async () => {
      await transform(transformer, ["aaa"]);
    }).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: test]`);
  });

  describe("when AbortSignal is provided", () => {
    let controller: AbortController;

    beforeEach(() => {
      controller = new AbortController();
    });

    test("should throw DOMException named AbortError if the signal is aborted", async () => {
      const lexer = new FlexibleStringCSVLexer({
        signal: controller.signal,
      });
      const transformer = new StringCSVLexerTransformer(lexer);
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
      const lexer = new FlexibleStringCSVLexer({
        signal: controller.signal,
      });
      const transformer = new StringCSVLexerTransformer(lexer);
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
    const signal = AbortSignal.timeout(0);
    await waitAbort(signal);
    const lexer = new FlexibleStringCSVLexer({ signal });
    const transformer = new StringCSVLexerTransformer(lexer);

    try {
      await transform(transformer, ["field1,field2\nvalue1,value2"]);
      expect.fail("Should have thrown TimeoutError");
    } catch (error) {
      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe("TimeoutError");
    }
  });

  describe("queuing strategy", () => {
    it("should use default strategies when not specified", () => {
      const lexer = new FlexibleStringCSVLexer({});
      const transformer = new StringCSVLexerTransformer(lexer);
      // TransformStream has writable and readable properties
      expect(transformer.writable).toBeDefined();
      expect(transformer.readable).toBeDefined();
    });

    it("should accept custom writable strategy", async () => {
      const lexer = new FlexibleStringCSVLexer({});
      const customStrategy = { highWaterMark: 32 };
      const transformer = new StringCSVLexerTransformer(
        lexer,
        {},
        customStrategy,
      );
      expect(transformer.writable).toBeDefined();

      // Verify it works with actual data
      const result = await transform(transformer, ["name,age\n", "Alice,20\n"]);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should accept custom readable strategy", async () => {
      const lexer = new FlexibleStringCSVLexer({});
      const customStrategy = { highWaterMark: 64 };
      const transformer = new StringCSVLexerTransformer(
        lexer,
        undefined,
        customStrategy,
      );
      expect(transformer.readable).toBeDefined();

      // Verify it works with actual data
      const result = await transform(transformer, ["name,age\n", "Alice,20\n"]);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should accept both custom strategies", async () => {
      const lexer = new FlexibleStringCSVLexer({});
      const transformer = new StringCSVLexerTransformer(
        lexer,
        {},
        { highWaterMark: 4 },
        { highWaterMark: 2 },
      );
      expect(transformer.writable).toBeDefined();
      expect(transformer.readable).toBeDefined();

      // Verify it works with actual data
      const result = await transform(transformer, ["name,age\n", "Alice,20\n"]);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
