import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { FC } from "#/tests/utils/helper";

import { escapeField } from "@web-csv-toolbox/common";
import { SingleValueReadableStream } from "@web-csv-toolbox/shared";

import { parseResponse } from "./parseResponse";

describe("parseRequest function", () => {
  it("should throw error if content-type header is not text/csv", async () => {
    const response = new Response("", {
      headers: {
        "content-type": "application/json",
      },
    });
    expect(() => parseResponse(response)).toThrowErrorMatchingInlineSnapshot(
      `[RangeError: Invalid mime type: "application/json"]`,
    );
  });
  it("should throw error if request body is null", async () => {
    const response = new Response(null, {
      headers: {
        "content-type": "text/csv",
      },
    });
    expect(() => parseResponse(response)).toThrowErrorMatchingInlineSnapshot(
      // biome-ignore lint/style/noUnusedTemplateLiteral: This is a snapshot
      `[RangeError: Response body is null]`,
    );
  });

  it("should parse CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            // TextEncoderStream can't handle utf-16 string.
            fieldConstraints: {
              unit: "grapheme",
            },
          });
          const BOM = g(fc.boolean);
          if (BOM) {
            // Add BOM to the first field.
            header[0] = `\ufeff${header[0]}`;
          }
          const EOL = g(FC.eol);
          const csvData = g(FC.csvData, {
            // TextEncoderStream can't handle utf-16 string.
            fieldConstraints: {
              unit: "grapheme",
            },
            columnsConstraints: {
              minLength: header.length,
              maxLength: header.length,
            },
          });
          const EOF = g(fc.boolean);
          const csv = [
            header.map((v) => escapeField(v, { quote: true })).join(","),
            ...csvData.map((row) =>
              row.map((v) => escapeField(v, { quote: true })).join(","),
            ),
            ...(EOF ? [""] : []),
          ].join(EOL);
          const data =
            csvData.length >= 1
              ? csvData.map((row) =>
                  Object.fromEntries(row.map((v, i) => [header[i], v])),
                )
              : [];
          return {
            data,
            // csv:
            response: new Response(
              new SingleValueReadableStream(csv).pipeThrough(
                new TextEncoderStream(),
              ),
              {
                headers: {
                  "content-type": "text/csv",
                },
              },
            ),
          };
        }),
        async ({ data, response }) => {
          let i = 0;
          for await (const row of parseResponse(response)) {
            expect(data[i++]).toStrictEqual(row);
          }
        },
      ),
    ));
});
