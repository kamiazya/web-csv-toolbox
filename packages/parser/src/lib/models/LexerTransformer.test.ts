import {
  beforeEach,
  describe as describe_,
  expect,
  it as it_,
  vi,
} from "vitest";

import { transform } from "#/tests/utils/helper";

import { LexerTransformer } from "./LexerTransformer.ts";

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
});
