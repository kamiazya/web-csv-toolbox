import { describe, expect, it } from "vitest";

/**
 * Browser-specific tests for SUPPORTED_COMPRESSIONS
 */
describe("SUPPORTED_COMPRESSIONS in browser", () => {
  it("should verify actual DecompressionStream support for standard formats", () => {
    // Test browser support for standard compression formats
    const actualSupport = {
      gzip: false,
      deflate: false,
    };

    // Try each format to see if DecompressionStream accepts it
    for (const format of ["gzip", "deflate"] as const) {
      try {
        new DecompressionStream(format);
        actualSupport[format] = true;
      } catch {
        actualSupport[format] = false;
      }
    }

    console.log(
      "Browser DecompressionStream support (standard formats):",
      actualSupport,
    );

    // Standard formats should be supported in all modern browsers
    expect(actualSupport.gzip).toBe(true);
    expect(actualSupport.deflate).toBe(true);
  });

  it("should verify experimental format support (deflate-raw)", () => {
    // deflate-raw is experimental and may not be supported in all browsers
    let deflateRawSupported = false;
    try {
      new DecompressionStream("deflate-raw");
      deflateRawSupported = true;
    } catch {
      deflateRawSupported = false;
    }

    console.log(
      "Browser deflate-raw support (experimental):",
      deflateRawSupported,
    );

    // This test documents the behavior but doesn't enforce it
    // Chrome/Edge support it, but Firefox/Safari may not
    if (deflateRawSupported) {
      console.log("✓ This browser supports deflate-raw (experimental)");
    } else {
      console.log("✗ This browser does not support deflate-raw");
    }
  });

  it("should only include standard compression formats by default", async () => {
    const { SUPPORTED_COMPRESSIONS } = await import(
      "#/utils/response/getOptionsFromResponse.constants.js"
    );

    // Only gzip and deflate should be included by default for cross-browser compatibility
    expect(SUPPORTED_COMPRESSIONS.size).toBe(2);
    expect(Array.from(SUPPORTED_COMPRESSIONS).sort()).toEqual([
      "deflate",
      "gzip",
    ]);
  });

  it("should match SUPPORTED_COMPRESSIONS with actual browser support", async () => {
    const { SUPPORTED_COMPRESSIONS } = await import(
      "#/utils/response/getOptionsFromResponse.constants.js"
    );

    // Test that each format in SUPPORTED_COMPRESSIONS actually works
    for (const format of SUPPORTED_COMPRESSIONS) {
      expect(() => new DecompressionStream(format)).not.toThrow();
    }
  });
});
