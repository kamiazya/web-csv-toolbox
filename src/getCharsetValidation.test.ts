import { describe, expect, it } from "vitest";
import { getOptionsFromResponse } from "./getOptionsFromResponse.ts";

describe("charset validation in getOptionsFromResponse", () => {
  describe("supported charsets", () => {
    it("should accept utf-8 (default)", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv",
        },
      });

      const options = getOptionsFromResponse(response);
      expect(options.charset).toBe("utf-8");
    });

    it("should accept utf-8 from Content-Type", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset=utf-8",
        },
      });

      const options = getOptionsFromResponse(response);
      expect(options.charset).toBe("utf-8");
    });

    it("should normalize charset to lowercase", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset=UTF-8",
        },
      });

      const options = getOptionsFromResponse(response);
      expect(options.charset).toBe("utf-8");
    });

    it("should accept iso-8859-1", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset=iso-8859-1",
        },
      });

      const options = getOptionsFromResponse(response);
      expect(options.charset).toBe("iso-8859-1");
    });

    it("should accept shift_jis", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset=shift_jis",
        },
      });

      const options = getOptionsFromResponse(response);
      expect(options.charset).toBe("shift_jis");
    });

    it("should accept windows-1252", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset=windows-1252",
        },
      });

      const options = getOptionsFromResponse(response);
      expect(options.charset).toBe("windows-1252");
    });
  });

  describe("unsupported charsets without flag", () => {
    it("should reject malicious charset value", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset=<script>alert(1)</script>",
        },
      });

      expect(() => getOptionsFromResponse(response)).toThrow(TypeError);
      expect(() => getOptionsFromResponse(response)).toThrow(
        /Unsupported charset/,
      );
    });

    it("should reject arbitrary charset value", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset=attacker-controlled",
        },
      });

      expect(() => getOptionsFromResponse(response)).toThrow(TypeError);
      expect(() => getOptionsFromResponse(response)).toThrow(
        /Unsupported charset/,
      );
    });

    it("should reject path-like charset value", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset=../../etc/passwd",
        },
      });

      expect(() => getOptionsFromResponse(response)).toThrow(TypeError);
    });

    it("should accept valid charset even with additional parameters", () => {
      // parseMime splits on ";" first, so this is valid: charset=utf-8, then malicious=value as separate param
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset=utf-8; malicious=value",
        },
      });

      // Should not throw because charset is valid (utf-8)
      const options = getOptionsFromResponse(response);
      expect(options.charset).toBe("utf-8");
    });
  });

  describe("unsupported charsets with allowNonStandardCharsets flag", () => {
    it("should allow non-standard charset with flag", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset=custom-encoding",
        },
      });

      const options = getOptionsFromResponse(response, {
        allowNonStandardCharsets: true,
      });
      expect(options.charset).toBe("custom-encoding");
    });

    it("should allow potentially malicious charset with flag (runtime handles validation)", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset=attacker-controlled",
        },
      });

      const options = getOptionsFromResponse(response, {
        allowNonStandardCharsets: true,
      });
      expect(options.charset).toBe("attacker-controlled");
    });
  });

  describe("edge cases", () => {
    it("should handle missing charset parameter", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset",
        },
      });

      // parseMime will skip parameter without value, so defaults to utf-8
      const options = getOptionsFromResponse(response);
      expect(options.charset).toBe("utf-8");
    });

    it("should handle empty charset value", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset=",
        },
      });

      // Empty charset defaults to utf-8
      const options = getOptionsFromResponse(response);
      expect(options.charset).toBe("utf-8");
    });

    it("should trim whitespace in charset", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset=  UTF-8  ",
        },
      });

      const options = getOptionsFromResponse(response);
      expect(options.charset).toBe("utf-8");
    });
  });

  describe("charset validation error messages", () => {
    it("should provide helpful error message for unsupported charset", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset=invalid-charset",
        },
      });

      expect(() => getOptionsFromResponse(response)).toThrow(
        /Unsupported charset: "invalid-charset"/,
      );
      expect(() => getOptionsFromResponse(response)).toThrow(
        /allowNonStandardCharsets: true/,
      );
    });
  });

  describe("integration with compression validation", () => {
    it("should validate both compression and charset", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-encoding": "gzip",
        },
      });

      const options = getOptionsFromResponse(response);
      expect(options.charset).toBe("utf-8");
      expect(options.decompression).toBe("gzip");
    });

    it("should reject invalid charset even with valid compression", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset=invalid",
          "content-encoding": "gzip",
        },
      });

      expect(() => getOptionsFromResponse(response)).toThrow(TypeError);
      expect(() => getOptionsFromResponse(response)).toThrow(
        /Unsupported charset/,
      );
    });

    it("should allow both experimental compression and non-standard charset with flags", () => {
      const response = new Response("a,b\n1,2", {
        headers: {
          "content-type": "text/csv; charset=custom",
          "content-encoding": "brotli",
        },
      });

      const options = getOptionsFromResponse(response, {
        allowExperimentalCompressions: true,
        allowNonStandardCharsets: true,
      });
      expect(options.charset).toBe("custom");
      expect(options.decompression).toBe("brotli");
    });
  });
});
