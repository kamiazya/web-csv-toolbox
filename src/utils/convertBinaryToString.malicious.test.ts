import { describe, expect, it } from "vitest";
import { convertBinaryToString } from "./convertBinaryToString.ts";

describe("convertBinaryToString security tests", () => {
  const sampleBinary = new Uint8Array([0x61, 0x62, 0x63]); // "abc"

  describe("invalid charset handling", () => {
    it("should throw RangeError for invalid charset", () => {
      expect(() =>
        convertBinaryToString(sampleBinary, {
          charset: "invalid-charset-12345",
        }),
      ).toThrow(RangeError);
    });

    it("should throw RangeError for malicious charset", () => {
      expect(() =>
        convertBinaryToString(sampleBinary, {
          charset: "<script>alert(1)</script>",
        }),
      ).toThrow(RangeError);
    });

    it("should throw RangeError for path-like charset", () => {
      expect(() =>
        convertBinaryToString(sampleBinary, {
          charset: "../../etc/passwd",
        }),
      ).toThrow(RangeError);
    });

    it("should provide helpful error message for invalid charset", () => {
      try {
        convertBinaryToString(sampleBinary, {
          charset: "attacker-controlled",
        });
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
        expect((error as Error).message).toContain("Invalid or unsupported charset");
        expect((error as Error).message).toContain("attacker-controlled");
      }
    });
  });

  describe("valid charset handling", () => {
    it("should work with utf-8", () => {
      const result = convertBinaryToString(sampleBinary, {
        charset: "utf-8",
      });
      expect(result).toBe("abc");
    });

    it("should work with utf8 (alias)", () => {
      const result = convertBinaryToString(sampleBinary, {
        charset: "utf8",
      });
      expect(result).toBe("abc");
    });

    it("should work with ASCII", () => {
      const result = convertBinaryToString(sampleBinary, {
        charset: "ascii",
      });
      expect(result).toBe("abc");
    });

    it("should work without charset option (defaults to utf-8)", () => {
      const result = convertBinaryToString(sampleBinary, {});
      expect(result).toBe("abc");
    });
  });

  describe("charset case sensitivity", () => {
    it("should work with uppercase charset", () => {
      const result = convertBinaryToString(sampleBinary, {
        charset: "UTF-8",
      });
      expect(result).toBe("abc");
    });

    it("should work with mixed case charset", () => {
      const result = convertBinaryToString(sampleBinary, {
        charset: "Utf-8",
      });
      expect(result).toBe("abc");
    });
  });

  describe("ArrayBuffer input", () => {
    it("should handle ArrayBuffer with invalid charset", () => {
      const buffer = new ArrayBuffer(3);
      const view = new Uint8Array(buffer);
      view.set([0x61, 0x62, 0x63]);

      expect(() =>
        convertBinaryToString(buffer, {
          charset: "invalid-charset",
        }),
      ).toThrow(RangeError);
    });

    it("should handle ArrayBuffer with valid charset", () => {
      const buffer = new ArrayBuffer(3);
      const view = new Uint8Array(buffer);
      view.set([0x61, 0x62, 0x63]);

      const result = convertBinaryToString(buffer, {
        charset: "utf-8",
      });
      expect(result).toBe("abc");
    });
  });

  describe("maxBinarySize with invalid charset", () => {
    it("should check charset before size validation", () => {
      const largeBinary = new Uint8Array(1000);

      // Even with valid size, invalid charset should throw
      expect(() =>
        convertBinaryToString(largeBinary, {
          charset: "invalid-charset",
          maxBinarySize: 2000,
        }),
      ).toThrow(RangeError);
    });
  });

  describe("fatal option with invalid charset", () => {
    it("should throw error for invalid charset regardless of fatal option", () => {
      expect(() =>
        convertBinaryToString(sampleBinary, {
          charset: "invalid-charset",
          fatal: true,
        }),
      ).toThrow(RangeError);

      expect(() =>
        convertBinaryToString(sampleBinary, {
          charset: "invalid-charset",
          fatal: false,
        }),
      ).toThrow(RangeError);
    });
  });
});
