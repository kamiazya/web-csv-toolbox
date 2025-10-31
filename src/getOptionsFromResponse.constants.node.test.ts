import { describe, expect, it } from "vitest";

/**
 * Node.js-specific tests for SUPPORTED_COMPRESSIONS
 */
describe("SUPPORTED_COMPRESSIONS in Node.js", () => {
  it("should support only gzip and deflate in Node.js", async () => {
    const { SUPPORTED_COMPRESSIONS } = await import(
      "#getOptionsFromResponse.constants.js"
    );

    expect(SUPPORTED_COMPRESSIONS.size).toBe(2);
    expect(Array.from(SUPPORTED_COMPRESSIONS).sort()).toEqual([
      "deflate",
      "gzip",
    ]);
  });

  it("should not support deflate-raw in Node.js", async () => {
    const { SUPPORTED_COMPRESSIONS } = await import(
      "#getOptionsFromResponse.constants.js"
    );

    expect(SUPPORTED_COMPRESSIONS.has("deflate-raw")).toBe(false);
  });

  it("should reject unsupported compression in Node.js", async () => {
    const { getOptionsFromResponse } = await import(
      "./getOptionsFromResponse.ts"
    );

    const response = new Response("a,b\n1,2", {
      headers: {
        "content-type": "text/csv",
        "content-encoding": "deflate-raw",
      },
    });

    expect(() => {
      getOptionsFromResponse(response);
    }).toThrow(/Unsupported content-encoding/);
  });
});
