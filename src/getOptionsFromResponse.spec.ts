import { describe, expect, it } from "vitest";
import { getOptionsFromResponse } from "./getOptionsFromResponse.ts";

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

  it("should return options with custom charset and decomposition", () => {
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
      decomposition: "gzip",
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
      `[RangeError: Invalid mime type: "application/json"]`,
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
        decomposition: "gzip",
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
        decomposition: "deflate",
      });
    });

    it("should accept 'deflate-raw' compression format", () => {
      const actual = getOptionsFromResponse(
        new Response("", {
          headers: {
            "content-type": "text/csv",
            "content-encoding": "deflate-raw",
          },
        }),
      );
      expect(actual).toEqual({
        charset: "utf-8",
        decomposition: "deflate-raw",
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
        `[RangeError: Unsupported content-encoding: "br". Supported formats: gzip, deflate, deflate-raw]`,
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
        `[RangeError: Unsupported content-encoding: "unknown". Supported formats: gzip, deflate, deflate-raw]`,
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
        `[RangeError: Unsupported content-encoding: "gzip2". Supported formats: gzip, deflate, deflate-raw]`,
      );
    });
  });
});
