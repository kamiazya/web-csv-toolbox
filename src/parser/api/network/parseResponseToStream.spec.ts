import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FC } from "@/__tests__/helper.ts";
import { parseResponse } from "@/parser/api/network/parseResponse.ts";
import { parseResponseToStream } from "@/parser/api/network/parseResponseToStream.ts";
import { escapeField } from "@/utils/serialization/escapeField.ts";

describe("parseResponseToStream", () => {
  it("should parse a response to a stream", () => {
    const csv = "a,b,c\n1,2,3\n4,5,6";
    const response = new Response(csv, {
      headers: {
        "content-type": "text/csv",
      },
    });
    const stream = parseResponseToStream(response);
    expect(stream).toBeInstanceOf(ReadableStream);
  });

  it("should throw error if content-type header is not text/csv", () => {
    const response = new Response("", {
      headers: {
        "content-type": "application/json",
      },
    });
    expect(() =>
      parseResponseToStream(response),
    ).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: Invalid mime type: "application/json"]`,
    );
  });

  it("should throw error if request body is null", () => {
    const response = new Response(null, {
      headers: {
        "content-type": "text/csv",
      },
    });
    expect(() =>
      parseResponseToStream(response),
    ).toThrowErrorMatchingInlineSnapshot(`[TypeError: Response body is null]`);
  });

  it("should parse CSV", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.gen().map((g) => {
          const header = g(FC.header, {
            // TextEncoderStream can't handle utf-16 string.
            fieldConstraints: {
              kindExcludes: ["string16bits"],
            },
          });
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
    );
  });
});
