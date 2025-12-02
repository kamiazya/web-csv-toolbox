import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FC } from "@/__tests__/helper.ts";
import { parseResponse } from "@/parser/api/network/parseResponse.ts";
import { escapeField } from "@/utils/serialization/escapeField.ts";

describe("parseResponse function", () => {
  it("should throw error if content-type header is not text/csv", async () => {
    const response = new Response("", {
      headers: {
        "content-type": "application/json",
      },
    });
    expect(() => parseResponse(response)).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: Invalid mime type: "application/json"]`,
    );
  });
  it("should throw error if request body is null", async () => {
    const response = new Response(null, {
      headers: {
        "content-type": "text/csv",
      },
    });
    expect(() => parseResponse(response)).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: Response body is null]`,
    );
  });

  it("should parse CSV", () =>
    fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            // TextEncoderStream can't handle utf-16 string.
            fieldConstraints: {
              kindExcludes: ["string16bits"],
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
              kindExcludes: ["string16bits"],
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
              new ReadableStream({
                start(controller) {
                  controller.enqueue(csv);
                  controller.close();
                },
              }).pipeThrough(new TextEncoderStream()),
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
            expect(data[i++]).toEqual(row);
          }
        },
      ),
    ));
});
