import { describe, expect, it } from "vitest";
import { convertBinaryToString } from "./convertBinaryToString.ts";

describe("function convertBinaryToString", () => {
  const text = "abc";
  const binary = new TextEncoder().encode(text);

  it("should convert Uint8Array to string", () => {
    const result = convertBinaryToString(binary, {});
    expect(result).toBe(text);
  });

  it("should convert ArrayBuffer to string", () => {
    const result = convertBinaryToString(binary, {});
    expect(result).toBe(text);
  });

  it("should throw error if invalid charset", () => {
    expect(() =>
      convertBinaryToString(binary, { charset: "invalid" }),
    ).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: The "invalid" encoding is not supported]`,
    );
  });

  it("should remove BOM by default(ignoreBOM is false)", () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const result = convertBinaryToString(
      new Uint8Array([...bom, ...binary]),
      {},
    );
    expect(result).toBe(text);
  });

  it("should ignore BOM if ignoreBOM is true", () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const result = convertBinaryToString(new Uint8Array([...bom, ...binary]), {
      ignoreBOM: true,
    });
    expect(result).toBe(`${String.fromCharCode(0xfeff)}${text}`);
  });

  it("should throw error if fatal is true", () => {
    const invalidBinary = new Uint8Array([0x80]);
    expect(() =>
      convertBinaryToString(invalidBinary, { fatal: true }),
    ).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[TypeError: The encoded data was not valid for encoding utf-8]`,
    );
  });

  it("should replace invalid data with U+FFFD by default(if fatal is false)", () => {
    const invalidBinary = new Uint8Array([0x80]);
    const result = convertBinaryToString(invalidBinary, {});
    expect(result).toBe("�");
  });
});
