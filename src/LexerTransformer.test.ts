import { describe as describe_, expect, it as it_ } from "vitest";
import { LexerTransformer } from "./LexerTransformer.ts";
import { transform } from "./__tests__/helper.ts";

const describe = describe_.concurrent;
const it = it_.concurrent;

describe("LexerTransformer", () => {
  it("should throw an error if options is invalid", async () => {
    expect(
      () =>
        new LexerTransformer({
          delimiter: "",
        }),
    ).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[InvalidOptionError: delimiter must not be empty]`,
    );

    expect(
      () =>
        new LexerTransformer({
          quotation: "",
        }),
    ).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[InvalidOptionError: quotation must not be empty]`,
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
});
