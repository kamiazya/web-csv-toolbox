import { describe, expect, it } from "vitest";
import { convertBinaryToString } from "./convertBinaryToString.ts";

describe("function convertBinaryToString", () => {
  it("should convert Uint8Array to string", () => {
    const text = "abc";
    const binary = new TextEncoder().encode(text);
    const result = convertBinaryToString(binary, {});
    expect(result).toBe(text);
  });

  it("should convert ArrayBuffer to string", () => {
    const text = "abc";
    const binary = new TextEncoder().encode(text).buffer;
    const result = convertBinaryToString(binary, {});
    expect(result).toBe(text);
  });
});
