import { describe, expect, it } from "vitest";

/**
 * Test environment-specific charset support constants.
 */
describe("SUPPORTED_CHARSETS environment-specific constants", () => {
  it("should export SUPPORTED_CHARSETS", async () => {
    const { SUPPORTED_CHARSETS } = await import(
      "#/utils/charset/getCharsetValidation.constants.js"
    );

    expect(SUPPORTED_CHARSETS).toBeDefined();
    expect(SUPPORTED_CHARSETS).toBeInstanceOf(Set);
  });

  it("should support utf-8 in all environments", async () => {
    const { SUPPORTED_CHARSETS } = await import(
      "#/utils/charset/getCharsetValidation.constants.js"
    );

    expect(SUPPORTED_CHARSETS.has("utf-8")).toBe(true);
  });

  it("should support utf8 alias in all environments", async () => {
    const { SUPPORTED_CHARSETS } = await import(
      "#/utils/charset/getCharsetValidation.constants.js"
    );

    expect(SUPPORTED_CHARSETS.has("utf8")).toBe(true);
  });

  it("should support common Western European encodings", async () => {
    const { SUPPORTED_CHARSETS } = await import(
      "#/utils/charset/getCharsetValidation.constants.js"
    );

    expect(SUPPORTED_CHARSETS.has("iso-8859-1")).toBe(true);
    expect(SUPPORTED_CHARSETS.has("windows-1252")).toBe(true);
  });

  it("should support common Asian encodings", async () => {
    const { SUPPORTED_CHARSETS } = await import(
      "#/utils/charset/getCharsetValidation.constants.js"
    );

    // Japanese
    expect(SUPPORTED_CHARSETS.has("shift_jis")).toBe(true);
    expect(SUPPORTED_CHARSETS.has("euc-jp")).toBe(true);

    // Chinese
    expect(SUPPORTED_CHARSETS.has("gb18030")).toBe(true);
    expect(SUPPORTED_CHARSETS.has("gbk")).toBe(true);

    // Korean
    expect(SUPPORTED_CHARSETS.has("euc-kr")).toBe(true);
  });

  it("should have reasonable size for common charsets", async () => {
    const { SUPPORTED_CHARSETS } = await import(
      "#/utils/charset/getCharsetValidation.constants.js"
    );

    // Should have at least the major charsets
    expect(SUPPORTED_CHARSETS.size).toBeGreaterThanOrEqual(30);
  });

  it("should not include obviously invalid charsets", async () => {
    const { SUPPORTED_CHARSETS } = await import(
      "#/utils/charset/getCharsetValidation.constants.js"
    );

    expect(SUPPORTED_CHARSETS.has("invalid-charset")).toBe(false);
    expect(SUPPORTED_CHARSETS.has("<script>")).toBe(false);
    expect(SUPPORTED_CHARSETS.has("../../etc/passwd")).toBe(false);
    expect(SUPPORTED_CHARSETS.has("")).toBe(false);
  });

  it("should be case-insensitive (all lowercase)", async () => {
    const { SUPPORTED_CHARSETS } = await import(
      "#/utils/charset/getCharsetValidation.constants.js"
    );

    // All entries should be lowercase
    for (const charset of SUPPORTED_CHARSETS) {
      expect(charset).toBe(charset.toLowerCase());
    }
  });
});
