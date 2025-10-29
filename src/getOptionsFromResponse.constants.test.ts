import { describe, expect, it } from "vitest";

/**
 * Test environment-specific compression support constants.
 *
 * These tests verify that the SUPPORTED_COMPRESSIONS constant
 * is correctly configured for different runtime environments.
 */
describe("SUPPORTED_COMPRESSIONS environment-specific constants", () => {
  it("should export SUPPORTED_COMPRESSIONS", async () => {
    // Import the constant (will use environment-specific version)
    const { SUPPORTED_COMPRESSIONS } = await import(
      "#getOptionsFromResponse.constants.js"
    );

    expect(SUPPORTED_COMPRESSIONS).toBeDefined();
    expect(SUPPORTED_COMPRESSIONS).toBeInstanceOf(Set);
  });

  it("should support gzip in all environments", async () => {
    const { SUPPORTED_COMPRESSIONS } = await import(
      "#getOptionsFromResponse.constants.js"
    );

    expect(SUPPORTED_COMPRESSIONS.has("gzip")).toBe(true);
  });

  it("should support deflate in all environments", async () => {
    const { SUPPORTED_COMPRESSIONS } = await import(
      "#getOptionsFromResponse.constants.js"
    );

    expect(SUPPORTED_COMPRESSIONS.has("deflate")).toBe(true);
  });

  it("should have appropriate size for the environment", async () => {
    const { SUPPORTED_COMPRESSIONS } = await import(
      "#getOptionsFromResponse.constants.js"
    );

    // In Node.js: 2 formats (gzip, deflate)
    // In Browser: 3 formats (gzip, deflate, deflate-raw)
    expect(SUPPORTED_COMPRESSIONS.size).toBeGreaterThanOrEqual(2);
    expect(SUPPORTED_COMPRESSIONS.size).toBeLessThanOrEqual(3);
  });
});

/**
 * Integration test with getOptionsFromResponse
 */
describe("getOptionsFromResponse with environment-specific compressions", () => {
  it("should accept supported compression formats", async () => {
    const { getOptionsFromResponse } = await import(
      "./getOptionsFromResponse.ts"
    );
    const { SUPPORTED_COMPRESSIONS } = await import(
      "#getOptionsFromResponse.constants.js"
    );

    for (const format of SUPPORTED_COMPRESSIONS) {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv",
          "content-encoding": format,
        },
      });

      const options = getOptionsFromResponse(response);
      expect(options.decompression).toBe(format);
    }
  });

  it("should allow unsupported compression with allowExperimentalCompressions flag", async () => {
    const { getOptionsFromResponse } = await import(
      "./getOptionsFromResponse.ts"
    );

    const response = new Response("a,b\n1,2", {
      headers: {
        "content-type": "text/csv",
        "content-encoding": "brotli", // Not in SUPPORTED_COMPRESSIONS
      },
    });

    const options = getOptionsFromResponse(response, {
      allowExperimentalCompressions: true,
    });

    expect(options.decompression).toBe("brotli");
  });
});
