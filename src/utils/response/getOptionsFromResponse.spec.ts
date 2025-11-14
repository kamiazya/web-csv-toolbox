import { describe, expect, it } from "vitest";
import { getOptionsFromResponse } from "@/utils/response/getOptionsFromResponse.ts";

describe("getOptionsFromResponse", () => {
  it("should return options", () => {
    const actual = getOptionsFromResponse(
      new Response("", {
        headers: {
          "content-type": "text/csv",
        },
      }),
    );
    expect(actual).toEqual({
      charset: "utf-8",
    });
  });

  it("should return options with custom charset", () => {
    const actual = getOptionsFromResponse(
      new Response("", {
        headers: {
          "content-type": "text/csv; charset=utf-16",
        },
      }),
    );
    expect(actual).toEqual({
      charset: "utf-16",
    });
  });

  it("should return options with custom charset and decompression", () => {
    const actual = getOptionsFromResponse(
      new Response("", {
        headers: {
          "content-type": "text/csv; charset=utf-16",
          "content-encoding": "gzip",
        },
      }),
    );
    expect(actual).toEqual({
      charset: "utf-16",
      decompression: "gzip",
    });
  });

  it("should throw error if invalid mime type", () => {
    expect(() =>
      getOptionsFromResponse(
        new Response("", {
          headers: {
            "content-type": "application/json",
          },
        }),
      ),
    ).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: Invalid mime type: "application/json"]`,
    );
  });

  describe("Content-Encoding validation", () => {
    it("should accept 'gzip' compression format", () => {
      const actual = getOptionsFromResponse(
        new Response("", {
          headers: {
            "content-type": "text/csv",
            "content-encoding": "gzip",
          },
        }),
      );
      expect(actual).toEqual({
        charset: "utf-8",
        decompression: "gzip",
      });
    });

    it("should accept 'deflate' compression format", () => {
      const actual = getOptionsFromResponse(
        new Response("", {
          headers: {
            "content-type": "text/csv",
            "content-encoding": "deflate",
          },
        }),
      );
      expect(actual).toEqual({
        charset: "utf-8",
        decompression: "deflate",
      });
    });

    it("should reject 'deflate-raw' without experimental flag (browser default)", () => {
      expect(() =>
        getOptionsFromResponse(
          new Response("", {
            headers: {
              "content-type": "text/csv",
              "content-encoding": "deflate-raw",
            },
          }),
        ),
      ).toThrowErrorMatchingInlineSnapshot(
        `[TypeError: Unsupported content-encoding: "deflate-raw". Supported formats: gzip, deflate. To use experimental formats, set allowExperimentalCompressions: true]`,
      );
    });

    it("should accept 'deflate-raw' with experimental flag", () => {
      const actual = getOptionsFromResponse(
        new Response("", {
          headers: {
            "content-type": "text/csv",
            "content-encoding": "deflate-raw",
          },
        }),
        { allowExperimentalCompressions: true },
      );
      expect(actual).toEqual({
        charset: "utf-8",
        decompression: "deflate-raw",
        allowExperimentalCompressions: true,
      });
    });

    it("should throw error for unsupported compression format", () => {
      expect(() =>
        getOptionsFromResponse(
          new Response("", {
            headers: {
              "content-type": "text/csv",
              "content-encoding": "br", // Brotli is not supported yet
            },
          }),
        ),
      ).toThrowErrorMatchingInlineSnapshot(
        `[TypeError: Unsupported content-encoding: "br". Supported formats: gzip, deflate. To use experimental formats, set allowExperimentalCompressions: true]`,
      );
    });

    it("should throw error for invalid compression format", () => {
      expect(() =>
        getOptionsFromResponse(
          new Response("", {
            headers: {
              "content-type": "text/csv",
              "content-encoding": "unknown",
            },
          }),
        ),
      ).toThrowErrorMatchingInlineSnapshot(
        `[TypeError: Unsupported content-encoding: "unknown". Supported formats: gzip, deflate. To use experimental formats, set allowExperimentalCompressions: true]`,
      );
    });

    it("should throw error for malicious compression format", () => {
      expect(() =>
        getOptionsFromResponse(
          new Response("", {
            headers: {
              "content-type": "text/csv",
              "content-encoding": "gzip2",
            },
          }),
        ),
      ).toThrowErrorMatchingInlineSnapshot(
        `[TypeError: Unsupported content-encoding: "gzip2". Supported formats: gzip, deflate. To use experimental formats, set allowExperimentalCompressions: true]`,
      );
    });

    it("should normalize uppercase compression format to lowercase", () => {
      const actual = getOptionsFromResponse(
        new Response("", {
          headers: {
            "content-type": "text/csv",
            "content-encoding": "GZIP",
          },
        }),
      );
      expect(actual).toEqual({
        charset: "utf-8",
        decompression: "gzip", // Normalized to lowercase
      });
    });

    it("should normalize mixed-case compression format to lowercase", () => {
      const actual = getOptionsFromResponse(
        new Response("", {
          headers: {
            "content-type": "text/csv",
            "content-encoding": "Gzip",
          },
        }),
      );
      expect(actual).toEqual({
        charset: "utf-8",
        decompression: "gzip", // Normalized to lowercase
      });
    });

    it("should trim whitespace from compression format", () => {
      const actual = getOptionsFromResponse(
        new Response("", {
          headers: {
            "content-type": "text/csv",
            "content-encoding": "  gzip  ",
          },
        }),
      );
      expect(actual).toEqual({
        charset: "utf-8",
        decompression: "gzip",
      });
    });

    it("should throw error for multiple compression formats", () => {
      expect(() =>
        getOptionsFromResponse(
          new Response("", {
            headers: {
              "content-type": "text/csv",
              "content-encoding": "gzip, deflate",
            },
          }),
        ),
      ).toThrowErrorMatchingInlineSnapshot(
        `[TypeError: Multiple content-encodings are not supported: "gzip, deflate"]`,
      );
    });

    it("should throw error for multiple formats with whitespace", () => {
      expect(() =>
        getOptionsFromResponse(
          new Response("", {
            headers: {
              "content-type": "text/csv",
              "content-encoding": "gzip , deflate",
            },
          }),
        ),
      ).toThrowErrorMatchingInlineSnapshot(
        `[TypeError: Multiple content-encodings are not supported: "gzip , deflate"]`,
      );
    });

    it("should throw error for comma-separated list with unsupported format", () => {
      expect(() =>
        getOptionsFromResponse(
          new Response("", {
            headers: {
              "content-type": "text/csv",
              "content-encoding": "gzip, br",
            },
          }),
        ),
      ).toThrowErrorMatchingInlineSnapshot(
        `[TypeError: Multiple content-encodings are not supported: "gzip, br"]`,
      );
    });

    it("should ignore empty Content-Encoding header", () => {
      const actual = getOptionsFromResponse(
        new Response("", {
          headers: {
            "content-type": "text/csv",
            "content-encoding": "",
          },
        }),
      );
      expect(actual).toEqual({
        charset: "utf-8",
      });
    });

    it("should ignore whitespace-only Content-Encoding header", () => {
      const actual = getOptionsFromResponse(
        new Response("", {
          headers: {
            "content-type": "text/csv",
            "content-encoding": "   ",
          },
        }),
      );
      expect(actual).toEqual({
        charset: "utf-8",
      });
    });

    it("should throw error with guidance when unsupported format is used", () => {
      expect(() =>
        getOptionsFromResponse(
          new Response("", {
            headers: {
              "content-type": "text/csv",
              "content-encoding": "br",
            },
          }),
        ),
      ).toThrowErrorMatchingInlineSnapshot(
        `[TypeError: Unsupported content-encoding: "br". Supported formats: gzip, deflate. To use experimental formats, set allowExperimentalCompressions: true]`,
      );
    });

    it("should allow experimental compression format when option is enabled", () => {
      const actual = getOptionsFromResponse(
        new Response("", {
          headers: {
            "content-type": "text/csv",
            "content-encoding": "br", // Brotli - not in known list
          },
        }),
        { allowExperimentalCompressions: true },
      );
      expect(actual).toEqual({
        charset: "utf-8",
        decompression: "br",
        allowExperimentalCompressions: true,
      });
    });

    it("should allow unknown future format when experimental option is enabled", () => {
      const actual = getOptionsFromResponse(
        new Response("", {
          headers: {
            "content-type": "text/csv",
            "content-encoding": "zstd", // Future format
          },
        }),
        { allowExperimentalCompressions: true },
      );
      expect(actual).toEqual({
        charset: "utf-8",
        decompression: "zstd",
        allowExperimentalCompressions: true,
      });
    });

    it("should normalize experimental format to lowercase", () => {
      const actual = getOptionsFromResponse(
        new Response("", {
          headers: {
            "content-type": "text/csv",
            "content-encoding": "BR", // Uppercase
          },
        }),
        { allowExperimentalCompressions: true },
      );
      expect(actual).toEqual({
        charset: "utf-8",
        decompression: "br", // Normalized to lowercase
        allowExperimentalCompressions: true,
      });
    });

    it("should still reject multiple encodings even with experimental option", () => {
      expect(() =>
        getOptionsFromResponse(
          new Response("", {
            headers: {
              "content-type": "text/csv",
              "content-encoding": "br, gzip",
            },
          }),
          { allowExperimentalCompressions: true },
        ),
      ).toThrowErrorMatchingInlineSnapshot(
        `[TypeError: Multiple content-encodings are not supported: "br, gzip"]`,
      );
    });
  });
});
