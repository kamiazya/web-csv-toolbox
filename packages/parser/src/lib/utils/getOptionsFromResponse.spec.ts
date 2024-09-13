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
});
