import { describe, expect, it } from "vitest";
import { convertBinaryToString } from "./convertBinaryToString.ts";

describe("function convertBinaryToString", () => {
  it("should convert Uint8Array to string", () => {
    const text = "abc";
    const binary = new TextEncoder().encode(text);
    const result = convertBinaryToString(binary);
    expect(result).toBe(text);
  });

  it("should convert ArrayBuffer to string", () => {
    const text = "abc";
    const binary = new TextEncoder().encode(text).buffer;
    const result = convertBinaryToString(binary);
    expect(result).toBe(text);
  });

  it("should convert Uint8Array with BOM to string(ignore BOM by default)", () => {
    const text = "abc";
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const binary = new TextEncoder().encode(text);
    const result = convertBinaryToString(new Uint8Array([...bom, ...binary]));
    expect(result).toBe(text);
  });

  it("should convert ArrayBuffer with BOM to string(ignore BOM by default)", () => {
    const text = "abc";
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const binary = new TextEncoder().encode(text).buffer;
    const result = convertBinaryToString(
      new Uint8Array([...bom, ...new Uint8Array(binary)]),
    );
    expect(result).toBe(text);
  });
});
