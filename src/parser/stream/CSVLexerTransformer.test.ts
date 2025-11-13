import {
  beforeEach,
  describe as describe_,
  expect,
  it as it_,
  test,
  vi,
} from "vitest";
import { transform, waitAbort } from "../../__tests__/helper.ts";
import { DefaultCSVLexer } from "../models/DefaultCSVLexer.ts";
import { CSVLexerTransformer } from "./CSVLexerTransformer.ts";

const describe = describe_.concurrent;
const it = it_.concurrent;

describe("CSVLexerTransformer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  it("should throw an error if options is invalid", async () => {
    expect(
      () =>
        new DefaultCSVLexer({
          delimiter: "",
        }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: delimiter must not be empty]`,
    );

    expect(
      () =>
        new DefaultCSVLexer({
          quotation: "",
        }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: quotation must not be empty]`,
    );
  });

  it("should throw an error if the input is invalid", async () => {
    const lexer = new DefaultCSVLexer({});
    const transformer = new CSVLexerTransformer(lexer);
    await expect(async () => {
      await transform(transformer, ['"']);
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[ParseError: Unexpected EOF while parsing quoted field.]`,
    );
  });

  it("should throw an error if the input is invalid", async () => {
    const lexer = new DefaultCSVLexer({});
    const transformer = new CSVLexerTransformer(lexer);
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
      const lexer = new DefaultCSVLexer({
        signal: controller.signal,
      });
      const transformer = new CSVLexerTransformer(lexer);
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
      const lexer = new DefaultCSVLexer({
        signal: controller.signal,
      });
      const transformer = new CSVLexerTransformer(lexer);
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
    const lexer = new DefaultCSVLexer({ signal });
    const transformer = new CSVLexerTransformer(lexer);

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
      const lexer = new DefaultCSVLexer({});
      const transformer = new CSVLexerTransformer(lexer);
      // TransformStream has writable and readable properties
      expect(transformer.writable).toBeDefined();
      expect(transformer.readable).toBeDefined();
    });

    it("should accept custom writable strategy", async () => {
      const lexer = new DefaultCSVLexer({});
      const customStrategy = { highWaterMark: 32 };
      const transformer = new CSVLexerTransformer(lexer, customStrategy);
      expect(transformer.writable).toBeDefined();

      // Verify it works with actual data
      const result = await transform(transformer, ["name,age\n", "Alice,20\n"]);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should accept custom readable strategy", async () => {
      const lexer = new DefaultCSVLexer({});
      const customStrategy = { highWaterMark: 64 };
      const transformer = new CSVLexerTransformer(
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
      const lexer = new DefaultCSVLexer({});
      const transformer = new CSVLexerTransformer(
        lexer,
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
