import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FC } from "@/__tests__/helper.ts";
import { parseRequest } from "@/parser/api/network/parseRequest.ts";
import { escapeField } from "@/utils/serialization/escapeField.ts";

describe("parseRequest function", () => {
  it("should throw error if content-type header is not text/csv", async () => {
    const request = new Request("https://example.com", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "",
    });
    expect(() => parseRequest(request)).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: Invalid mime type: "application/json"]`,
    );
  });

  it("should throw error if request body is null", async () => {
    const request = new Request("https://example.com", {
      method: "POST",
      headers: {
        "content-type": "text/csv",
      },
    });
    expect(() => parseRequest(request)).toThrowErrorMatchingInlineSnapshot(
      `[TypeError: Request body is null]`,
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
            request: new Request("https://example.com", {
              method: "POST",
              headers: {
                "content-type": "text/csv",
              },
              body: new ReadableStream({
                start(controller) {
                  controller.enqueue(csv);
                  controller.close();
                },
              }).pipeThrough(new TextEncoderStream()),
              // @ts-expect-error - duplex is required in Node.js but not in the types yet
              duplex: "half",
            }),
          };
        }),
        async ({ data, request }) => {
          let i = 0;
          for await (const row of parseRequest(request)) {
            expect(data[i++]).toEqual(row);
          }
        },
      ),
    ));

  it("should parse CSV with charset in content-type", async () => {
    const csv = "name,age\nAlice,42\nBob,69";
    const request = new Request("https://example.com", {
      method: "POST",
      headers: {
        "content-type": "text/csv;charset=utf-8",
      },
      body: csv,
    });
    const expected = [
      { name: "Alice", age: "42" },
      { name: "Bob", age: "69" },
    ];

    let i = 0;
    for await (const row of parseRequest(request)) {
      expect(row).toEqual(expected[i++]);
    }
  });

  it("should parse CSV using toArray method", async () => {
    const csv = "name,age\nAlice,42\nBob,69";
    const request = new Request("https://example.com", {
      method: "POST",
      headers: {
        "content-type": "text/csv",
      },
      body: csv,
    });
    const expected = [
      { name: "Alice", age: "42" },
      { name: "Bob", age: "69" },
    ];

    const records = await parseRequest.toArray(request);
    expect(records).toEqual(expected);
  });
});
